import { mockAssistantProvider } from "./mock-provider.js";
import type {
  AssistantProvider,
  AssistantProviderRequest,
  AssistantProviderResponse,
} from "./provider-types.js";

function getAssistantProvider(): AssistantProvider {
  return mockAssistantProvider;
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
  const provider = getAssistantProvider();

  return provider.run(request);
}
