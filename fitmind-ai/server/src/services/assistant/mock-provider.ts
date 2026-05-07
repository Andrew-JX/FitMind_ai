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

  if (toolName !== "get_exercise_progress") {
    return baseArgs;
  }

  return {
    ...baseArgs,
    exercise_id: request.assistant_context.exercise_id ?? "",
  };
}

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase();
}

function mentionsRecommendationContext(message: string): boolean {
  return /(recommendation\s*context|推荐上下文|看到哪些训练数据|ai 会看到哪些训练数据|训练数据)/iu.test(
    message,
  );
}

function mentionsExerciseProgress(message: string): boolean {
  return /(estimated\s*1rm|1rm|极限|最大重量|max\s*weight|卧推|bench\s*press|barbell\s*bench\s*press|深蹲|squat|硬拉|deadlift|进步怎么样)/iu.test(
    message,
  );
}

function mentionsTrainingOverview(message: string): boolean {
  return /(训练总览|最近训练总览|看看我最近练得怎么样|训练量如何|训练量|training\s*overview|training\s*summary|recent\s*training)/iu.test(
    message,
  );
}

function buildSelectExerciseMessage(): AssistantProviderResponse {
  return {
    kind: "message",
    message:
      "如果你想查看某个动作的 1RM、最大重量或最近进展，请先到“分析”页选择对应动作，然后再回来提问。",
  };
}

function resolveDefaultIntent(
  request: AssistantProviderRequest,
): AssistantProviderResponse {
  const normalizedMessage = normalizeMessage(
    request.simulation.normalized_message.length > 0
      ? request.simulation.normalized_message
      : request.conversation.user_message,
  );

  if (mentionsRecommendationContext(normalizedMessage)) {
    return {
      kind: "tool_call",
      tool_name: "get_recommendation_context",
      tool_args: buildToolArgs("get_recommendation_context", request),
    };
  }

  if (
    request.assistant_context.mode === "exercise_progress" ||
    mentionsExerciseProgress(normalizedMessage)
  ) {
    if (!request.assistant_context.exercise_id) {
      return buildSelectExerciseMessage();
    }

    return {
      kind: "tool_call",
      tool_name: "get_exercise_progress",
      tool_args: buildToolArgs("get_exercise_progress", request),
    };
  }

  if (
    request.assistant_context.mode === "recommendation_context" ||
    mentionsRecommendationContext(normalizedMessage)
  ) {
    return {
      kind: "tool_call",
      tool_name: "get_recommendation_context",
      tool_args: buildToolArgs("get_recommendation_context", request),
    };
  }

  if (
    request.assistant_context.mode === "training_overview" ||
    mentionsTrainingOverview(normalizedMessage)
  ) {
    return {
      kind: "tool_call",
      tool_name: "get_training_summary",
      tool_args: buildToolArgs("get_training_summary", request),
    };
  }

  return {
    kind: "tool_call",
    tool_name: "get_training_summary",
    tool_args: buildToolArgs("get_training_summary", request),
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
      return resolveDefaultIntent(request);
  }
}

export const mockAssistantProvider: AssistantProvider = {
  run: runMockProvider,
};
