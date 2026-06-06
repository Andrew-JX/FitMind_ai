import {
  trainingKnowledgeChunks,
  type TrainingKnowledgeChunk,
} from "./training-knowledge-corpus.js";

export type RetrievedKnowledgeChunk = TrainingKnowledgeChunk & {
  score: number;
};

function tokenize(input: string): string[] {
  const normalizedInput = input.trim().toLowerCase();
  const tokens = new Set<string>();

  for (const match of normalizedInput.matchAll(/[a-z0-9]+/giu)) {
    tokens.add(match[0].toLowerCase());
  }

  for (const phrase of [
    "rpe",
    "训练容量",
    "训练量",
    "渐进超负荷",
    "卧推",
    "没进步",
    "停滞",
    "deload",
    "减量周",
    "深蹲",
    "膝盖内扣",
    "肩推",
    "引体向上",
    "疲劳",
    "恢复",
  ]) {
    if (normalizedInput.includes(phrase.toLowerCase())) {
      tokens.add(phrase.toLowerCase());
    }
  }

  return [...tokens];
}

function scoreChunk(
  chunk: TrainingKnowledgeChunk,
  queryTokens: string[],
): number {
  const haystack = [
    chunk.title,
    chunk.category,
    chunk.chunk_text,
    ...chunk.tags,
  ]
    .join(" ")
    .toLowerCase();

  return queryTokens.reduce(
    (score, token) => score + (haystack.includes(token) ? 1 : 0),
    0,
  );
}

export function retrieveKnowledgeChunks(
  query: string,
  limit = 3,
): RetrievedKnowledgeChunk[] {
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    return [];
  }

  return trainingKnowledgeChunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(chunk, queryTokens),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
