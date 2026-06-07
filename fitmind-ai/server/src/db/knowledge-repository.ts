import { createRequire } from "node:module";

import { loadServerEnv } from "../env.js";

interface DbPoolLike {
  query: (
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: unknown[] }>;
  end?: () => Promise<void>;
}

export interface KnowledgeChunkRow {
  id: string;
  title: string;
  category: string;
  chunk_text: string;
  source_type: "seed";
  tags: string[];
  search_text: string;
}

export interface KnowledgeChunkSearchRow extends KnowledgeChunkRow {
  score: number;
}

interface JoinedKnowledgeChunkRow extends KnowledgeChunkRow {
  document_id?: string;
}

export interface ListKnowledgeChunksOptions {
  pool?: DbPoolLike | undefined;
}

export interface SearchKnowledgeChunksByEmbeddingInput {
  embedding: number[];
  limit: number;
  pool?: DbPoolLike | undefined;
}

export interface ListKnowledgeChunksMissingEmbeddingsInput {
  model: string;
  pool?: DbPoolLike | undefined;
}

export interface UpdateKnowledgeChunkEmbeddingInput {
  id: string;
  embedding: number[];
  model: string;
  pool?: DbPoolLike | undefined;
}

const require = createRequire(import.meta.url);

async function createRepositoryPool(): Promise<DbPoolLike> {
  const env = loadServerEnv();

  if (env.databaseUrl === undefined) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  const { Pool } = require("pg") as {
    Pool: new (config: { connectionString: string }) => DbPoolLike;
  };

  return new Pool({
    connectionString: env.databaseUrl,
  });
}

function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags.filter((tag): tag is string => typeof tag === "string");
  }

  return [];
}

function mapKnowledgeChunkRow(row: JoinedKnowledgeChunkRow): KnowledgeChunkRow {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    chunk_text: row.chunk_text,
    source_type: row.source_type,
    tags: normalizeTags(row.tags),
    search_text: row.search_text,
  };
}

function mapKnowledgeChunkSearchRow(
  row: JoinedKnowledgeChunkRow & { score?: unknown },
): KnowledgeChunkSearchRow {
  const mapped = mapKnowledgeChunkRow(row);
  const numericScore =
    typeof row.score === "number" ? row.score : Number(row.score ?? 0);

  return {
    ...mapped,
    score: Number.isFinite(numericScore) ? numericScore : 0,
  };
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export async function listKnowledgeChunks(
  options: ListKnowledgeChunksOptions = {},
): Promise<KnowledgeChunkRow[]> {
  const activePool = options.pool ?? (await createRepositoryPool());
  const ownsPool = options.pool === undefined;

  try {
    const result = await activePool.query(`
      SELECT
        kc.id,
        kc.document_id,
        kd.title,
        kd.category,
        kc.chunk_text,
        kd.source_type,
        kc.tags,
        kc.search_text
      FROM knowledge_chunks kc
      JOIN knowledge_documents kd ON kd.id = kc.document_id
      ORDER BY kd.category ASC, kd.title ASC, kc.chunk_index ASC, kc.id ASC
    `);

    return (result.rows as JoinedKnowledgeChunkRow[]).map(mapKnowledgeChunkRow);
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

export async function searchKnowledgeChunksByEmbedding(
  input: SearchKnowledgeChunksByEmbeddingInput,
): Promise<KnowledgeChunkSearchRow[]> {
  const activePool = input.pool ?? (await createRepositoryPool());
  const ownsPool = input.pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT
          kc.id,
          kc.document_id,
          kd.title,
          kd.category,
          kc.chunk_text,
          kd.source_type,
          kc.tags,
          kc.search_text,
          1 - (kc.embedding <=> $1::vector) AS score
        FROM knowledge_chunks kc
        JOIN knowledge_documents kd ON kd.id = kc.document_id
        WHERE kc.embedding IS NOT NULL
        ORDER BY kc.embedding <=> $1::vector ASC, kd.title ASC, kc.id ASC
        LIMIT $2
      `,
      [toVectorLiteral(input.embedding), input.limit],
    );

    return (result.rows as Array<JoinedKnowledgeChunkRow & { score?: unknown }>).map(
      mapKnowledgeChunkSearchRow,
    );
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

export async function listKnowledgeChunksMissingEmbeddings(
  input: ListKnowledgeChunksMissingEmbeddingsInput,
): Promise<KnowledgeChunkRow[]> {
  const activePool = input.pool ?? (await createRepositoryPool());
  const ownsPool = input.pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT
          kc.id,
          kc.document_id,
          kd.title,
          kd.category,
          kc.chunk_text,
          kd.source_type,
          kc.tags,
          kc.search_text
        FROM knowledge_chunks kc
        JOIN knowledge_documents kd ON kd.id = kc.document_id
        WHERE kc.embedding IS NULL OR kc.embedding_model IS DISTINCT FROM $1
        ORDER BY kd.category ASC, kd.title ASC, kc.chunk_index ASC, kc.id ASC
      `,
      [input.model],
    );

    return (result.rows as JoinedKnowledgeChunkRow[]).map(mapKnowledgeChunkRow);
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

export async function updateKnowledgeChunkEmbedding(
  input: UpdateKnowledgeChunkEmbeddingInput,
): Promise<void> {
  const activePool = input.pool ?? (await createRepositoryPool());
  const ownsPool = input.pool === undefined;

  try {
    await activePool.query(
      `
        UPDATE knowledge_chunks
        SET
          embedding = $2::vector,
          embedding_model = $3,
          embedded_at = now()
        WHERE id = $1
      `,
      [input.id, toVectorLiteral(input.embedding), input.model],
    );
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}
