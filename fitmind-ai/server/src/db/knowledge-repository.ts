import { createDbPool } from "./pool.js";

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
  source_type: "seed" | "imported";
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

export interface KnowledgeDocumentRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  source_type: "seed" | "imported";
}

export interface UpsertKnowledgeDocumentInput {
  slug: string;
  title: string;
  category: string;
  sourceType: "seed" | "imported";
  pool?: DbPoolLike | undefined;
}

export interface UpsertKnowledgeChunkInput {
  documentId: string;
  chunkIndex: number;
  chunkText: string;
  tags: string[];
  searchText: string;
  pool?: DbPoolLike | undefined;
}

export interface UpsertKnowledgeChunkResult {
  id: string;
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

function mapKnowledgeDocumentRow(
  row: KnowledgeDocumentRow,
): KnowledgeDocumentRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    source_type: row.source_type,
  };
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export async function listKnowledgeChunks(
  options: ListKnowledgeChunksOptions = {},
): Promise<KnowledgeChunkRow[]> {
  const activePool = options.pool ?? createDbPool();
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
  const activePool = input.pool ?? createDbPool();
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

    return (
      result.rows as Array<JoinedKnowledgeChunkRow & { score?: unknown }>
    ).map(mapKnowledgeChunkSearchRow);
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

export async function listKnowledgeChunksMissingEmbeddings(
  input: ListKnowledgeChunksMissingEmbeddingsInput,
): Promise<KnowledgeChunkRow[]> {
  const activePool = input.pool ?? createDbPool();
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
  const activePool = input.pool ?? createDbPool();
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

export async function upsertKnowledgeDocument(
  input: UpsertKnowledgeDocumentInput,
): Promise<KnowledgeDocumentRow> {
  const activePool = input.pool ?? createDbPool();
  const ownsPool = input.pool === undefined;

  try {
    const result = await activePool.query(
      `
        INSERT INTO knowledge_documents (slug, title, category, source_type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (slug) DO UPDATE
        SET
          title = EXCLUDED.title,
          category = EXCLUDED.category,
          source_type = EXCLUDED.source_type
        RETURNING id, slug, title, category, source_type
      `,
      [input.slug, input.title, input.category, input.sourceType],
    );
    const row = result.rows[0] as KnowledgeDocumentRow | undefined;

    if (row === undefined) {
      throw new Error("Knowledge document upsert did not return a row.");
    }

    return mapKnowledgeDocumentRow(row);
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

export async function upsertKnowledgeChunk(
  input: UpsertKnowledgeChunkInput,
): Promise<UpsertKnowledgeChunkResult> {
  const activePool = input.pool ?? createDbPool();
  const ownsPool = input.pool === undefined;

  try {
    const result = await activePool.query(
      `
        INSERT INTO knowledge_chunks (
          document_id,
          chunk_index,
          chunk_text,
          tags,
          search_text
        )
        VALUES ($1, $2, $3, $4::jsonb, $5)
        ON CONFLICT (document_id, chunk_index) DO UPDATE
        SET
          chunk_text = EXCLUDED.chunk_text,
          tags = EXCLUDED.tags,
          search_text = EXCLUDED.search_text
        RETURNING id
      `,
      [
        input.documentId,
        input.chunkIndex,
        input.chunkText,
        JSON.stringify(input.tags),
        input.searchText,
      ],
    );
    const row = result.rows[0] as { id?: unknown } | undefined;

    if (typeof row?.id !== "string") {
      throw new Error("Knowledge chunk upsert did not return a row.");
    }

    return { id: row.id };
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}
