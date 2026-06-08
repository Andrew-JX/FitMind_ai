import { z } from "zod";

import { getAnthropicProviderConfig } from "./provider-config.js";
import type {
  AssistantProvider,
  AssistantProviderRequest,
  AssistantProviderResponse,
  AssistantProviderToolDefinition,
} from "./provider-types.js";

const anthropicContentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("tool_use"),
    id: z.string(),
    name: z.string(),
    input: z.record(z.string(), z.unknown()),
  }),
]);

const anthropicMessageSchema = z.object({
  id: z.string(),
  content: z.array(anthropicContentBlockSchema),
  stop_reason: z.string().nullable(),
});

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

function buildAnthropicTools(
  allowedTools: AssistantProviderToolDefinition[],
): Array<{
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: "string" }>;
    required: string[];
  };
}> {
  return allowedTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object",
      properties: Object.fromEntries(
        tool.input_fields.map((field) => [field, { type: "string" as const }]),
      ),
      required: [...tool.input_fields],
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
      type: z.string().optional(),
      message: z.string().optional(),
    })
    .safeParse(payload);

  if (parsed.success) {
    const errorMessage =
      parsed.data.error?.message ?? parsed.data.message ?? parsed.data.type;

    if (errorMessage !== undefined) {
      return `Anthropic provider request failed (${status}): ${errorMessage}`;
    }
  }

  return `Anthropic provider request failed with HTTP ${status}.`;
}

function normalizeToolArgs(input: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, String(value)]),
  );
}

/**
 * Execute one non-streaming Anthropic provider request and normalize the result.
 *
 * @param request - Provider-neutral assistant request.
 * @returns Provider-neutral provider response.
 */
export async function runAnthropicProvider(
  request: AssistantProviderRequest,
): Promise<AssistantProviderResponse> {
  const config = getAnthropicProviderConfig();
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": config.apiVersion,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 512,
      system: buildSystemPrompt(),
      tools: buildAnthropicTools(request.allowed_tools),
      messages: [
        {
          role: "user",
          content: buildUserPrompt(request),
        },
      ],
    }),
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    return {
      kind: "error",
      error_code: "ANTHROPIC_PROVIDER_ERROR",
      message: extractProviderErrorMessage(payload, response.status),
    };
  }

  const parsedMessage = anthropicMessageSchema.safeParse(payload);

  if (!parsedMessage.success) {
    return {
      kind: "error",
      error_code: "ANTHROPIC_PROVIDER_ERROR",
      message: "Anthropic provider returned an unexpected response shape.",
    };
  }

  const toolUseBlock = parsedMessage.data.content.find(
    (block): block is z.infer<typeof anthropicContentBlockSchema> & {
      type: "tool_use";
    } => block.type === "tool_use",
  );

  if (toolUseBlock !== undefined) {
    return {
      kind: "tool_call",
      tool_name: toolUseBlock.name,
      tool_args: normalizeToolArgs(toolUseBlock.input),
    };
  }

  const combinedText = parsedMessage.data.content
    .filter(
      (block): block is z.infer<typeof anthropicContentBlockSchema> & {
        type: "text";
      } => block.type === "text",
    )
    .map((block) => block.text.trim())
    .join("\n")
    .trim();

  if (combinedText.length > 0) {
    return {
      kind: "message",
      message: combinedText,
    };
  }

  return {
    kind: "error",
    error_code: "ANTHROPIC_PROVIDER_ERROR",
    message: "Anthropic provider returned neither text nor a tool call.",
  };
}

export const anthropicAssistantProvider: AssistantProvider = {
  run: runAnthropicProvider,
};
