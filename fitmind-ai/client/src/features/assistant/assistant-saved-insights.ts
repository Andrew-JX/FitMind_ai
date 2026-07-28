import type { AssistantChatMessage } from "./assistant-types";

export type AssistantSavedInsightType =
  | "weekly_report"
  | "plateau_diagnosis"
  | "next_week_plan";

const ELIGIBLE_INTENTS = new Set<string>([
  "weekly_report",
  "plateau_diagnosis",
  "next_week_plan",
]);

export function isAssistantMessageSaveEligible(
  message: AssistantChatMessage,
): message is AssistantChatMessage & {
  intent: AssistantSavedInsightType;
  messageId: string;
} {
  return (
    message.role === "assistant" &&
    !message.isStreaming &&
    // A clarification is half an answer: it asks the user for an entity rather
    // than reporting anything. Saving one would put a question in the insight
    // library. (ER-1C)
    message.clarification === undefined &&
    typeof message.messageId === "string" &&
    typeof message.intent === "string" &&
    ELIGIBLE_INTENTS.has(message.intent)
  );
}

export function getAssistantInsightTypeLabel(
  type: AssistantSavedInsightType | string | undefined,
): string {
  switch (type) {
    case "weekly_report":
      return "本周训练报告";
    case "plateau_diagnosis":
      return "平台期诊断";
    case "next_week_plan":
      return "下周训练草案";
    default:
      return "训练洞察";
  }
}

export function buildAssistantInsightCopyText(
  message: AssistantChatMessage,
): string {
  const sourceLines =
    message.sources && message.sources.length > 0
      ? message.sources.map((source) =>
          source.category
            ? `- ${source.title} (${source.category})`
            : `- ${source.title}`,
        )
      : ["- 无"];
  const limitationLines =
    message.limitations && message.limitations.length > 0
      ? message.limitations.map((limitation) => `- ${limitation}`)
      : ["- 无"];

  return [
    "FitMind Insight",
    `类型：${getAssistantInsightTypeLabel(message.intent)}`,
    "",
    "总结：",
    message.text,
    "",
    "Evidence:",
    `- 训练：${message.evidence?.workoutIds.length ?? 0}`,
    `- 组数：${message.evidence?.setIds.length ?? 0}`,
    `- 工具：${message.evidence?.toolNames.join("、") || "无"}`,
    "",
    "Sources:",
    ...sourceLines,
    "",
    "限制：",
    ...limitationLines,
  ].join("\n");
}
