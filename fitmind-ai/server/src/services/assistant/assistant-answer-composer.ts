import { z } from "zod";

import type { AssistantRoutedIntent } from "./assistant-intent-router.js";
import type { RetrievedKnowledgeChunk } from "../rag/knowledge-retriever.js";

const assistantExerciseClarificationOptionSchema = z
  .object({
    exercise_id: z.string().uuid(),
    exercise_name: z.string().trim().min(1),
  })
  .strict();

export const assistantClarificationSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("exercise"),
      reason: z.enum(["ambiguous", "unresolved"]),
      options: z.array(assistantExerciseClarificationOptionSchema).max(5),
    })
    .strict(),
  z
    .object({
      kind: z.literal("date_range"),
      reason: z.literal("ambiguous"),
      options: z
        .array(
          z
            .object({
              label: z.string().trim().min(1),
              start_date: z.string().trim().min(1),
              end_date: z.string().trim().min(1),
            })
            .strict(),
        )
        .max(5),
    })
    .strict(),
]);

export type AssistantClarification = z.infer<
  typeof assistantClarificationSchema
>;

export interface AssistantAnswerEvidence {
  source: "deterministic_tool_executor" | "deterministic_mock_provider";
  tool_names: string[];
  workout_ids: string[];
  set_ids: string[];
  calculation_rules: string[];
}

export interface AssistantAnswerSource {
  id: string;
  title: string;
  category: string;
  chunk_text: string;
  source_type: "seed" | "imported";
  tags: string[];
}

export interface AssistantStructuredAnswer {
  summary: string;
  bullets: string[];
  conclusion: string;
  recommendation: string;
  evidence: AssistantAnswerEvidence;
  sources: AssistantAnswerSource[];
  intent: AssistantRoutedIntent;
  limitations: string[];
}

/**
 * Compose an actionable, deterministic exercise clarification answer.
 *
 * @param clarification - Validated exercise clarification payload.
 * @returns Structured answer that does not claim any training evidence.
 */
export function composeExerciseClarificationAnswer(
  clarification: Extract<AssistantClarification, { kind: "exercise" }>,
): AssistantStructuredAnswer {
  const validated = assistantClarificationSchema.parse(clarification);

  if (validated.kind !== "exercise") {
    throw new Error("Exercise clarification composer received a date range.");
  }

  const hasOptions = validated.options.length > 0;
  const summary =
    validated.reason === "ambiguous"
      ? "我找到了多个可能的动作，需要你确认一个后才能继续分析。"
      : "我已经理解你想分析动作，但还需要你告诉我具体动作名。";

  return {
    summary,
    bullets: hasOptions
      ? validated.options.map((option) => option.exercise_name)
      : ["请直接回复完整动作名，例如“杠铃卧推”。"],
    conclusion: "我不会猜测动作，也不会在动作未确认时调用训练分析工具。",
    recommendation: hasOptions
      ? "点一个候选，或直接回复完整动作名即可；不需要去分析页选动作。"
      : "直接回复完整动作名即可；不需要去分析页选动作。",
    evidence: emptyEvidence,
    sources: [],
    intent: "unsupported",
    limitations: ["动作确认完成前不会生成训练数据结论。"],
  };
}

/**
 * Compose a deterministic date clarification answer.
 *
 * @remarks
 * Unlike the exercise clarification, this needs no persisted continuation
 * context: every option carries its own explicit range, and an explicit range
 * is the highest-precedence input a turn can receive. A tapped option and a
 * typed period therefore both resume through the ordinary request path.
 *
 * @param clarification - Validated date-range clarification payload.
 * @returns Structured answer that claims no training evidence.
 */
export function composeDateRangeClarificationAnswer(
  clarification: Extract<AssistantClarification, { kind: "date_range" }>,
): AssistantStructuredAnswer {
  const validated = assistantClarificationSchema.parse(clarification);

  if (validated.kind !== "date_range") {
    throw new Error("Date clarification composer received an exercise.");
  }

  return {
    summary: "你提到了不止一个时间段，需要你确认一个后才能继续分析。",
    bullets: validated.options.map(
      (option) =>
        `${option.label}（${option.start_date} 至 ${option.end_date}）`,
    ),
    conclusion: "我不会替你选时间段，也不会在时间段未确认时调用训练分析工具。",
    recommendation: "点一个时间段，或直接回复其中一个，例如“本周”。",
    evidence: emptyEvidence,
    sources: [],
    intent: "unsupported",
    limitations: ["时间段确认完成前不会生成训练数据结论。"],
  };
}

export const emptyEvidence: AssistantAnswerEvidence = {
  source: "deterministic_mock_provider",
  tool_names: [],
  workout_ids: [],
  set_ids: [],
  calculation_rules: [],
};

function toAnswerSources(
  chunks: RetrievedKnowledgeChunk[],
): AssistantAnswerSource[] {
  return chunks.map((chunk) => ({
    id: chunk.id,
    title: chunk.title,
    category: chunk.category,
    chunk_text: chunk.chunk_text,
    source_type: chunk.source_type,
    tags: chunk.tags,
  }));
}

function formatSourceTitles(sources: AssistantAnswerSource[]): string {
  if (sources.length === 0) {
    return "暂无训练知识来源";
  }

  return sources.map((source) => source.title).join("、");
}

export function composeKnowledgeAnswer(input: {
  message: string;
  sources: RetrievedKnowledgeChunk[];
}): AssistantStructuredAnswer {
  const sources = toAnswerSources(input.sources);
  const firstSource = sources[0];
  const conclusion = firstSource
    ? firstSource.chunk_text
    : "我没有在当前训练知识库里找到足够可靠的资料来回答这个问题。";

  return {
    summary: conclusion,
    bullets: [
      `参考知识：${formatSourceTitles(sources)}`,
      "这是通用训练知识解释，不包含你的个人训练数据判断。",
    ],
    conclusion,
    recommendation:
      "如果你想结合自己的训练记录判断，请继续说明具体动作、时间范围或训练目标。",
    evidence: emptyEvidence,
    sources,
    intent: "knowledge",
    limitations: [
      "当前 RAG 来源来自 DB-backed 训练知识库；通用知识不代表医疗或康复建议。",
    ],
  };
}

export function composeMixedToolRagAnswer(input: {
  message: string;
  sources: RetrievedKnowledgeChunk[];
  toolEvidence: AssistantAnswerEvidence;
}): AssistantStructuredAnswer {
  const sources = toAnswerSources(input.sources);
  const conclusion =
    "我会同时参考你的训练记录和训练知识来判断。训练记录负责回答你最近实际练了什么，训练知识负责解释可能原因。";

  return {
    summary: `${conclusion} 当前回答已绑定 deterministic training evidence，并附上 RAG sources。`,
    bullets: [
      `训练数据依据：${input.toolEvidence.tool_names.join("、") || "暂无工具"}`,
      `参考知识：${formatSourceTitles(sources)}`,
      "如果训练记录较少，结论会更保守，不能把短期波动直接当作长期停滞。",
    ],
    conclusion,
    recommendation:
      "优先看最近几周同一动作的训练频率、训练容量和最高重量变化；如果都没有上升，再考虑调整容量、强度或恢复。",
    evidence: input.toolEvidence,
    sources,
    intent: "mixed_tool_rag",
    limitations: [
      "当前不是医疗或康复建议；动作技术问题仍需要结合实际动作表现。",
    ],
  };
}

export function composeUnsupportedAnswer(
  message: string,
): AssistantStructuredAnswer {
  void message;

  return {
    summary:
      "我可以基于你的训练记录和训练知识，帮你做周训练报告、动作进展分析、平台期诊断和下周训练草案。这个问题我还没识别清楚，你可以换个说法，比如“帮我做本周训练报告”或“卧推平台期怎么诊断？”。",
    bullets: [
      "如果你想看数据复盘，可以问“帮我做一份本周训练报告”。",
      "如果你想看训练问题定位，可以问“卧推平台期怎么诊断？”。",
    ],
    conclusion:
      "FitMind 当前专注于训练记录解释、训练知识 Sources 和可回溯的 Evidence。",
    recommendation:
      "换成周报、动作进展、平台期诊断或下周训练草案相关的问题，我会更有帮助。",
    evidence: emptyEvidence,
    sources: [],
    intent: "unsupported",
    limitations: ["这类问题不会调用训练工具，也不会生成泛化生活建议。"],
  };
}
