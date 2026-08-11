import { loadServerEnv } from "../../env.js";

export {
  GROQ_DEFAULT_MODEL,
  GROQ_OPENAI_COMPATIBLE_BASE_URL,
  getGroqAssistantProviderConfig,
  getOpenAiCompatibleProviderConfig,
} from "../ai/openai-compatible-provider-config.js";

export type {
  GroqProviderConfig,
  OpenAiCompatibleProviderConfig,
} from "../ai/openai-compatible-provider-config.js";

export interface AnthropicProviderConfig {
  apiKey: string;
  model: string;
  apiVersion: string;
}

export type AssistantProviderName =
  | "mock"
  | "anthropic"
  | "groq"
  | "openai_compatible";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const ANTHROPIC_API_VERSION = "2023-06-01";
/**
 * Read the configured assistant provider selection.
 *
 * @returns The current assistant provider name.
 */
export function getConfiguredAssistantProvider(): AssistantProviderName {
  return loadServerEnv().assistantProvider;
}

/**
 * Whether LLM answer-summary re-phrasing (Slice 11.3b) is active.
 *
 * Requires both the opt-in `ASSISTANT_PHRASING` flag and a real model provider
 * (`ASSISTANT_PROVIDER=groq|openai_compatible`); under mock/anthropic it stays
 * off so the default path is unchanged. Runtime faithfulness still gates the
 * phrased text.
 *
 * @returns True when phrasing should be attempted this turn.
 */
export function isAssistantAnswerPhrasingEnabled(): boolean {
  const env = loadServerEnv();

  return (
    env.assistantPhrasing &&
    (env.assistantProvider === "groq" ||
      env.assistantProvider === "openai_compatible")
  );
}

/**
 * Build the runtime config required for the Anthropic provider adapter.
 *
 * @returns Normalized Anthropic provider config.
 */
export function getAnthropicProviderConfig(): AnthropicProviderConfig {
  const env = loadServerEnv();

  if (env.anthropicApiKey === undefined) {
    throw new Error(
      "ANTHROPIC_API_KEY is required when ASSISTANT_PROVIDER=anthropic.",
    );
  }

  return {
    apiKey: env.anthropicApiKey,
    model: ANTHROPIC_MODEL,
    apiVersion: ANTHROPIC_API_VERSION,
  };
}
