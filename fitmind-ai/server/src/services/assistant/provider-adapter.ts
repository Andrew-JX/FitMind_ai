import { anthropicAssistantProvider } from "./anthropic-provider.js";
import { getConfiguredAssistantProvider } from "./provider-config.js";
import {
  groqAssistantProvider,
  runGroqAnswerPhrasing,
  type AssistantPhrasingInput,
} from "./groq-assistant-provider.js";
import { mockAssistantProvider } from "./mock-provider.js";
import type {
  AssistantProvider,
  AssistantProviderRequest,
  AssistantProviderResponse,
} from "./provider-types.js";

function getAssistantProvider(): AssistantProvider {
  switch (getConfiguredAssistantProvider()) {
    case "anthropic":
      return anthropicAssistantProvider;
    case "groq":
      return groqAssistantProvider;
    default:
      return mockAssistantProvider;
  }
}

function normalizeAdapterError(error: unknown): AssistantProviderResponse {
  return {
    kind: "error",
    error_code: "PROVIDER_ADAPTER_ERROR",
    message:
      error instanceof Error
        ? error.message
        : "Assistant provider adapter failed unexpectedly.",
  };
}

function ensureAllowedTool(
  request: AssistantProviderRequest,
  response: AssistantProviderResponse,
): AssistantProviderResponse {
  if (response.kind !== "tool_call") {
    return response;
  }

  const isAllowed = request.allowed_tools.some(
    (tool) => tool.name === response.tool_name,
  );

  if (isAllowed) {
    return response;
  }

  return {
    kind: "error",
    error_code: "PROVIDER_ADAPTER_ERROR",
    message: `Provider requested unsupported tool ${response.tool_name}.`,
  };
}

/**
 * Run one non-streaming assistant provider call through the configured adapter.
 *
 * @param request - Provider-neutral assistant request.
 * @returns Provider-neutral assistant response.
 */
export async function runAssistantProvider(
  request: AssistantProviderRequest,
): Promise<AssistantProviderResponse> {
  try {
    const provider = getAssistantProvider();
    const response = await provider.run(request);

    return ensureAllowedTool(request, response);
  } catch (error) {
    return normalizeAdapterError(error);
  }
}

/**
 * Re-phrase one answer summary through the configured provider (Slice 11.3b).
 *
 * Only `groq` performs a real re-phrasing call; every other provider (and any
 * failure) returns the original draft summary unchanged, so this is a safe no-op
 * outside the groq path. Faithfulness still validates the result upstream.
 *
 * @param input - The draft summary plus supporting fact lines.
 * @returns The (possibly) re-phrased summary; the draft on any non-groq path or failure.
 */
export async function runAssistantAnswerPhrasing(
  input: AssistantPhrasingInput,
): Promise<string> {
  try {
    if (getConfiguredAssistantProvider() !== "groq") {
      return input.draftSummary;
    }

    return await runGroqAnswerPhrasing(input);
  } catch {
    return input.draftSummary;
  }
}
