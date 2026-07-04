import { describe, expect, it } from "vitest";

import {
  listKnowledgeChunks,
  listKnowledgeChunksMissingEmbeddings,
  searchKnowledgeChunksByEmbedding,
  updateKnowledgeChunkEmbedding,
  upsertKnowledgeChunk,
  upsertKnowledgeDocument,
} from "./knowledge-repository.js";

describe("listKnowledgeChunks", () => {
  it("maps joined knowledge rows without leaking document ids", async () => {
    const rows = [
      {
        id: "chunk-1",
        document_id: "document-1",
        title: "RPE 主观用力程度",
        category: "training_concept",
        chunk_text: "RPE 用来描述一组训练距离力竭还有多远。",
        source_type: "seed",
        tags: ["RPE", "强度"],
        search_text: "RPE 主观用力程度 training_concept 强度",
      },
    ];

    const chunks = await listKnowledgeChunks({
      pool: {
        query: async () => ({ rows }),
      },
    });

    expect(chunks).toEqual([
      {
        id: "chunk-1",
        title: "RPE 主观用力程度",
        category: "training_concept",
        chunk_text: "RPE 用来描述一组训练距离力竭还有多远。",
        source_type: "seed",
        tags: ["RPE", "强度"],
        search_text: "RPE 主观用力程度 training_concept 强度",
      },
    ]);
    expect(chunks[0]).not.toHaveProperty("document_id");
  });
});

describe("searchKnowledgeChunksByEmbedding", () => {
  it("maps vector search rows into source rows with similarity scores", async () => {
    const queries: Array<{ sql: string; params?: readonly unknown[] }> = [];
    const rows = [
      {
        id: "chunk-1",
        title: "RPE 涓昏鐢ㄥ姏绋嬪害",
        category: "training_concept",
        chunk_text: "RPE chunk",
        source_type: "seed",
        tags: ["RPE"],
        search_text: "RPE chunk",
        score: 0.91,
      },
    ];

    const chunks = await searchKnowledgeChunksByEmbedding({
      embedding: [0.1, 0.2, 0.3],
      limit: 1,
      pool: {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return { rows };
        },
      },
    });

    expect(chunks).toEqual([
      {
        id: "chunk-1",
        title: "RPE 涓昏鐢ㄥ姏绋嬪害",
        category: "training_concept",
        chunk_text: "RPE chunk",
        source_type: "seed",
        tags: ["RPE"],
        search_text: "RPE chunk",
        score: 0.91,
      },
    ]);
    expect(queries[0]?.sql).toContain("embedding <=> $1::vector");
    expect(queries[0]?.params).toEqual(["[0.1,0.2,0.3]", 1]);
  });
});

describe("embedding backfill repository helpers", () => {
  it("lists chunks missing the configured embedding model", async () => {
    const rows = [
      {
        id: "chunk-1",
        title: "RPE",
        category: "training_concept",
        chunk_text: "RPE chunk",
        source_type: "seed",
        tags: ["RPE"],
        search_text: "RPE training_concept RPE chunk",
      },
    ];

    const chunks = await listKnowledgeChunksMissingEmbeddings({
      model: "voyage-4-lite",
      pool: {
        query: async () => ({ rows }),
      },
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.id).toBe("chunk-1");
  });

  it("updates a chunk embedding with vector text and model metadata", async () => {
    const calls: Array<{ sql: string; params?: readonly unknown[] }> = [];

    await updateKnowledgeChunkEmbedding({
      id: "chunk-1",
      embedding: [0.1, 0.2],
      model: "voyage-4-lite",
      pool: {
        query: async (sql, params) => {
          calls.push({ sql, params });
          return { rows: [] };
        },
      },
    });

    expect(calls[0]?.sql).toContain("embedding = $2::vector");
    expect(calls[0]?.params).toEqual(["chunk-1", "[0.1,0.2]", "voyage-4-lite"]);
  });
});

describe("knowledge ingestion repository helpers", () => {
  it("upserts knowledge documents by stable slug", async () => {
    const calls: Array<{ sql: string; params?: readonly unknown[] }> = [];

    const document = await upsertKnowledgeDocument({
      slug: "bench-plateau",
      title: "Bench plateau",
      category: "exercise_progress",
      sourceType: "imported",
      pool: {
        query: async (sql, params) => {
          calls.push({ sql, params });
          return {
            rows: [
              {
                id: "document-1",
                slug: "bench-plateau",
                title: "Bench plateau",
                category: "exercise_progress",
                source_type: "imported",
              },
            ],
          };
        },
      },
    });

    expect(document.id).toBe("document-1");
    expect(calls[0]?.sql).toContain("ON CONFLICT (slug) DO UPDATE");
    expect(calls[0]?.params).toEqual([
      "bench-plateau",
      "Bench plateau",
      "exercise_progress",
      "imported",
    ]);
  });

  it("upserts knowledge chunks by document and chunk index without clearing embeddings", async () => {
    const calls: Array<{ sql: string; params?: readonly unknown[] }> = [];

    const chunk = await upsertKnowledgeChunk({
      documentId: "document-1",
      chunkIndex: 0,
      chunkText: "Bench plateau chunk",
      tags: ["bench", "plateau"],
      searchText: "Bench plateau chunk bench plateau",
      pool: {
        query: async (sql, params) => {
          calls.push({ sql, params });
          return { rows: [{ id: "chunk-1" }] };
        },
      },
    });

    expect(chunk.id).toBe("chunk-1");
    expect(calls[0]?.sql).toContain(
      "ON CONFLICT (document_id, chunk_index) DO UPDATE",
    );
    expect(calls[0]?.sql).not.toContain("embedding =");
    expect(calls[0]?.params).toEqual([
      "document-1",
      0,
      "Bench plateau chunk",
      JSON.stringify(["bench", "plateau"]),
      "Bench plateau chunk bench plateau",
    ]);
  });
});
