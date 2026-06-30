import { loadServerEnv } from "../../env.js";

export interface AnthropicProviderConfig {
  apiKey: string;
  model: string;
  apiVersion: string;
}

export interface GroqProviderConfig {
  provider: "groq";
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface OpenAiCompatibleProviderConfig {
  provider: "groq" | "openai_compatible";
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type AssistantProviderName =
  | "mock"
  | "anthropic"
  | "groq"
  | "openai_compatible";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const ANTHROPIC_API_VERSION = "2023-06-01";
/** Groq's OpenAI-compatible API root; the chat client appends `/chat/completions`. */
export const GROQ_OPENAI_COMPATIBLE_BASE_URL = "https://api.groq.com/openai/v1";
/** Default Groq model (OpenAI-compatible, tool-calling capable, free tier); overridable via GROQ_MODEL. */
export const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

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

/**
 * Build the runtime config required for the Groq provider adapter.
 *
 * @returns Normalized Groq provider config.
 */
export function getGroqAssistantProviderConfig(): GroqProviderConfig {
  const env = loadServerEnv();

  if (env.groqApiKey === undefined) {
    throw new Error("GROQ_API_KEY is required when ASSISTANT_PROVIDER=groq.");
  }

  return {
    provider: "groq",
    baseUrl: GROQ_OPENAI_COMPATIBLE_BASE_URL,
    apiKey: env.groqApiKey,
    model: env.groqModel ?? GROQ_DEFAULT_MODEL,
  };
}

/**
 * Build the runtime config for a user-supplied OpenAI-compatible endpoint.
 *
 * @returns Normalized OpenAI-compatible provider config.
 */
export function getOpenAiCompatibleProviderConfig(): OpenAiCompatibleProviderConfig {
  const env = loadServerEnv();

  if (env.openAiCompatBaseUrl === undefined) {
    throw new Error(
      "OPENAI_COMPAT_BASE_URL must be a valid https URL when provider=openai_compatible.",
    );
  }

  if (env.openAiCompatModel === undefined) {
    throw new Error(
      "OPENAI_COMPAT_MODEL is required when provider=openai_compatible.",
    );
  }

  if (env.openAiCompatApiKey === undefined) {
    throw new Error(
      "OPENAI_COMPAT_API_KEY is required when provider=openai_compatible.",
    );
  }

  return {
    provider: "openai_compatible",
    baseUrl: env.openAiCompatBaseUrl,
    apiKey: env.openAiCompatApiKey,
    model: env.openAiCompatModel,
  };
}
