import { z } from "zod";

import { getGroqAssistantProviderConfig } from "./provider-config.js";
import type { AssistantProviderUsage } from "./provider-types.js";

/** Groq OpenAI-compatible chat completions endpoint. */
export const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";

/** One OpenAI-style tool definition passed to Groq. */
export interface GroqChatTool {
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
}

export interface GroqChatRequest {
  messages: Array<{ role: "system" | "user"; content: string }>;
  maxTokens: number;
  temperature: number;
  tools?: GroqChatTool[] | undefined;
  toolChoice?: "auto" | "none" | undefined;
}

export interface GroqChatToolCall {
  name: string;
  arguments: string;
}

/**
 * Normalized result of one Groq chat call.
 *
 * `attempted` is true once a network request was issued (including a network
 * throw); it is false only when config failed before any request (e.g. missing
 * key). `ok` means the core response parsed; `usage` is parsed *independently and
 * leniently* so a usage-shape drift never makes a valid tool call / message fail
 * (observability must not break business availability). `provider`/`model` come
 * from the actual call config so cost pricing never drifts from what ran.
 */
export interface GroqChatResult {
  attempted: boolean;
  provider: "groq";
  model: string | null;
  ok: boolean;
  status: number;
  content: string | null;
  toolCall: GroqChatToolCall | null;
  usage?: AssistantProviderUsage | undefined;
  errorMessage?: string | undefined;
}

// Core (business) response shape: only the fields callers act on.
const groqToolCallSchema = z.object({
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

const groqCoreSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z.array(groqToolCallSchema).optional(),
        }),
      }),
    )
    .min(1),
});

// Usage parsed separately so its failure cannot reject the core response.
const groqUsageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
});

function parseUsage(payload: unknown): AssistantProviderUsage | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const usage = (payload as { usage?: unknown }).usage;
  const parsed = groqUsageSchema.safeParse(usage);

  return parsed.success ? parsed.data : undefined;
}

function extractErrorMessage(payload: unknown, status: number): string {
  const parsed = z
    .object({
      error: z.object({ message: z.string().optional() }).optional(),
      message: z.string().optional(),
    })
    .safeParse(payload);

  if (parsed.success) {
    const message = parsed.data.error?.message ?? parsed.data.message;
    if (message !== undefined) {
      return `Groq request failed (${status}): ${message}`;
    }
  }

  return `Groq request failed with HTTP ${status}.`;
}

/**
 * Execute one Groq chat completion and normalize the result.
 *
 * Always drains the response body (connection-reuse hygiene), parses the core
 * response and `usage` separately, and never throws — a network/HTTP/shape failure
 * returns `{ ok: false, ... }` with an `errorMessage`.
 *
 * @param request - Messages, sampling params, and optional tools.
 * @returns The normalized {@link GroqChatResult}.
 */
export async function runGroqChatCompletion(
  request: GroqChatRequest,
): Promise<GroqChatResult> {
  let config: { apiKey: string; model: string };
  try {
    config = getGroqAssistantProviderConfig();
  } catch (error) {
    // Config failure happens before any request → attempted: false, model: null.
    return {
      attempted: false,
      provider: "groq",
      model: null,
      ok: false,
      status: 0,
      content: null,
      toolCall: null,
      errorMessage:
        error instanceof Error ? error.message : "Groq config unavailable.",
    };
  }

  const model = config.model;
  let response: Response;
  try {
    response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        ...(request.tools !== undefined ? { tools: request.tools } : {}),
        ...(request.toolChoice !== undefined
          ? { tool_choice: request.toolChoice }
          : {}),
        messages: request.messages,
      }),
    });
  } catch (error) {
    return {
      attempted: true,
      provider: "groq",
      model,
      ok: false,
      status: 0,
      content: null,
      toolCall: null,
      errorMessage:
        error instanceof Error ? error.message : "Groq request failed.",
    };
  }

  // Always drain the body once (mirrors a single read; avoids leaking the stream
  // on error responses, which can break undici connection reuse).
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  const usage = parseUsage(payload);

  if (!response.ok) {
    return {
      attempted: true,
      provider: "groq",
      model,
      ok: false,
      status: response.status,
      content: null,
      toolCall: null,
      usage,
      errorMessage: extractErrorMessage(payload, response.status),
    };
  }

  const parsed = groqCoreSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      attempted: true,
      provider: "groq",
      model,
      ok: false,
      status: response.status,
      content: null,
      toolCall: null,
      usage,
      errorMessage: "Groq returned an unexpected response shape.",
    };
  }

  const message = parsed.data.choices[0]?.message;
  const rawToolCall = message?.tool_calls?.[0];

  return {
    attempted: true,
    provider: "groq",
    model,
    ok: true,
    status: response.status,
    content: message?.content ?? null,
    toolCall:
      rawToolCall === undefined
        ? null
        : {
            name: rawToolCall.function.name,
            arguments: rawToolCall.function.arguments,
          },
    usage,
  };
}
