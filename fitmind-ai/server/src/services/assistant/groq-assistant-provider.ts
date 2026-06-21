import { z } from "zod";

import { getGroqAssistantProviderConfig } from "./provider-config.js";
import type {
  AssistantProvider,
  AssistantProviderRequest,
  AssistantProviderResponse,
  AssistantProviderToolDefinition,
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

const groqChatCompletionSchema = z.object({
  choices: z
    .array(z.object({ message: groqMessageSchema }))
    .min(1),
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

  if (toolCall !== undefined) {
    return {
      kind: "tool_call",
      tool_name: toolCall.function.name,
      tool_args: normalizeToolArgs(toolCall.function.arguments),
    };
  }

  const text = message?.content?.trim() ?? "";

  if (text.length > 0) {
    return {
      kind: "message",
      message: text,
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
