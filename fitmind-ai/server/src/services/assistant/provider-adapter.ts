import { anthropicAssistantProvider } from "./anthropic-provider.js";
import { getConfiguredAssistantProvider } from "./provider-config.js";
import { mockAssistantProvider } from "./mock-provider.js";
import type {
  AssistantProvider,
  AssistantProviderRequest,
  AssistantProviderResponse,
} from "./provider-types.js";

function getAssistantProvider(): AssistantProvider {
  return getConfiguredAssistantProvider() === "anthropic"
    ? anthropicAssistantProvider
    : mockAssistantProvider;
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
