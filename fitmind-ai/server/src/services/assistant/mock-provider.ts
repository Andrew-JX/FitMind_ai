import type {
  AssistantProvider,
  AssistantProviderRequest,
  AssistantProviderResponse,
} from "./provider-types.js";

function buildToolArgs(
  request: AssistantProviderRequest,
): Record<string, string> {
  const baseArgs = {
    start_date: request.assistant_context.start_date,
    end_date: request.assistant_context.end_date,
  };

  if (request.assistant_context.mode !== "exercise_progress") {
    return baseArgs;
  }

  return {
    ...baseArgs,
    exercise_id: request.assistant_context.exercise_id ?? "",
  };
}

/**
 * Execute the deterministic mock provider without calling any external model.
 *
 * @param request - Provider-neutral assistant request.
 * @returns Deterministic provider response for the current simulation mode.
 */
export async function runMockProvider(
  request: AssistantProviderRequest,
): Promise<AssistantProviderResponse> {
  switch (request.simulation.scenario) {
    case "message":
      return {
        kind: "message",
        message:
          request.simulation.normalized_message.length > 0
            ? `Deterministic mock provider message: ${request.simulation.normalized_message}`
            : "Deterministic mock provider message: no additional text was provided.",
      };
    case "error":
      return {
        kind: "error",
        error_code: "MOCK_PROVIDER_ERROR",
        message:
          request.simulation.normalized_message.length > 0
            ? `Deterministic mock provider error: ${request.simulation.normalized_message}`
            : "Deterministic mock provider error was requested.",
      };
    case "default":
      return {
        kind: "tool_call",
        tool_name: request.allowed_tools[0]?.name ?? "get_training_summary",
        tool_args: buildToolArgs(request),
      };
  }
}

export const mockAssistantProvider: AssistantProvider = {
  run: runMockProvider,
};
