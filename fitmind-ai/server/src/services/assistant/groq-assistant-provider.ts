import { z } from "zod";

import { getGroqAssistantProviderConfig } from "./provider-config.js";
import type {
  AssistantProvider,
  AssistantProviderRequest,
  AssistantProviderResponse,
  AssistantProviderToolDefinition,
  AssistantProviderUsage,
} from "./provider-types.js";

const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MAX_TOKENS = 512;

// OpenAI-compatible chat completion shape (Groq). Validated with Zod so a
// malformed/unexpected response degrades to a clean provider error instead of
// throwing deep in the orchestrator.
const groqToolCallSchema = z.object({
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

const groqMessageSchema = z.object({
  content: z.string().nullable().optional(),
  tool_calls: z.array(groqToolCallSchema).optional(),
});

const groqUsageSchema = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
});

const groqChatCompletionSchema = z.object({
  choices: z
    .array(z.object({ message: groqMessageSchema }))
    .min(1),
  usage: groqUsageSchema.optional(),
});

/**
 * Build the provider-neutral system prompt for the assistant turn.
 *
 * Kept aligned with the Anthropic provider: the model returns exactly one
 * concise plain-text answer or one allowed tool call, Chinese by default.
 *
 * @returns System prompt text.
 */
function buildSystemPrompt(): string {
  return [
    "You are the non-streaming provider layer for FitMind AI.",
    "Return either one concise plain-text answer or one client tool call.",
    "User-facing text must be Chinese by default unless the user explicitly asks for another language.",
    "If the user asks for training data that depends on backend evidence, prefer exactly one allowed tool.",
    "Never request more than one tool call.",
    "Never invent tool names that are not in the allowed tools list.",
  ].join(" ");
}

function buildGroqTools(
  allowedTools: AssistantProviderToolDefinition[],
): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: "string" }>;
      required: string[];
    };
  };
}> {
  return allowedTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object" as const,
        properties: Object.fromEntries(
          tool.input_fields.map((field) => [field, { type: "string" as const }]),
        ),
        required: [...tool.input_fields],
      },
    },
  }));
}

function buildUserPrompt(request: AssistantProviderRequest): string {
  const baseLines = [
    `mode=${request.assistant_context.mode}`,
    `start_date=${request.assistant_context.start_date}`,
    `end_date=${request.assistant_context.end_date}`,
    `exercise_id=${request.assistant_context.exercise_id ?? "null"}`,
    `user_message=${request.conversation.user_message}`,
  ];

  if (request.simulation.scenario !== "default") {
    baseLines.push(`simulation_hint=${request.simulation.scenario}`);
  }

  return baseLines.join("\n");
}

function extractProviderErrorMessage(payload: unknown, status: number): string {
  const parsed = z
    .object({
      error: z
        .object({
          message: z.string().optional(),
          type: z.string().optional(),
        })
        .optional(),
      message: z.string().optional(),
    })
    .safeParse(payload);

  if (parsed.success) {
    const errorMessage = parsed.data.error?.message ?? parsed.data.message;

    if (errorMessage !== undefined) {
      return `Groq provider request failed (${status}): ${errorMessage}`;
    }
  }

  return `Groq provider request failed with HTTP ${status}.`;
}

function normalizeToolArgs(rawArguments: string): Record<string, string> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawArguments);
  } catch {
    return {};
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
      key,
      String(value),
    ]),
  );
}

/**
 * Execute one non-streaming Groq (OpenAI-compatible) assistant request and
 * normalize the result into a provider-neutral response.
 *
 * @param request - Provider-neutral assistant request.
 * @returns Provider-neutral provider response.
 */
export async function runGroqAssistantProvider(
  request: AssistantProviderRequest,
): Promise<AssistantProviderResponse> {
  const config = getGroqAssistantProviderConfig();
  const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: GROQ_MAX_TOKENS,
      temperature: 0,
      tools: buildGroqTools(request.allowed_tools),
      tool_choice: "auto",
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(request) },
      ],
    }),
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    return {
      kind: "error",
      error_code: "GROQ_PROVIDER_ERROR",
      message: extractProviderErrorMessage(payload, response.status),
    };
  }

  const parsedCompletion = groqChatCompletionSchema.safeParse(payload);

  if (!parsedCompletion.success) {
    return {
      kind: "error",
      error_code: "GROQ_PROVIDER_ERROR",
      message: "Groq provider returned an unexpected response shape.",
    };
  }

  const message = parsedCompletion.data.choices[0]?.message;
  const toolCall = message?.tool_calls?.[0];
  const usage = parsedCompletion.data.usage;

  if (toolCall !== undefined) {
    return {
      kind: "tool_call",
      tool_name: toolCall.function.name,
      tool_args: normalizeToolArgs(toolCall.function.arguments),
      usage,
    };
  }

  const text = message?.content?.trim() ?? "";

  if (text.length > 0) {
    return {
      kind: "message",
      message: text,
      usage,
    };
  }

  return {
    kind: "error",
    error_code: "GROQ_PROVIDER_ERROR",
    message: "Groq provider returned neither text nor a tool call.",
  };
}

export const groqAssistantProvider: AssistantProvider = {
  run: runGroqAssistantProvider,
};

const GROQ_PHRASING_MAX_TOKENS = 256;

/** Input for one answer-summary re-phrasing call (Slice 11.3b). */
export interface AssistantPhrasingInput {
  /** The deterministic answer summary to re-word. */
  draftSummary: string;
  /** Evidence-bearing fact lines (answer bullets) the rewrite must stay consistent with. */
  supportingFacts: string[];
}

/** Output of one re-phrasing call: the (possibly rewritten) summary + optional usage. */
export interface AssistantPhrasingOutput {
  summary: string;
  /** Token usage when the provider reports it (Groq); absent on the draft-fallback path. */
  usage?: AssistantProviderUsage | undefined;
}

/**
 * System prompt for re-phrasing: re-word only, never touch the numbers.
 *
 * @returns System prompt text.
 */
function buildPhrasingSystemPrompt(): string {
  return [
    "You rewrite a fitness assistant's answer summary into natural, fluent Chinese.",
    "Preserve every number, percentage, unit, and factual claim EXACTLY as given.",
    "Never introduce, drop, or alter any number, and never add facts not present in the draft.",
    "Return only the rewritten summary text — one or two sentences, no preamble, no explanation.",
  ].join(" ");
}

function buildPhrasingUserPrompt(input: AssistantPhrasingInput): string {
  const facts =
    input.supportingFacts.length > 0
      ? input.supportingFacts.map((fact) => `- ${fact}`).join("\n")
      : "（无）";

  return [`draft_summary=${input.draftSummary}`, `supporting_facts:\n${facts}`].join(
    "\n",
  );
}

/**
 * Re-phrase one answer summary with Groq, preserving all numbers/facts.
 *
 * Graceful by contract: any failure (missing key, HTTP error, malformed/empty
 * response, network throw) returns the original `draftSummary` so a phrasing
 * attempt can never break or degrade the turn. Faithfulness still validates the
 * returned text upstream before it is shown.
 *
 * @param input - The draft summary plus supporting fact lines.
 * @returns The re-phrased summary + token usage, or the original draft (no usage) on any failure.
 */
export async function runGroqAnswerPhrasing(
  input: AssistantPhrasingInput,
): Promise<AssistantPhrasingOutput> {
  try {
    const config = getGroqAssistantProviderConfig();
    const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: GROQ_PHRASING_MAX_TOKENS,
        temperature: 0.3,
        messages: [
          { role: "system", content: buildPhrasingSystemPrompt() },
          { role: "user", content: buildPhrasingUserPrompt(input) },
        ],
      }),
    });

    // Always drain the body (mirrors the main provider path): leaving an error
    // response body unconsumed can break undici connection reuse, which compounds
    // on repeated 429/5xx.
    const payload = (await response.json()) as unknown;

    if (!response.ok) {
      return { summary: input.draftSummary };
    }

    const parsed = groqChatCompletionSchema.safeParse(payload);

    if (!parsed.success) {
      return { summary: input.draftSummary };
    }

    const text = parsed.data.choices[0]?.message.content?.trim() ?? "";

    return text.length > 0
      ? { summary: text, usage: parsed.data.usage }
      : { summary: input.draftSummary };
  } catch {
    return { summary: input.draftSummary };
  }
}
