import {
  runConfiguredAssistantOpenAiCompatibleChatCompletion,
  type OpenAiCompatibleChatResult,
  type OpenAiCompatibleChatTool,
} from "./openai-compatible-chat-client.js";
import type {
  AssistantProvider,
  AssistantProviderCallTelemetry,
  AssistantProviderRequest,
  AssistantProviderResponse,
  AssistantProviderToolDefinition,
} from "./provider-types.js";

/** Map an OpenAI-compatible client result into provider-neutral telemetry. */
function toCallTelemetry(
  result: OpenAiCompatibleChatResult,
): AssistantProviderCallTelemetry {
  return {
    attempted: result.attempted,
    errored: result.attempted && !result.ok,
    provider: result.provider,
    model: result.model,
    usage: result.usage,
  };
}

function providerErrorCode(result: OpenAiCompatibleChatResult): string {
  return result.provider === "groq"
    ? "GROQ_PROVIDER_ERROR"
    : "OPENAI_COMPATIBLE_PROVIDER_ERROR";
}

function providerName(result: OpenAiCompatibleChatResult): string {
  return result.provider === "groq" ? "Groq" : "OpenAI-compatible provider";
}

const OPENAI_COMPATIBLE_MAX_TOKENS = 512;

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

function buildOpenAiCompatibleTools(
  allowedTools: AssistantProviderToolDefinition[],
): OpenAiCompatibleChatTool[] {
  return allowedTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object" as const,
        properties: Object.fromEntries(
          tool.input_fields.map((field) => [
            field,
            { type: "string" as const },
          ]),
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
    Object.entries(parsed).map(([key, value]) => [key, String(value)]),
  );
}

/**
 * Execute one non-streaming OpenAI-compatible assistant request and normalize
 * the result into a provider-neutral response.
 *
 * Groq and BYO use this same path, so tool allowlisting, telemetry, and fallback
 * semantics remain provider-independent.
 *
 * @param request - Provider-neutral assistant request.
 * @returns Provider-neutral provider response.
 */
export async function runOpenAiCompatibleAssistantProvider(
  request: AssistantProviderRequest,
): Promise<AssistantProviderResponse> {
  const result = await runConfiguredAssistantOpenAiCompatibleChatCompletion({
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(request) },
    ],
    maxTokens: OPENAI_COMPATIBLE_MAX_TOKENS,
    temperature: 0,
    tools: buildOpenAiCompatibleTools(request.allowed_tools),
    toolChoice: "auto",
  });

  const telemetry = toCallTelemetry(result);

  if (!result.ok) {
    return {
      kind: "error",
      error_code: providerErrorCode(result),
      message: result.errorMessage ?? `${providerName(result)} request failed.`,
      telemetry,
    };
  }

  if (result.toolCall !== null) {
    return {
      kind: "tool_call",
      tool_name: result.toolCall.name,
      tool_args: normalizeToolArgs(result.toolCall.arguments),
      telemetry,
    };
  }

  const text = result.content?.trim() ?? "";

  if (text.length > 0) {
    return {
      kind: "message",
      message: text,
      telemetry,
    };
  }

  return {
    kind: "error",
    error_code: providerErrorCode(result),
    message: `${providerName(result)} returned neither text nor a tool call.`,
    telemetry,
  };
}

export const openAiCompatibleAssistantProvider: AssistantProvider = {
  run: runOpenAiCompatibleAssistantProvider,
};

const OPENAI_COMPATIBLE_PHRASING_MAX_TOKENS = 256;

/** Input for one answer-summary re-phrasing call (Slice 11.3b). */
export interface AssistantPhrasingInput {
  /** The deterministic answer summary to re-word. */
  draftSummary: string;
  /** Evidence-bearing fact lines (answer bullets) the rewrite must stay consistent with. */
  supportingFacts: string[];
}

/** Output of one re-phrasing call: the (possibly rewritten) summary + call telemetry. */
export interface AssistantPhrasingOutput {
  summary: string;
  /** Per-call telemetry (attempted/errored/provider/model/usage). */
  call: AssistantProviderCallTelemetry;
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
    "Return only the rewritten summary text - one or two sentences, no preamble, no explanation.",
  ].join(" ");
}

function buildPhrasingUserPrompt(input: AssistantPhrasingInput): string {
  const facts =
    input.supportingFacts.length > 0
      ? input.supportingFacts.map((fact) => `- ${fact}`).join("\n")
      : "(none)";

  return [
    `draft_summary=${input.draftSummary}`,
    `supporting_facts:\n${facts}`,
  ].join("\n");
}

/**
 * Re-phrase one answer summary with the configured OpenAI-compatible provider,
 * preserving all numbers/facts.
 *
 * Graceful by contract: any failure (missing key, HTTP error, malformed/empty
 * response) returns the original `draftSummary` so a phrasing attempt can never
 * break or degrade the turn. Faithfulness still validates the returned text
 * upstream before it is shown.
 *
 * @param input - The draft summary plus supporting fact lines.
 * @returns The re-phrased summary + token usage, or the original draft on any failure.
 */
export async function runOpenAiCompatibleAnswerPhrasing(
  input: AssistantPhrasingInput,
): Promise<AssistantPhrasingOutput> {
  const result = await runConfiguredAssistantOpenAiCompatibleChatCompletion({
    messages: [
      { role: "system", content: buildPhrasingSystemPrompt() },
      { role: "user", content: buildPhrasingUserPrompt(input) },
    ],
    maxTokens: OPENAI_COMPATIBLE_PHRASING_MAX_TOKENS,
    temperature: 0.3,
  });

  const call = toCallTelemetry(result);

  if (!result.ok) {
    return { summary: input.draftSummary, call };
  }

  const text = result.content?.trim() ?? "";

  return text.length > 0
    ? { summary: text, call }
    : { summary: input.draftSummary, call };
}
