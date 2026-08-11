import {
  runOpenAiCompatibleChatCompletion,
  type OpenAiCompatibleChatRequest,
  type OpenAiCompatibleChatResult,
} from "../ai/openai-compatible-chat-client.js";
import {
  getConfiguredAssistantProvider,
  getGroqAssistantProviderConfig,
  getOpenAiCompatibleProviderConfig,
  type OpenAiCompatibleProviderConfig,
} from "./provider-config.js";
import type { OpenAiCompatibleProviderName } from "./provider-types.js";

export {
  CHAT_COMPLETION_TIMEOUT_MS,
  OPENAI_COMPATIBLE_CHAT_COMPLETIONS_PATH,
  runOpenAiCompatibleChatCompletion,
} from "../ai/openai-compatible-chat-client.js";

export type {
  OpenAiCompatibleChatCompletionOptions,
  OpenAiCompatibleChatRequest,
  OpenAiCompatibleChatResult,
  OpenAiCompatibleChatTool,
  OpenAiCompatibleChatToolCall,
} from "../ai/openai-compatible-chat-client.js";

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
