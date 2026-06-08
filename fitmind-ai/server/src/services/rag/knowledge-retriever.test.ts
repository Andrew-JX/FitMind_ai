import { describe, expect, it } from "vitest";

import {
  rankKnowledgeChunks,
  rankHybridKnowledgeChunks,
  retrieveKnowledgeChunks,
  tokenizeKnowledgeQuery,
} from "./knowledge-retriever.js";

const dbRows = [
  {
    id: "chunk-rpe",
    title: "RPE 主观用力程度",
    category: "training_concept",
    chunk_text: "RPE 用来描述一组训练距离力竭还有多远。",
    source_type: "seed" as const,
    tags: ["RPE", "强度", "主观用力程度"],
    search_text: "RPE 主观用力程度 training_concept 强度",
  },
  {
    id: "chunk-bench",
    title: "卧推进步停滞",
    category: "exercise_progress",
    chunk_text: "卧推短期没进步可能和训练容量、恢复或动作技术有关。",
    source_type: "seed" as const,
    tags: ["卧推", "停滞", "训练容量"],
    search_text: "卧推进步停滞 exercise_progress 训练容量",
  },
  {
    id: "chunk-overload",
    title: "渐进超负荷",
    category: "training_principle",
    chunk_text: "渐进超负荷可以通过重量、次数、组数或动作质量提升实现。",
    source_type: "seed" as const,
    tags: ["渐进超负荷", "progressive overload", "进步"],
    search_text: "渐进超负荷 progressive overload 进步",
  },
];

describe("retrieveKnowledgeChunks", () => {
  it("uses hybrid retrieval when an embedding provider and vector repository are available", async () => {
    const chunks = await retrieveKnowledgeChunks("RPE 鏄粈涔堬紵", {
      repository: {
        listKnowledgeChunks: async () => dbRows,
        searchKnowledgeChunksByEmbedding: async (embedding, limit) => {
          expect(embedding).toEqual([0.1, 0.2, 0.3]);
          expect(limit).toBe(12);

          return [
            {
              id: "chunk-rpe",
              title: "RPE 涓昏鐢ㄥ姏绋嬪害",
              category: "training_concept",
              chunk_text: "RPE vector source",
              source_type: "seed" as const,
              tags: ["RPE"],
              search_text: "RPE vector source",
              score: 0.92,
            },
          ];
        },
      },
      embeddingProvider: {
        embedQuery: async (query) => {
          expect(query).toContain("RPE");
          return [0.1, 0.2, 0.3];
        },
      },
    });

    expect(chunks).toEqual([
      {
        id: "chunk-rpe",
        title: "RPE 涓昏鐢ㄥ姏绋嬪害",
        category: "training_concept",
        chunk_text: "RPE vector source",
        source_type: "seed",
        tags: ["RPE"],
        score: 1,
        retrieval_mode: "hybrid",
      },
    ]);
  });

  it("falls back to keyword retrieval when no embedding provider is configured", async () => {
    const chunks = await retrieveKnowledgeChunks("RPE 鏄粈涔堬紵", {
      repository: {
        listKnowledgeChunks: async () => dbRows,
        searchKnowledgeChunksByEmbedding: async () => {
          throw new Error("vector search should not run");
        },
      },
    });

    expect(chunks[0]?.id).toBe("chunk-rpe");
  });

  it("retrieves RPE knowledge sources from a DB-backed repository", async () => {
    const chunks = await retrieveKnowledgeChunks("RPE 是什么？", {
      repository: {
        listKnowledgeChunks: async () => dbRows,
      },
    });

    expect(chunks[0]?.title).toContain("RPE");
    expect(chunks[0]?.chunk_text).toContain("距离力竭");
    expect(chunks[0]?.source_type).toBe("seed");
  });

  it("retrieves plateau and progressive overload sources for mixed bench questions", async () => {
    const chunks = await retrieveKnowledgeChunks("卧推没进步是不是训练量不够？", {
      repository: {
        listKnowledgeChunks: async () => dbRows,
      },
    });
    const joinedTitles = chunks.map((chunk) => chunk.title).join(" ");

    expect(joinedTitles).toContain("卧推");
    expect(joinedTitles).toContain("渐进超负荷");
  });
});

describe("rankHybridKnowledgeChunks", () => {
  it("uses vector-heavy 70/30 normalized scoring", () => {
    const ranked = rankHybridKnowledgeChunks({
      vectorChunks: [
        {
          ...dbRows[0]!,
          score: 0.8,
        },
        {
          ...dbRows[1]!,
          score: 0.4,
        },
      ],
      keywordChunks: [
        {
          ...dbRows[0]!,
          score: 1,
          retrieval_mode: "keyword" as const,
        },
        {
          ...dbRows[1]!,
          score: 2,
          retrieval_mode: "keyword" as const,
        },
      ],
      limit: 2,
    });

    expect(ranked).toEqual([
      expect.objectContaining({
        id: "chunk-rpe",
        score: 0.85,
        retrieval_mode: "hybrid",
      }),
      expect.objectContaining({
        id: "chunk-bench",
        score: 0.65,
        retrieval_mode: "hybrid",
      }),
    ]);
  });
});

describe("tokenizeKnowledgeQuery", () => {
  it("keeps existing keyword coverage for training knowledge questions", () => {
    expect(tokenizeKnowledgeQuery("RPE 是什么？")).toContain("rpe");
    expect(tokenizeKnowledgeQuery("卧推没进步是不是训练量不够？")).toEqual(
      expect.arrayContaining(["卧推", "没进步", "训练量"]),
    );
    expect(tokenizeKnowledgeQuery("deload 减量周")).toEqual(
      expect.arrayContaining(["deload", "减量周"]),
    );
    expect(tokenizeKnowledgeQuery("疲劳恢复怎么判断")).toEqual(
      expect.arrayContaining(["疲劳", "恢复"]),
    );
  });
});

describe("rankKnowledgeChunks", () => {
  it("ranks RPE first for an RPE question", () => {
    const ranked = rankKnowledgeChunks(dbRows, "RPE 是什么？");

    expect(ranked[0]?.id).toBe("chunk-rpe");
    expect(ranked[0]?.score).toBeGreaterThan(0);
    expect(ranked[0]?.retrieval_mode).toBe("keyword");
  });

  it("ranks RPE first for a PRE typo question", () => {
    const ranked = rankKnowledgeChunks(dbRows, "Pre是什么");

    expect(ranked[0]?.id).toBe("chunk-rpe");
    expect(ranked[0]?.score).toBeGreaterThan(0);
  });

  it("ranks bench and progressive overload sources for a mixed bench question", () => {
    const ranked = rankKnowledgeChunks(dbRows, "卧推没进步是不是训练量不够？");

    expect(ranked.map((chunk) => chunk.id)).toEqual([
      "chunk-bench",
      "chunk-overload",
    ]);
  });
});
