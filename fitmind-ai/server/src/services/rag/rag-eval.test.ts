import { describe, expect, it } from "vitest";

import { evaluateRagCases, ragEvalCases } from "./rag-eval.js";

describe("RAG eval", () => {
  it("contains deterministic coverage for production RAG topics", () => {
    expect(ragEvalCases.length).toBeGreaterThanOrEqual(15);
    expect(ragEvalCases.length).toBeLessThanOrEqual(25);
    expect(ragEvalCases.map((testCase) => testCase.topic)).toEqual(
      expect.arrayContaining([
        "rpe",
        "bench_plateau",
        "volume",
        "deload",
        "recovery",
        "progressive_overload",
        "technique",
        "unsupported",
      ]),
    );
  });

  it("passes when expected sources are present and unsupported cases return none", async () => {
    const result = await evaluateRagCases(
      [
        {
          id: "knowledge-rpe",
          topic: "rpe",
          question: "What is RPE?",
          expectedSourceIncludes: "RPE",
        },
        {
          id: "unsupported-joke",
          topic: "unsupported",
          question: "Tell me a joke",
          unsupported: true,
        },
      ],
      async (question) =>
        question.includes("joke")
          ? []
          : [
              {
                title: "RPE scale",
                retrieval_mode: "hybrid",
              },
            ],
    );

    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("fails when an expected source is missing from the top three", async () => {
    const result = await evaluateRagCases(
      [
        {
          id: "knowledge-rpe",
          topic: "rpe",
          question: "What is RPE?",
          expectedSourceIncludes: "RPE",
        },
      ],
      async () => [{ title: "Deload", retrieval_mode: "keyword" }],
    );

    expect(result.passed).toBe(false);
    expect(result.failures[0]).toContain("knowledge-rpe");
  });
});
