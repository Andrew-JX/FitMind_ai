import {
  listKnowledgeChunks,
  type KnowledgeChunkRow,
} from "../../db/knowledge-repository.js";

export type RetrievedKnowledgeChunk = Omit<KnowledgeChunkRow, "search_text"> & {
  score: number;
};

export interface KnowledgeChunkRepository {
  listKnowledgeChunks: () => Promise<KnowledgeChunkRow[]>;
}

export interface RetrieveKnowledgeChunksOptions {
  repository?: KnowledgeChunkRepository | undefined;
}

export function tokenizeKnowledgeQuery(input: string): string[] {
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
    "进步",
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
      tokens.add(phrase);
    }
  }

  return [...tokens];
}

function scoreChunk(
  chunk: KnowledgeChunkRow,
  queryTokens: string[],
): number {
  const haystack = [
    chunk.title,
    chunk.category,
    chunk.chunk_text,
    chunk.search_text,
    ...chunk.tags,
  ]
    .join(" ")
    .toLowerCase();

  return queryTokens.reduce(
    (score, token) => score + (haystack.includes(token) ? 1 : 0),
    0,
  );
}

export function rankKnowledgeChunks(
  chunks: KnowledgeChunkRow[],
  query: string,
  limit = 3,
): RetrievedKnowledgeChunk[] {
  const queryTokens = tokenizeKnowledgeQuery(query);

  if (queryTokens.length === 0) {
    return [];
  }

  return chunks
    .map((chunk) => ({
      id: chunk.id,
      title: chunk.title,
      category: chunk.category,
      chunk_text: chunk.chunk_text,
      source_type: chunk.source_type,
      tags: chunk.tags,
      score: scoreChunk(chunk, queryTokens),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.title.localeCompare(right.title);
    })
    .slice(0, limit);
}

export async function retrieveKnowledgeChunks(
  query: string,
  limitOrOptions: number | RetrieveKnowledgeChunksOptions = 3,
  options: RetrieveKnowledgeChunksOptions = {},
): Promise<RetrievedKnowledgeChunk[]> {
  const limit = typeof limitOrOptions === "number" ? limitOrOptions : 3;
  const resolvedOptions =
    typeof limitOrOptions === "number" ? options : limitOrOptions;
  const repository = resolvedOptions.repository ?? {
    listKnowledgeChunks,
  };
  const chunks = await repository.listKnowledgeChunks();

  return rankKnowledgeChunks(chunks, query, limit);
}
