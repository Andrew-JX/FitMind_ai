import {
  createAssistantSavedInsight,
  deleteAssistantSavedInsightByIdForUser,
  findAssistantSavedInsightByIdForUser,
  listAssistantSavedInsightsForUser,
  type AssistantSavedInsightRow,
} from "../../db/assistant-saved-insights-repository.js";
import {
  findChatMessageByIdForUser,
  hasChatMessageById,
} from "../../db/chat-repository.js";
import { HttpError } from "../../utils/http-error.js";

export type AssistantSavedInsightType =
  | "weekly_report"
  | "plateau_diagnosis"
  | "next_week_plan";

export interface AssistantSavedInsightDto {
  id: string;
  message_id: string | null;
  insight_type: AssistantSavedInsightType;
  title: string;
  summary: string;
  structured_snapshot: AssistantSavedInsightSnapshot;
  share_text: string;
  created_at: string;
  updated_at: string;
}

export interface AssistantSavedInsightSnapshot {
  message_text: string;
  intent: AssistantSavedInsightType;
  evidence: {
    workout_count: number;
    set_count: number;
    tool_names: string[];
    calculation_rule_count: number;
  };
  sources: Array<{
    title: string;
    category: string;
  }>;
  limitations: string[];
  structured_output: {
    intent: AssistantSavedInsightType;
    answer_summary: string;
    answer_bullets: string[];
  };
}

interface AssistantSavedInsightsDependencies {
  createInsight: typeof createAssistantSavedInsight;
  deleteInsight: typeof deleteAssistantSavedInsightByIdForUser;
  findInsight: typeof findAssistantSavedInsightByIdForUser;
  findMessage: typeof findChatMessageByIdForUser;
  hasMessage: typeof hasChatMessageById;
  listInsights: typeof listAssistantSavedInsightsForUser;
}

const defaultDependencies: AssistantSavedInsightsDependencies = {
  createInsight: createAssistantSavedInsight,
  deleteInsight: deleteAssistantSavedInsightByIdForUser,
  findInsight: findAssistantSavedInsightByIdForUser,
  findMessage: findChatMessageByIdForUser,
  hasMessage: hasChatMessageById,
  listInsights: listAssistantSavedInsightsForUser,
};

const ELIGIBLE_INSIGHT_TYPES = new Set<AssistantSavedInsightType>([
  "weekly_report",
  "plateau_diagnosis",
  "next_week_plan",
]);

export async function saveAssistantInsightFromMessage(
  input: { messageId: string; userId: string },
  dependencies: AssistantSavedInsightsDependencies = defaultDependencies,
): Promise<AssistantSavedInsightDto> {
  const message = await dependencies.findMessage(input.messageId, input.userId);

  if (message === null) {
    if (await dependencies.hasMessage(input.messageId)) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "You cannot save another user's assistant message.",
      );
    }

    throw new HttpError(404, "NOT_FOUND", "Assistant message was not found.");
  }

  if (message.role !== "assistant") {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "Only assistant replies can be saved as insights.",
    );
  }

  const output = parseStructuredOutput(message.structured_output);
  const insightType = output.intent;

  if (!ELIGIBLE_INSIGHT_TYPES.has(insightType)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "Only weekly report, plateau diagnosis, and next-week plan replies can be saved.",
    );
  }

  const messageText = extractMessageText(message.content) || output.summary;
  const snapshot = buildAssistantSavedInsightSnapshot({
    intent: insightType,
    messageText,
    output,
  });
  const title = buildInsightTitle(insightType);
  const shareText = buildAssistantInsightShareText({
    summary: output.summary,
    title,
    snapshot,
  });
  const row = await dependencies.createInsight({
    userId: input.userId,
    messageId: input.messageId,
    insightType,
    title,
    summary: output.summary,
    structuredSnapshot: snapshot,
    shareText,
  });

  return mapSavedInsightRow(row);
}

export async function listAssistantSavedInsights(
  userId: string,
  dependencies: AssistantSavedInsightsDependencies = defaultDependencies,
): Promise<AssistantSavedInsightDto[]> {
  const rows = await dependencies.listInsights(userId);

  return rows.map(mapSavedInsightRow);
}

export async function getAssistantSavedInsight(
  input: { id: string; userId: string },
  dependencies: AssistantSavedInsightsDependencies = defaultDependencies,
): Promise<AssistantSavedInsightDto> {
  const row = await dependencies.findInsight(input.id, input.userId);

  if (row === null) {
    throw new HttpError(404, "NOT_FOUND", "Saved insight was not found.");
  }

  return mapSavedInsightRow(row);
}

export async function deleteAssistantSavedInsight(
  input: { id: string; userId: string },
  dependencies: AssistantSavedInsightsDependencies = defaultDependencies,
): Promise<{ deleted: true; id: string }> {
  const deleted = await dependencies.deleteInsight(input.id, input.userId);

  if (!deleted) {
    throw new HttpError(404, "NOT_FOUND", "Saved insight was not found.");
  }

  return {
    deleted: true,
    id: input.id,
  };
}

export function buildAssistantInsightShareText(input: {
  snapshot: AssistantSavedInsightSnapshot;
  summary: string;
  title: string;
}): string {
  const sourceLines =
    input.snapshot.sources.length === 0
      ? ["- 无"]
      : input.snapshot.sources.map((source) =>
          source.category
            ? `- ${source.title} (${source.category})`
            : `- ${source.title}`,
        );
  const limitationLines =
    input.snapshot.limitations.length === 0
      ? ["- 无"]
      : input.snapshot.limitations.map((limitation) => `- ${limitation}`);

  return [
    `FitMind Insight: ${input.title}`,
    `类型：${formatInsightTypeLabel(input.snapshot.intent)}`,
    "",
    "总结：",
    input.summary,
    "",
    "Evidence:",
    `- 训练：${input.snapshot.evidence.workout_count}`,
    `- 组数：${input.snapshot.evidence.set_count}`,
    `- 工具：${input.snapshot.evidence.tool_names.join("、") || "无"}`,
    "",
    "Sources:",
    ...sourceLines,
    "",
    "限制：",
    ...limitationLines,
  ].join("\n");
}

function buildAssistantSavedInsightSnapshot(input: {
  intent: AssistantSavedInsightType;
  messageText: string;
  output: ParsedAssistantOutput;
}): AssistantSavedInsightSnapshot {
  return {
    message_text: input.messageText,
    intent: input.intent,
    evidence: {
      workout_count: input.output.evidence.workout_ids.length,
      set_count: input.output.evidence.set_ids.length,
      tool_names: input.output.evidence.tool_names,
      calculation_rule_count: input.output.evidence.calculation_rules.length,
    },
    sources: input.output.sources.map((source) => ({
      title: source.title,
      category: source.category,
    })),
    limitations: input.output.limitations,
    structured_output: {
      intent: input.intent,
      answer_summary: input.output.summary,
      answer_bullets: input.output.bullets,
    },
  };
}

function buildInsightTitle(insightType: AssistantSavedInsightType): string {
  switch (insightType) {
    case "weekly_report":
      return "本周训练报告";
    case "plateau_diagnosis":
      return "平台期诊断";
    case "next_week_plan":
      return "下周训练草案";
  }
}

function formatInsightTypeLabel(insightType: AssistantSavedInsightType): string {
  return buildInsightTitle(insightType);
}

interface ParsedAssistantOutput {
  intent: AssistantSavedInsightType;
  summary: string;
  bullets: string[];
  evidence: {
    workout_ids: string[];
    set_ids: string[];
    tool_names: string[];
    calculation_rules: string[];
  };
  sources: Array<{
    title: string;
    category: string;
  }>;
  limitations: string[];
}

function parseStructuredOutput(value: unknown): ParsedAssistantOutput {
  const record = asRecord(value);
  const answer = asRecord(record?.answer);
  const rawIntent = stringOrNull(record?.intent) ?? stringOrNull(answer?.intent);

  if (!isAssistantSavedInsightType(rawIntent)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "Assistant reply is not eligible to save as an insight.",
    );
  }

  const evidence = asRecord(answer?.evidence);

  return {
    intent: rawIntent,
    summary:
      stringOrNull(answer?.summary) ??
      stringOrNull(answer?.conclusion) ??
      "Saved assistant insight.",
    bullets: stringArrayOrEmpty(answer?.bullets),
    evidence: {
      workout_ids: stringArrayOrEmpty(evidence?.workout_ids),
      set_ids: stringArrayOrEmpty(evidence?.set_ids),
      tool_names: stringArrayOrEmpty(evidence?.tool_names),
      calculation_rules: stringArrayOrEmpty(evidence?.calculation_rules),
    },
    sources: sourceArrayOrEmpty(answer?.sources),
    limitations: stringArrayOrEmpty(answer?.limitations),
  };
}

function mapSavedInsightRow(
  row: AssistantSavedInsightRow,
): AssistantSavedInsightDto {
  return {
    id: row.id,
    message_id: row.message_id,
    insight_type: row.insight_type,
    title: row.title,
    summary: row.summary,
    structured_snapshot: row.structured_snapshot as AssistantSavedInsightSnapshot,
    share_text: row.share_text,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function extractMessageText(content: unknown): string {
  const blocks = Array.isArray(content) ? content : [];
  const text = blocks
    .map((block) => {
      const record = asRecord(block);

      return stringOrNull(record?.text) ?? "";
    })
    .filter((value) => value.length > 0)
    .join("\n")
    .trim();

  return text;
}

function sourceArrayOrEmpty(value: unknown): Array<{
  title: string;
  category: string;
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = asRecord(item);
      const title = stringOrNull(record?.title);

      if (!title) {
        return null;
      }

      return {
        title,
        category: stringOrNull(record?.category) ?? "",
      };
    })
    .filter((item): item is { title: string; category: string } => item !== null);
}

function stringArrayOrEmpty(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function isAssistantSavedInsightType(
  value: string | null,
): value is AssistantSavedInsightType {
  return (
    value === "weekly_report" ||
    value === "plateau_diagnosis" ||
    value === "next_week_plan"
  );
}
