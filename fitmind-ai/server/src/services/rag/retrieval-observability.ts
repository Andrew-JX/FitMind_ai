import type { AssistantRoutedIntent } from "../assistant/assistant-intent-router.js";
import type {
  KnowledgeRerankTrace,
  RetrievedKnowledgeChunk,
} from "./knowledge-retriever.js";

export type RetrievalLogMode =
  | "keyword"
  | "vector"
  | "hybrid"
  | "reranked"
  | "fallback";

export interface RetrievalLogEventInput {
  intent: AssistantRoutedIntent;
  retrievalMode: RetrievalLogMode;
  sources: Array<Pick<RetrievedKnowledgeChunk, "title" | "score" | "rerank">>;
  fallbackReason?: string | undefined;
}

export interface RetrievalLogEvent {
  event: "rag_retrieval";
  intent: AssistantRoutedIntent;
  retrieval_mode: RetrievalLogMode;
  top_source_titles: string[];
  score_summary: {
    count: number;
    max: number;
    min: number;
  };
  rerank?: KnowledgeRerankTrace | undefined;
  fallback_reason?: string | undefined;
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function buildRetrievalLogEvent(
  input: RetrievalLogEventInput,
): RetrievalLogEvent {
  const scores = input.sources.map((source) => source.score);

  return {
    event: "rag_retrieval",
    intent: input.intent,
    retrieval_mode: input.retrievalMode,
    top_source_titles: input.sources.slice(0, 3).map((source) => source.title),
    score_summary: {
      count: input.sources.length,
      max: scores.length > 0 ? roundScore(Math.max(...scores)) : 0,
      min: scores.length > 0 ? roundScore(Math.min(...scores)) : 0,
    },
    ...(input.sources[0]?.rerank !== undefined
      ? { rerank: input.sources[0].rerank }
      : {}),
    ...(input.fallbackReason !== undefined
      ? { fallback_reason: input.fallbackReason }
      : {}),
  };
}

export function logRetrievalEvent(
  input: RetrievalLogEventInput,
  logger: (message: string) => void = console.info,
): void {
  logger(JSON.stringify(buildRetrievalLogEvent(input)));
}
