/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * Add pgvector embeddings to training knowledge chunks.
 *
 * The first vector retrieval batch intentionally uses exact cosine search
 * instead of HNSW / IVFFlat because the current seed corpus is small.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 * @returns {void}
 */
export const up = (pgm) => {
  pgm.sql("CREATE EXTENSION IF NOT EXISTS vector");

  pgm.addColumns("knowledge_chunks", {
    embedding: {
      type: "vector(1024)",
    },
    embedding_model: {
      type: "varchar(80)",
    },
    embedded_at: {
      type: "timestamptz",
    },
  });
};

/**
 * Roll back training knowledge embeddings.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 * @returns {void}
 */
export const down = (pgm) => {
  pgm.dropColumns("knowledge_chunks", [
    "embedding",
    "embedding_model",
    "embedded_at",
  ]);
};
