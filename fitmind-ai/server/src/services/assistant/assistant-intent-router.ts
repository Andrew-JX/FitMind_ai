export type AssistantRoutedIntent =
  | "summary"
  | "progress"
  | "imbalance"
  | "recommendation"
  | "exercise_history"
  | "evidence"
  | "knowledge"
  | "mixed_tool_rag"
  | "unsupported";

export interface AssistantIntentClassification {
  intent: AssistantRoutedIntent;
  reason: string;
}

const UNSUPPORTED_PATTERN = /天气|笑话|新闻|股票|彩票|电影|音乐|旅游/u;
const KNOWLEDGE_PATTERN =
  /是什么|什么意思|怎么理解|原理|动作要点|常见错误|RPE|训练容量|训练量|渐进超负荷|deload|减量周|膝盖内扣|肩推|引体向上/u;
const PROGRESS_PATTERN = /进步|没进步|停滞|平台|1RM|最大重量|卧推|深蹲|硬拉/u;
const SUMMARY_PATTERN = /训练量|这周|本周|最近|总结|够吗|频率/u;
const IMBALANCE_PATTERN = /偏科|练太多|太少|均衡|胸|背|腿|肩/u;
const RECOMMENDATION_PATTERN = /今天|下次|练什么|适合练|建议/u;
const HISTORY_PATTERN = /上次|什么时候|历史|记录/u;
const EVIDENCE_PATTERN = /根据什么|依据|为什么|证据|判断/u;

export function classifyAssistantIntent(
  message: string,
): AssistantIntentClassification {
  const normalizedMessage = message.trim();

  if (!normalizedMessage || UNSUPPORTED_PATTERN.test(normalizedMessage)) {
    return {
      intent: "unsupported",
      reason: "The question is outside the training assistant scope.",
    };
  }

  const asksKnowledge = KNOWLEDGE_PATTERN.test(normalizedMessage);
  if (asksKnowledge && PROGRESS_PATTERN.test(normalizedMessage)) {
    return {
      intent: "mixed_tool_rag",
      reason:
        "The question needs both user training data and training knowledge.",
    };
  }

  if (EVIDENCE_PATTERN.test(normalizedMessage)) {
    return {
      intent: "evidence",
      reason: "The question asks how the assistant reached its judgement.",
    };
  }

  if (HISTORY_PATTERN.test(normalizedMessage)) {
    return {
      intent: "exercise_history",
      reason: "The question asks about previous training records.",
    };
  }

  if (PROGRESS_PATTERN.test(normalizedMessage)) {
    return {
      intent: "progress",
      reason: "The question asks about exercise progress or plateau.",
    };
  }

  if (IMBALANCE_PATTERN.test(normalizedMessage)) {
    return {
      intent: "imbalance",
      reason: "The question asks about training balance.",
    };
  }

  if (RECOMMENDATION_PATTERN.test(normalizedMessage)) {
    return {
      intent: "recommendation",
      reason: "The question asks for next training focus.",
    };
  }

  if (SUMMARY_PATTERN.test(normalizedMessage)) {
    return {
      intent: "summary",
      reason: "The question asks for a training summary.",
    };
  }

  if (asksKnowledge) {
    return {
      intent: "knowledge",
      reason: "The question asks for general training knowledge.",
    };
  }

  return {
    intent: "unsupported",
    reason: "No supported training intent matched.",
  };
}
