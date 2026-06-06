import { describe, expect, it } from "vitest";

import { listKnowledgeChunks } from "./knowledge-repository.js";

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
