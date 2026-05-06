import { loadServerEnv } from "../../env.js";

export interface AnthropicProviderConfig {
  apiKey: string;
  model: string;
  apiVersion: string;
}

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const ANTHROPIC_API_VERSION = "2023-06-01";

/**
 * Read the configured assistant provider selection.
 *
 * @returns The current assistant provider name.
 */
export function getConfiguredAssistantProvider(): "mock" | "anthropic" {
  return loadServerEnv().assistantProvider;
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
