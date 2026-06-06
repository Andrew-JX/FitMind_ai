import { describe, expect, it } from "vitest";

import {
  composeKnowledgeAnswer,
  composeMixedToolRagAnswer,
  composeUnsupportedAnswer,
} from "./assistant-answer-composer.js";
import { retrieveKnowledgeChunks } from "../rag/knowledge-retriever.js";

describe("assistant answer composer", () => {
  it("composes mixed tool and RAG answers with evidence and sources", () => {
    const sources = retrieveKnowledgeChunks("卧推没进步是不是训练量不够？");
    const answer = composeMixedToolRagAnswer({
      message: "卧推没进步是不是训练量不够？",
      sources,
      toolEvidence: {
        source: "deterministic_tool_executor",
        tool_names: ["get_recommendation_context"],
        workout_ids: ["workout-1"],
        set_ids: ["set-1"],
        calculation_rules: ["training_summary_30d"],
      },
    });

    expect(answer.intent).toBe("mixed_tool_rag");
    expect(answer.evidence.tool_names).toContain("get_recommendation_context");
    expect(answer.sources.length).toBeGreaterThan(0);
    expect(answer.summary).toContain("训练记录");
  });

  it("composes knowledge answers with sources but no training evidence", () => {
    const answer = composeKnowledgeAnswer({
      message: "RPE 是什么？",
      sources: retrieveKnowledgeChunks("RPE 是什么？"),
    });

    expect(answer.intent).toBe("knowledge");
    expect(answer.evidence.tool_names).toEqual([]);
    expect(answer.sources[0]?.title).toContain("RPE");
  });

  it("keeps unsupported answers scoped and evidence-free", () => {
    const answer = composeUnsupportedAnswer("明天天气怎么样？");

    expect(answer.intent).toBe("unsupported");
    expect(answer.evidence.tool_names).toEqual([]);
    expect(answer.sources).toEqual([]);
    expect(answer.summary).toContain("训练记录");
  });
});
