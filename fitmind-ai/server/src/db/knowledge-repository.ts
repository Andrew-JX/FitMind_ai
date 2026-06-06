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

interface JoinedKnowledgeChunkRow extends KnowledgeChunkRow {
  document_id?: string;
}

export interface ListKnowledgeChunksOptions {
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
