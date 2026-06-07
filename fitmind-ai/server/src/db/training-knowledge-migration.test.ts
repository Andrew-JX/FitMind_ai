import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("training knowledge migration", () => {
  it("uses a raw jsonb expression for empty chunk tags", async () => {
    const source = await readFile(
      resolve(
        process.cwd(),
        "server/migrations/20260606090000_create_training_knowledge_tables.js",
      ),
      "utf8",
    );

    expect(source).toContain(`default: pgm.func("'[]'::jsonb")`);
    expect(source).not.toContain(`default: "'[]'::jsonb"`);
  });

  it("adds pgvector-backed nullable embedding columns in the vector migration", async () => {
    const source = await readFile(
      resolve(
        process.cwd(),
        "server/migrations/20260607090000_add_knowledge_chunk_embeddings.js",
      ),
      "utf8",
    );

    expect(source).toContain("CREATE EXTENSION IF NOT EXISTS vector");
    expect(source).toContain('type: "vector(1024)"');
    expect(source).toContain("embedding_model");
    expect(source).toContain("embedded_at");
    expect(source).not.toContain("USING hnsw");
    expect(source).not.toContain("USING ivfflat");
  });
});
