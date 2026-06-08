import type {
  AssistantIntentMode,
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

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase();
}

function detectIntentFromMessage(message: string): AssistantIntentMode | null {
  if (
    /(本周训练报告|周训练报告|weekly\s*report|weekly\s*training\s*report|训练报告)/iu.test(
      message,
    )
  ) {
    return "weekly_report";
  }

  if (
    /(平台期|停滞诊断|plateau\s*diagnosis|卧推平台|bench\s*plateau)/iu.test(
      message,
    )
  ) {
    return "plateau_diagnosis";
  }

  if (
    /(下周训练草案|下周训练的草案|下周训练草稿|下周训练的草稿|下周训练草程|下周训练的草程|下周训练计划|下周训练安排|下周计划|下周我怎么练|下周怎么练|下周我练什么|帮我安排下周训练|下周训练建议|给我一个下周训练建议|next[-\s]*week\s*plan|next\s*week\s*draft|训练草案)/iu.test(
      message,
    )
  ) {
    return "next_week_plan";
  }

  if (
    /(ai 根据什么判断|根据什么判断|怎么看我的训练数据|看到了哪些训练数据|recommendation\s*context|training\s*data|evidence)/iu.test(
      message,
    )
  ) {
    return "evidence_explain";
  }

  if (
    /(estimated\s*1rm|1rm|卧推|bench\s*press|barbell\s*bench\s*press|squat|deadlift|极限|最大重量|动作进展|有没有进步|预估我现在的)/iu.test(
      message,
    )
  ) {
    return "exercise_progress";
  }

  if (
    /(今天练什么|应该练什么|下一次训练建议练哪里|今天适合练背吗|下次练什么)/iu.test(
      message,
    )
  ) {
    return "next_training_focus";
  }

  if (
    /(胸练得够吗|背是不是练少了|腿最近有没有练|背练得够吗|腿练得够吗|练得够吗)/iu.test(
      message,
    )
  ) {
    return "muscle_balance";
  }

  if (
    /(偏科|只练胸|训练安排均衡吗|训练是不是不均衡|最近是不是只练)/iu.test(
      message,
    )
  ) {
    return "training_imbalance";
  }

  if (
    /(还能练|练太频繁了|昨天练了.*今天还能练|恢复|今天还能练胸吗|今天还能练吗)/iu.test(
      message,
    )
  ) {
    return "recovery_check";
  }

  if (
    /(最近训练总览|最近练得怎么样|这周练了几次|训练总览|training\s*overview|training\s*summary|recent\s*training)/iu.test(
      message,
    )
  ) {
    return "training_overview";
  }

  return null;
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
  toolName:
    | "get_training_summary"
    | "get_exercise_progress"
    | "get_recommendation_context"
    | "get_weekly_training_report",
  request: AssistantProviderRequest,
): AssistantProviderResponse {
  return {
    kind: "tool_call",
    tool_name: toolName,
    tool_args: buildToolArgs(toolName, request),
  };
}

function resolveIntent(request: AssistantProviderRequest): AssistantIntentMode {
  const normalizedMessage = normalizeMessage(
    request.simulation.normalized_message.length > 0
      ? request.simulation.normalized_message
      : request.conversation.user_message,
  );

  return detectIntentFromMessage(normalizedMessage) ?? "unsupported";
}

function resolveDefaultIntent(
  request: AssistantProviderRequest,
): AssistantProviderResponse {
  const intent = resolveIntent(request);

  if (intent === "exercise_progress") {
    if (!request.assistant_context.exercise_id) {
      return buildSelectExerciseMessage();
    }

    return buildToolCall("get_exercise_progress", request);
  }

  if (intent === "plateau_diagnosis") {
    if (!request.assistant_context.exercise_id) {
      return buildSelectExerciseMessage();
    }

    return buildToolCall("get_exercise_progress", request);
  }

  if (intent === "training_overview") {
    return buildToolCall("get_training_summary", request);
  }

  if (intent === "weekly_report" || intent === "next_week_plan") {
    return buildToolCall("get_weekly_training_report", request);
  }

  if (
    intent === "next_training_focus" ||
    intent === "muscle_balance" ||
    intent === "training_imbalance" ||
    intent === "recovery_check" ||
    intent === "evidence_explain"
  ) {
    return buildToolCall("get_recommendation_context", request);
  }

  return buildUnsupportedMessage();
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
