import { describe, expect, it } from "vitest";

import { retrieveKnowledgeChunks } from "./knowledge-retriever.js";

describe("retrieveKnowledgeChunks", () => {
  it("retrieves RPE knowledge sources from the seeded knowledge corpus", () => {
    const chunks = retrieveKnowledgeChunks("RPE 是什么？");

    expect(chunks[0]?.title).toContain("RPE");
    expect(chunks[0]?.chunk_text).toContain("主观用力程度");
  });

  it("retrieves plateau and progressive overload sources for mixed bench questions", () => {
    const chunks = retrieveKnowledgeChunks("卧推没进步是不是训练量不够？");
    const joinedTitles = chunks.map((chunk) => chunk.title).join(" ");

    expect(joinedTitles).toContain("卧推");
    expect(joinedTitles).toContain("渐进超负荷");
  });
});
