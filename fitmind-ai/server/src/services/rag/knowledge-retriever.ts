import {
  listKnowledgeChunks,
  searchKnowledgeChunksByEmbedding,
  type KnowledgeChunkRow,
  type KnowledgeChunkSearchRow,
} from "../../db/knowledge-repository.js";
import { loadServerEnv } from "../../env.js";
import { createVoyageEmbeddingProvider } from "./voyage-embedding-client.js";

export type RetrievedKnowledgeChunk = Omit<KnowledgeChunkRow, "search_text"> & {
  score: number;
  retrieval_mode: "keyword" | "vector" | "hybrid";
};

export interface KnowledgeChunkRepository {
  listKnowledgeChunks: () => Promise<KnowledgeChunkRow[]>;
  searchKnowledgeChunksByEmbedding?: (
    embedding: number[],
    limit: number,
  ) => Promise<KnowledgeChunkSearchRow[]>;
}

export interface KnowledgeEmbeddingProvider {
  embedQuery: (query: string) => Promise<number[]>;
}

export interface RetrieveKnowledgeChunksOptions {
  repository?: KnowledgeChunkRepository | undefined;
  embeddingProvider?: KnowledgeEmbeddingProvider | null | undefined;
}

const HYBRID_VECTOR_WEIGHT = 0.7;
const HYBRID_KEYWORD_WEIGHT = 0.3;

export function tokenizeKnowledgeQuery(input: string): string[] {
  const normalizedInput = input.trim().toLowerCase();
  const tokens = new Set<string>();

  if (/\bpre\b/iu.test(normalizedInput)) {
    tokens.add("rpe");
  }

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
      retrieval_mode: "keyword" as const,
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

function toRetrievedKnowledgeChunks(
  chunks: KnowledgeChunkSearchRow[],
): RetrievedKnowledgeChunk[] {
  return chunks.map((chunk) => ({
    id: chunk.id,
    title: chunk.title,
    category: chunk.category,
    chunk_text: chunk.chunk_text,
    source_type: chunk.source_type,
    tags: chunk.tags,
    score: chunk.score,
    retrieval_mode: "vector",
  }));
}

function normalizeByMax(score: number, maxScore: number): number {
  if (maxScore <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, score / maxScore));
}

function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}

export function rankHybridKnowledgeChunks(input: {
  vectorChunks: KnowledgeChunkSearchRow[];
  keywordChunks: RetrievedKnowledgeChunk[];
  limit?: number | undefined;
}): RetrievedKnowledgeChunk[] {
  const limit = input.limit ?? 3;
  const vectorMax = Math.max(0, ...input.vectorChunks.map((chunk) => chunk.score));
  const keywordMax = Math.max(
    0,
    ...input.keywordChunks.map((chunk) => chunk.score),
  );
  const candidates = new Map<
    string,
    {
      chunk: Omit<KnowledgeChunkRow, "search_text">;
      vectorScore: number;
      keywordScore: number;
    }
  >();

  for (const chunk of input.vectorChunks) {
    candidates.set(chunk.id, {
      chunk: {
        id: chunk.id,
        title: chunk.title,
        category: chunk.category,
        chunk_text: chunk.chunk_text,
        source_type: chunk.source_type,
        tags: chunk.tags,
      },
      vectorScore: normalizeByMax(chunk.score, vectorMax),
      keywordScore: 0,
    });
  }

  for (const chunk of input.keywordChunks) {
    const candidate = candidates.get(chunk.id);

    if (candidate === undefined) {
      candidates.set(chunk.id, {
        chunk: {
          id: chunk.id,
          title: chunk.title,
          category: chunk.category,
          chunk_text: chunk.chunk_text,
          source_type: chunk.source_type,
          tags: chunk.tags,
        },
        vectorScore: 0,
        keywordScore: normalizeByMax(chunk.score, keywordMax),
      });
    } else {
      candidate.keywordScore = normalizeByMax(chunk.score, keywordMax);
    }
  }

  return [...candidates.values()]
    .map((candidate) => ({
      ...candidate.chunk,
      score: roundScore(
        HYBRID_VECTOR_WEIGHT * candidate.vectorScore +
          HYBRID_KEYWORD_WEIGHT * candidate.keywordScore,
      ),
      retrieval_mode: "hybrid" as const,
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

function createDefaultEmbeddingProvider(): KnowledgeEmbeddingProvider | null {
  const env = loadServerEnv();

  if (env.voyageApiKey === undefined) {
    return null;
  }

  return createVoyageEmbeddingProvider(env.voyageApiKey);
}

async function tryRetrieveWithEmbeddings(input: {
  query: string;
  limit: number;
  repository: KnowledgeChunkRepository;
  embeddingProvider: KnowledgeEmbeddingProvider | null;
}): Promise<KnowledgeChunkSearchRow[]> {
  if (
    input.embeddingProvider === null ||
    input.repository.searchKnowledgeChunksByEmbedding === undefined
  ) {
    return [];
  }

  try {
    const queryEmbedding = await input.embeddingProvider.embedQuery(input.query);
    const chunks = await input.repository.searchKnowledgeChunksByEmbedding(
      queryEmbedding,
      input.limit,
    );

    return chunks;
  } catch {
    return [];
  }
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
    searchKnowledgeChunksByEmbedding: (embedding, limit) =>
      searchKnowledgeChunksByEmbedding({
        embedding,
        limit,
      }),
  };
  const embeddingProvider =
    resolvedOptions.embeddingProvider === undefined
      ? createDefaultEmbeddingProvider()
      : resolvedOptions.embeddingProvider;
  const vectorChunks = await tryRetrieveWithEmbeddings({
    query,
    limit: Math.max(limit * 4, 10),
    repository,
    embeddingProvider,
  });
  const chunks = await repository.listKnowledgeChunks();

  if (vectorChunks.length > 0) {
    const keywordChunks = rankKnowledgeChunks(
      chunks,
      query,
      Math.max(limit * 4, 10),
    );
    const hybridChunks = rankHybridKnowledgeChunks({
      vectorChunks,
      keywordChunks,
      limit,
    });

    if (hybridChunks.length > 0) {
      return hybridChunks;
    }

    return toRetrievedKnowledgeChunks(vectorChunks).slice(0, limit);
  }

  return rankKnowledgeChunks(chunks, query, limit);
}
