import { z } from "zod";

import {
  getConfiguredAssistantProvider,
  getGroqAssistantProviderConfig,
  getOpenAiCompatibleProviderConfig,
  type OpenAiCompatibleProviderConfig,
} from "./provider-config.js";
import type {
  AssistantProviderUsage,
  OpenAiCompatibleProviderName,
} from "./provider-types.js";

export const OPENAI_COMPATIBLE_CHAT_COMPLETIONS_PATH = "/chat/completions";

/** One OpenAI-style tool definition passed to a compatible chat endpoint. */
export interface OpenAiCompatibleChatTool {
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

export interface OpenAiCompatibleChatRequest {
  messages: Array<{ role: "system" | "user"; content: string }>;
  maxTokens: number;
  temperature: number;
  tools?: OpenAiCompatibleChatTool[] | undefined;
  toolChoice?: "auto" | "none" | undefined;
  responseFormat?: { type: "json_object" } | undefined;
}

export interface OpenAiCompatibleChatToolCall {
  name: string;
  arguments: string;
}

/**
 * Normalized result of one OpenAI-compatible chat call.
 *
 * `attempted` is true once a network request was issued (including a network
 * throw); it is false only when config failed before any request (e.g. missing
 * key). `ok` means the core response parsed; `usage` is parsed independently and
 * leniently so a usage-shape drift never makes a valid tool call / message fail.
 * `provider`/`model` come from the actual call config so telemetry and pricing
 * never drift from what ran.
 */
export interface OpenAiCompatibleChatResult {
  attempted: boolean;
  provider: OpenAiCompatibleProviderName;
  model: string | null;
  ok: boolean;
  status: number;
  content: string | null;
  toolCall: OpenAiCompatibleChatToolCall | null;
  usage?: AssistantProviderUsage | undefined;
  errorMessage?: string | undefined;
}

const openAiCompatibleToolCallSchema = z.object({
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

const openAiCompatibleCoreSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z.array(openAiCompatibleToolCallSchema).optional(),
        }),
      }),
    )
    .min(1),
});

const openAiCompatibleUsageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
});

function getObjectProperty(
  value: unknown,
  property: string,
): unknown | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  return Object.getOwnPropertyDescriptor(value, property)?.value;
}

function parseUsage(payload: unknown): AssistantProviderUsage | undefined {
  const parsed = openAiCompatibleUsageSchema.safeParse(
    getObjectProperty(payload, "usage"),
  );

  return parsed.success ? parsed.data : undefined;
}

function extractResponseMessage(payload: unknown): string | undefined {
  const parsed = z
    .object({
      error: z.object({ message: z.string().optional() }).optional(),
      message: z.string().optional(),
    })
    .safeParse(payload);

  return parsed.success
    ? (parsed.data.error?.message ?? parsed.data.message)
    : undefined;
}

function buildChatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/u, "")}${OPENAI_COMPATIBLE_CHAT_COMPLETIONS_PATH}`;
}

function providerLabel(provider: OpenAiCompatibleProviderName): string {
  return provider === "groq" ? "Groq" : "OpenAI-compatible";
}

function configUnavailableResult(
  provider: OpenAiCompatibleProviderName,
  error: unknown,
): OpenAiCompatibleChatResult {
  return {
    attempted: false,
    provider,
    model: null,
    ok: false,
    status: 0,
    content: null,
    toolCall: null,
    errorMessage:
      error instanceof Error
        ? error.message
        : `${providerLabel(provider)} config unavailable.`,
  };
}

/**
 * Resolve the OpenAI-compatible config for the assistant seam.
 *
 * Groq remains the default OpenAI-compatible preset. When
 * `ASSISTANT_PROVIDER=openai_compatible`, the shared `OPENAI_COMPAT_*` env set
 * supplies the endpoint, model, and key.
 *
 * @returns The selected OpenAI-compatible provider config.
 */
export function getConfiguredAssistantOpenAiCompatibleConfig(): OpenAiCompatibleProviderConfig {
  return getConfiguredAssistantProvider() === "openai_compatible"
    ? getOpenAiCompatibleProviderConfig()
    : getGroqAssistantProviderConfig();
}

/**
 * Execute one chat completion through the configured assistant OpenAI-compatible
 * provider (Groq preset or BYO).
 *
 * @param request - Messages, sampling params, and optional tools.
 * @returns The normalized chat result.
 */
export async function runConfiguredAssistantOpenAiCompatibleChatCompletion(
  request: OpenAiCompatibleChatRequest,
): Promise<OpenAiCompatibleChatResult> {
  const provider =
    getConfiguredAssistantProvider() === "openai_compatible"
      ? "openai_compatible"
      : "groq";

  try {
    return await runOpenAiCompatibleChatCompletion(
      request,
      getConfiguredAssistantOpenAiCompatibleConfig(),
    );
  } catch (error) {
    return configUnavailableResult(provider, error);
  }
}

/**
 * Execute one OpenAI-compatible chat completion and normalize the result.
 *
 * Always drains the response body, parses the core response and `usage`
 * separately, and never throws on network/HTTP/shape failures. The returned
 * error text never includes API keys or request headers.
 *
 * @param request - Messages, sampling params, and optional tools.
 * @param config - Concrete provider config for this call.
 * @returns The normalized chat result.
 */
export async function runOpenAiCompatibleChatCompletion(
  request: OpenAiCompatibleChatRequest,
  config: OpenAiCompatibleProviderConfig,
): Promise<OpenAiCompatibleChatResult> {
  const model = config.model;
  let response: Response;
  try {
    response = await fetch(buildChatCompletionsUrl(config.baseUrl), {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        ...(request.tools !== undefined ? { tools: request.tools } : {}),
        ...(request.toolChoice !== undefined
          ? { tool_choice: request.toolChoice }
          : {}),
        ...(request.responseFormat !== undefined
          ? { response_format: request.responseFormat }
          : {}),
        messages: request.messages,
      }),
    });
  } catch (error) {
    return {
      attempted: true,
      provider: config.provider,
      model,
      ok: false,
      status: 0,
      content: null,
      toolCall: null,
      errorMessage:
        error instanceof Error
          ? error.message
          : `${providerLabel(config.provider)} request failed.`,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  const usage = parseUsage(payload);

  if (!response.ok) {
    const message = extractResponseMessage(payload);
    return {
      attempted: true,
      provider: config.provider,
      model,
      ok: false,
      status: response.status,
      content: null,
      toolCall: null,
      usage,
      errorMessage:
        message === undefined
          ? `${providerLabel(config.provider)} request failed with HTTP ${response.status}.`
          : `${providerLabel(config.provider)} request failed (${response.status}): ${message}`,
    };
  }

  const parsed = openAiCompatibleCoreSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      attempted: true,
      provider: config.provider,
      model,
      ok: false,
      status: response.status,
      content: null,
      toolCall: null,
      usage,
      errorMessage: `${providerLabel(config.provider)} returned an unexpected response shape.`,
    };
  }

  const message = parsed.data.choices[0]?.message;
  const rawToolCall = message?.tool_calls?.[0];

  return {
    attempted: true,
    provider: config.provider,
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
