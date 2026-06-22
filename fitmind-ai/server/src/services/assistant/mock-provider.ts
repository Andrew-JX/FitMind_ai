import { getToolDefinitionForMode } from "./assistant-tool-routing.js";
import type {
  AssistantProvider,
  AssistantProviderRequest,
  AssistantProviderResponse,
} from "./provider-types.js";

function buildToolArgs(
  toolName: string,
  request: AssistantProviderRequest,
): Record<string, string> {
  const baseArgs = {
    start_date: request.assistant_context.start_date,
    end_date: request.assistant_context.end_date,
  };

  if (
    toolName !== "get_exercise_progress" &&
    toolName !== "get_weekly_training_report"
  ) {
    return baseArgs;
  }

  const exerciseIdArgs = {
    ...baseArgs,
    exercise_id: request.assistant_context.exercise_id ?? "",
  };

  if (toolName === "get_weekly_training_report") {
    return request.assistant_context.exercise_id
      ? exerciseIdArgs
      : baseArgs;
  }

  return exerciseIdArgs;
}

function buildSelectExerciseMessage(): AssistantProviderResponse {
  return {
    kind: "message",
    message:
      "如果你想看某个动作的进展、最大重量或估算 1RM，请先去“分析”页选中对应动作，再回来追问。",
  };
}

function buildUnsupportedMessage(): AssistantProviderResponse {
  return {
    kind: "message",
    message:
      "我目前更适合回答这些训练问题：最近训练总览、我今天练什么、我胸练得够吗、我是不是偏科、当前动作进展、AI 根据什么判断。",
  };
}

function buildToolCall(
  toolName: string,
  request: AssistantProviderRequest,
): AssistantProviderResponse {
  return {
    kind: "tool_call",
    tool_name: toolName,
    tool_args: buildToolArgs(toolName, request),
  };
}

/**
 * Slice 11.3a — single-track routing: the mock provider deterministically reflects
 * the mode already resolved by `resolveRoutedIntent` (carried in
 * `assistant_context.mode`) instead of re-classifying the user message. Tool
 * selection comes from the shared `getToolDefinitionForMode` map, so the keyword/LLM
 * router stays the only message→intent classifier. The message text is intentionally
 * ignored here.
 *
 * @param request - The provider-neutral assistant request.
 * @returns A deterministic tool call for the mode, or a guidance message when an
 *   exercise-scoped tool has no selected exercise / the mode is unsupported.
 */
function resolveDefaultIntent(
  request: AssistantProviderRequest,
): AssistantProviderResponse {
  const mode = request.assistant_context.mode;

  if (mode === "unsupported") {
    return buildUnsupportedMessage();
  }

  const toolName = getToolDefinitionForMode(mode).name;

  if (
    toolName === "get_exercise_progress" &&
    !request.assistant_context.exercise_id
  ) {
    return buildSelectExerciseMessage();
  }

  return buildToolCall(toolName, request);
}

export async function runMockProvider(
  request: AssistantProviderRequest,
): Promise<AssistantProviderResponse> {
  switch (request.simulation.scenario) {
    case "message":
      return {
        kind: "message",
        message:
          request.simulation.normalized_message.length > 0
            ? request.simulation.normalized_message
            : "这次没有额外的说明文本。",
      };
    case "error":
      return {
        kind: "error",
        error_code: "MOCK_PROVIDER_ERROR",
        message:
          request.simulation.normalized_message.length > 0
            ? request.simulation.normalized_message
            : "模拟 provider 返回了一个错误。",
      };
    case "default":
      return resolveDefaultIntent(request);
  }
}

export const mockAssistantProvider: AssistantProvider = {
  run: runMockProvider,
};
