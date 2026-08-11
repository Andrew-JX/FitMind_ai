import { loadServerEnv } from "../../env.js";

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

/** Groq's OpenAI-compatible API root; the chat client appends `/chat/completions`. */
export const GROQ_OPENAI_COMPATIBLE_BASE_URL = "https://api.groq.com/openai/v1";
/** Default Groq model (OpenAI-compatible, tool-calling capable, free tier); overridable via GROQ_MODEL. */
export const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

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
