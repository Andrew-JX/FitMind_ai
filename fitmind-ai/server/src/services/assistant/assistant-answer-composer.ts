import type { AssistantRoutedIntent } from "./assistant-intent-router.js";
import type { RetrievedKnowledgeChunk } from "../rag/knowledge-retriever.js";

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
  source_type: "seed";
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
      "我现在主要能分析你的训练记录、动作进展、训练趋势和基础训练知识。这个问题暂时不在支持范围内。",
    bullets: [
      "可以问我：最近卧推有没有进步、这周训练量够不够、RPE 是什么、我根据什么判断。",
    ],
    conclusion: "这个问题暂时不在 FitMind 训练助手支持范围内。",
    recommendation: "请换成训练记录、动作进展或训练知识相关的问题。",
    evidence: emptyEvidence,
    sources: [],
    intent: "unsupported",
    limitations: ["unsupported 问题不会调用训练工具，也不会生成泛化生活建议。"],
  };
}
