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
    expect(result.metrics.top1HitRate).toBe(1);
    expect(result.metrics.top3HitRate).toBe(1);
    expect(result.metrics.mrr).toBe(1);
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
    expect(result.metrics.caseRanks).toEqual([
      {
        id: "knowledge-rpe",
        expectedRank: null,
      },
    ]);
  });

  it("reports top1, top3, MRR, and per-case ranks", async () => {
    const result = await evaluateRagCases(
      [
        {
          id: "top-one",
          topic: "rpe",
          question: "What is RPE?",
          expectedSourceIncludes: "RPE",
        },
        {
          id: "top-three",
          topic: "deload",
          question: "What is deload?",
          expectedSourceIncludes: "Deload",
        },
        {
          id: "missing",
          topic: "volume",
          question: "What is volume?",
          expectedSourceIncludes: "Volume",
        },
      ],
      async (question) => {
        if (question.includes("RPE")) {
          return [{ title: "RPE scale", retrieval_mode: "hybrid" }];
        }

        if (question.includes("deload")) {
          return [
            { title: "RPE scale", retrieval_mode: "hybrid" },
            { title: "Training volume", retrieval_mode: "hybrid" },
            { title: "Deload week", retrieval_mode: "hybrid" },
          ];
        }

        return [{ title: "RPE scale", retrieval_mode: "hybrid" }];
      },
    );

    expect(result.metrics.caseRanks).toEqual([
      {
        id: "top-one",
        expectedRank: 1,
      },
      {
        id: "top-three",
        expectedRank: 3,
      },
      {
        id: "missing",
        expectedRank: null,
      },
    ]);
    expect(result.metrics.top1HitRate).toBeCloseTo(1 / 3);
    expect(result.metrics.top3HitRate).toBeCloseTo(2 / 3);
    expect(result.metrics.mrr).toBeCloseTo((1 + 1 / 3) / 3);
  });
});
