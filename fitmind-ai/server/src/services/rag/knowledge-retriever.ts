import {
  listKnowledgeChunks,
  searchKnowledgeChunksByEmbedding,
  type KnowledgeChunkRow,
  type KnowledgeChunkSearchRow,
} from "../../db/knowledge-repository.js";
import { loadServerEnv } from "../../env.js";
import {
  createVoyageEmbeddingProvider,
  RERANK_MODEL,
  rerankWithVoyage,
} from "./voyage-embedding-client.js";

export type RetrievedKnowledgeChunk = Omit<KnowledgeChunkRow, "search_text"> & {
  score: number;
  retrieval_mode: "keyword" | "vector" | "hybrid" | "reranked";
  rerank?: KnowledgeRerankTrace | undefined;
};

export type KnowledgeRetrievalMode = RetrievedKnowledgeChunk["retrieval_mode"];

export interface KnowledgeRerankTrace {
  status: "success" | "fallback";
  model: string | null;
  candidate_count: number;
  total_tokens: number | null;
  estimated_cost_usd: null;
  fallback_reason?:
    | "reranker_unavailable"
    | "reranker_failed"
    | "reranker_empty";
}

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

export interface KnowledgeRerankResult {
  chunks: RetrievedKnowledgeChunk[];
  model: string;
  totalTokens: number | null;
}

export interface KnowledgeReranker {
  rerankKnowledgeChunks: (input: {
    query: string;
    candidates: RetrievedKnowledgeChunk[];
    limit: number;
  }) => Promise<KnowledgeRerankResult>;
}

export interface RetrieveKnowledgeChunksOptions {
  repository?: KnowledgeChunkRepository | undefined;
  embeddingProvider?: KnowledgeEmbeddingProvider | null | undefined;
  reranker?: KnowledgeReranker | null | undefined;
  rerankingEnabled?: boolean | undefined;
}

const HYBRID_VECTOR_WEIGHT = 0.7;
const HYBRID_KEYWORD_WEIGHT = 0.3;
const RERANK_TIMEOUT_MS = 2000;

export function tokenizeKnowledgeQuery(input: string): string[] {
  const normalizedInput = input.trim().toLowerCase();
  const tokens = new Set<string>();

  if (/(?:^|[^a-z0-9])pre(?:$|[^a-z0-9])|^pre/u.test(normalizedInput)) {
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

/**
 * 相关性下限：只保留与查询有**词法重叠**（精选词表 token 出现在 chunk 文本里）的召回结果。
 *
 * 为什么用词法重叠而非向量分数阈值：知识库很小，纯向量召回总会返回"语义最近"的一条，
 * 哪怕主题不相关（如"睡眠"召回"恢复"），导致**自信错答**；而向量分数跨模式语义不一、
 * 还会逐次抖动，阈值不可靠。词法重叠是**确定性**的——chunk 必须真的提到查询里的训练术语，
 * 才算"有据可答"，否则上层应诚实回退到"没找到可靠资料"。
 *
 * @param chunks - 已召回的知识 chunk（任意检索模式）
 * @param query - 用户原始查询
 * @returns 与查询有词法重叠的 chunk 子集（无重叠则为空数组）
 */
export function filterRelevantKnowledgeChunks(
  chunks: RetrievedKnowledgeChunk[],
  query: string,
): RetrievedKnowledgeChunk[] {
  const queryTokens = tokenizeKnowledgeQuery(query);

  if (queryTokens.length === 0) {
    return [];
  }

  return chunks.filter((chunk) => {
    const haystack = [
      chunk.title,
      chunk.category,
      chunk.chunk_text,
      ...chunk.tags,
    ]
      .join(" ")
      .toLowerCase();

    return queryTokens.some((token) => haystack.includes(token));
  });
}

function scoreChunk(chunk: KnowledgeChunkRow, queryTokens: string[]): number {
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
  const vectorMax = Math.max(
    0,
    ...input.vectorChunks.map((chunk) => chunk.score),
  );
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
  const apiKey = env.voyageApiKey;

  if (apiKey === undefined) {
    return null;
  }

  return createVoyageEmbeddingProvider(apiKey);
}

function createChunkRerankDocument(chunk: RetrievedKnowledgeChunk): string {
  return [
    chunk.title,
    chunk.category,
    chunk.tags.join(" "),
    chunk.chunk_text,
  ].join("\n");
}

function createDefaultReranker(enabled: boolean): KnowledgeReranker | null {
  if (!enabled) {
    return null;
  }

  const env = loadServerEnv();
  const apiKey = env.voyageApiKey;

  if (apiKey === undefined) {
    return null;
  }

  return {
    rerankKnowledgeChunks: async (input) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, RERANK_TIMEOUT_MS);

      try {
        const response = await rerankWithVoyage({
          apiKey,
          query: input.query,
          documents: input.candidates.map(createChunkRerankDocument),
          topK: Math.min(input.limit, input.candidates.length),
          signal: controller.signal,
        });
        const rerankedChunks: RetrievedKnowledgeChunk[] = [];

        for (const result of response.results) {
          const candidate = input.candidates[result.index];

          if (candidate !== undefined) {
            rerankedChunks.push({
              ...candidate,
              score: roundScore(result.relevanceScore),
            });
          }
        }

        return {
          chunks: rerankedChunks,
          model: RERANK_MODEL,
          totalTokens: response.totalTokens,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}

function withRerankSuccess(
  chunks: RetrievedKnowledgeChunk[],
  input: {
    model: string;
    candidateCount: number;
    totalTokens: number | null;
  },
): RetrievedKnowledgeChunk[] {
  return chunks.map((chunk) => ({
    ...chunk,
    retrieval_mode: "reranked",
    rerank: {
      status: "success",
      model: input.model,
      candidate_count: input.candidateCount,
      total_tokens: input.totalTokens,
      estimated_cost_usd: null,
    },
  }));
}

function withRerankFallback(
  chunks: RetrievedKnowledgeChunk[],
  input: {
    candidateCount: number;
    fallbackReason: NonNullable<KnowledgeRerankTrace["fallback_reason"]>;
  },
): RetrievedKnowledgeChunk[] {
  return chunks.map((chunk) => ({
    ...chunk,
    rerank: {
      status: "fallback",
      model: null,
      candidate_count: input.candidateCount,
      total_tokens: null,
      estimated_cost_usd: null,
      fallback_reason: input.fallbackReason,
    },
  }));
}

function keepKnownRerankedChunks(
  rerankedChunks: RetrievedKnowledgeChunk[],
  candidates: RetrievedKnowledgeChunk[],
  limit: number,
): RetrievedKnowledgeChunk[] {
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));

  return rerankedChunks
    .filter((chunk) => candidateIds.has(chunk.id))
    .slice(0, limit);
}

async function applyOptionalReranking(input: {
  query: string;
  candidates: RetrievedKnowledgeChunk[];
  limit: number;
  reranker: KnowledgeReranker | null;
}): Promise<RetrievedKnowledgeChunk[]> {
  if (input.candidates.length === 0) {
    return [];
  }

  if (input.reranker === null) {
    return withRerankFallback(input.candidates.slice(0, input.limit), {
      candidateCount: input.candidates.length,
      fallbackReason: "reranker_unavailable",
    });
  }

  try {
    const result = await input.reranker.rerankKnowledgeChunks({
      query: input.query,
      candidates: input.candidates,
      limit: input.limit,
    });
    const knownRerankedChunks = keepKnownRerankedChunks(
      result.chunks,
      input.candidates,
      input.limit,
    );

    if (knownRerankedChunks.length === 0) {
      return withRerankFallback(input.candidates.slice(0, input.limit), {
        candidateCount: input.candidates.length,
        fallbackReason: "reranker_empty",
      });
    }

    return withRerankSuccess(knownRerankedChunks, {
      model: result.model,
      candidateCount: input.candidates.length,
      totalTokens: result.totalTokens,
    });
  } catch {
    return withRerankFallback(input.candidates.slice(0, input.limit), {
      candidateCount: input.candidates.length,
      fallbackReason: "reranker_failed",
    });
  }
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
    const queryEmbedding = await input.embeddingProvider.embedQuery(
      input.query,
    );
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
  const envRerankingEnabled =
    resolvedOptions.rerankingEnabled ?? loadServerEnv().ragRerankingEnabled;
  const reranker =
    resolvedOptions.reranker === undefined
      ? createDefaultReranker(envRerankingEnabled)
      : resolvedOptions.reranker;
  const candidateLimit = Math.max(limit * 4, 10);
  const vectorChunks = await tryRetrieveWithEmbeddings({
    query,
    limit: candidateLimit,
    repository,
    embeddingProvider,
  });
  const chunks = await repository.listKnowledgeChunks();

  if (vectorChunks.length > 0) {
    const keywordChunks = rankKnowledgeChunks(chunks, query, candidateLimit);
    const limitedHybridChunks = rankHybridKnowledgeChunks({
      vectorChunks,
      keywordChunks,
      limit,
    });

    if (!envRerankingEnabled) {
      if (limitedHybridChunks.length > 0) {
        return limitedHybridChunks;
      }

      return toRetrievedKnowledgeChunks(vectorChunks).slice(0, limit);
    }

    const wideHybridChunks = rankHybridKnowledgeChunks({
      vectorChunks,
      keywordChunks,
      limit: candidateLimit,
    });
    const candidates =
      wideHybridChunks.length > 0
        ? wideHybridChunks
        : toRetrievedKnowledgeChunks(vectorChunks).slice(0, candidateLimit);
    const relevantCandidates = filterRelevantKnowledgeChunks(candidates, query);

    return applyOptionalReranking({
      query,
      candidates: relevantCandidates,
      limit,
      reranker,
    });
  }

  if (!envRerankingEnabled) {
    return rankKnowledgeChunks(chunks, query, limit);
  }

  const keywordCandidates = rankKnowledgeChunks(chunks, query, candidateLimit);
  const relevantCandidates = filterRelevantKnowledgeChunks(
    keywordCandidates,
    query,
  );

  return applyOptionalReranking({
    query,
    candidates: relevantCandidates,
    limit,
    reranker,
  });
}
