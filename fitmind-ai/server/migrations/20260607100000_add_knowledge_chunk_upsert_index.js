/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
export function up(pgm) {
  pgm.createIndex("knowledge_chunks", ["document_id", "chunk_index"], {
    name: "idx_knowledge_chunks_document_chunk_index_unique",
    unique: true,
  });
}

/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
export function down(pgm) {
  pgm.dropIndex("knowledge_chunks", ["document_id", "chunk_index"], {
    name: "idx_knowledge_chunks_document_chunk_index_unique",
  });
}
