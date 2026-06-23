import { loadServerEnv } from "../../env.js";

export interface AnthropicProviderConfig {
  apiKey: string;
  model: string;
  apiVersion: string;
}

export interface GroqProviderConfig {
  apiKey: string;
  model: string;
}

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const ANTHROPIC_API_VERSION = "2023-06-01";
/** Default Groq model (OpenAI-compatible, tool-calling capable, free tier); overridable via GROQ_MODEL. */
const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

/**
 * Read the configured assistant provider selection.
 *
 * @returns The current assistant provider name.
 */
export function getConfiguredAssistantProvider(): "mock" | "anthropic" | "groq" {
  return loadServerEnv().assistantProvider;
}

/**
 * Whether LLM answer-summary re-phrasing (Slice 11.3b) is active.
 *
 * Requires both the opt-in `ASSISTANT_PHRASING` flag and a real model provider
 * (`ASSISTANT_PROVIDER=groq`); under mock/anthropic it stays off so the default
 * path is unchanged. Runtime faithfulness still gates the phrased text.
 *
 * @returns True when phrasing should be attempted this turn.
 */
export function isAssistantAnswerPhrasingEnabled(): boolean {
  const env = loadServerEnv();

  return env.assistantPhrasing && env.assistantProvider === "groq";
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
    apiKey: env.groqApiKey,
    model: env.groqModel ?? GROQ_DEFAULT_MODEL,
  };
}
