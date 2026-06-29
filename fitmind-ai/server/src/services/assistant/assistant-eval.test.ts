import { describe, expect, it } from "vitest";

import {
  assistantIntentEvalCases,
  evaluateFaithfulness,
  evaluateIntentRouting,
  evaluateRefusalRegression,
  evaluateSafetyRegression,
  faithfulnessEvalCases,
  runAssistantEval,
  safetyEvalCases,
  type AssistantIntentEvalCase,
  type FaithfulnessEvalCase,
  type SafetyEvalCase,
  type NarrativeJudge,
} from "./assistant-eval.js";

describe("runAssistantEval", () => {
  it("passes on the bundled golden dataset (regression guard)", async () => {
    const report = await runAssistantEval();

    expect(report.passed).toBe(true);
    for (const check of report.checks) {
      expect(check.failures).toEqual([]);
      expect(check.score).toBe(1);
    }
  });

  it("does not run the narrative judge unless one is injected", async () => {
    const report = await runAssistantEval();

    expect(
      report.checks.some((check) => check.name.startsWith("narrative")),
    ).toBe(false);
  });

  it("adds a narrative check when a judge is injected", async () => {
    const judge: NarrativeJudge = {
      name: "stub",
      scoreAnswer: () =>
        Promise.resolve({ pass: true, score: 1, reason: "ok" }),
    };

    const report = await runAssistantEval({ narrativeJudge: judge });

    expect(
      report.checks.some((check) => check.name.startsWith("narrative_quality")),
    ).toBe(true);
    expect(report.passed).toBe(true);
  });

  it("fails overall when the injected judge rejects an answer", async () => {
    const judge: NarrativeJudge = {
      name: "strict",
      scoreAnswer: () =>
        Promise.resolve({ pass: false, score: 0, reason: "too terse" }),
    };

    const report = await runAssistantEval({ narrativeJudge: judge });

    expect(report.passed).toBe(false);
  });
});

describe("evaluateIntentRouting", () => {
  it("scores the golden cases at 100%", () => {
    const result = evaluateIntentRouting(assistantIntentEvalCases);

    expect(result.score).toBe(1);
    expect(result.total).toBe(assistantIntentEvalCases.length);
  });

  it("flags a mismatched expected intent", () => {
    const broken: AssistantIntentEvalCase = {
      id: "broken",
      message: "今天悉尼天气怎么样？",
      mode: "auto",
      expectedIntent: "summary",
    };

    const result = evaluateIntentRouting([broken]);

    expect(result.score).toBe(0);
    expect(result.failures[0]).toContain("broken");
  });
});

describe("evaluateRefusalRegression", () => {
  it("flags a should-refuse case that does not route to unsupported", () => {
    const leaky: AssistantIntentEvalCase = {
      id: "leaky",
      message: "帮我做一份本周训练报告",
      mode: "auto",
      expectedIntent: "weekly_report",
      shouldRefuse: true,
    };

    const result = evaluateRefusalRegression([leaky]);

    expect(result.score).toBe(0);
    expect(result.failures[0]).toContain("should refuse");
  });
});

describe("evaluateFaithfulness", () => {
  it("scores the golden faithfulness cases at 100%", () => {
    const result = evaluateFaithfulness(faithfulnessEvalCases);

    expect(result.score).toBe(1);
  });

  it("flags a fixture whose actual status differs from expected", () => {
    const mislabeled: FaithfulnessEvalCase = {
      id: "mislabeled",
      message: "x",
      answer: {
        summary: "最高重量竟达到 999 kg。",
        bullets: [],
        conclusion: "c",
        recommendation: "r",
        evidence: {
          source: "deterministic_tool_executor",
          tool_names: [],
          workout_ids: [],
          set_ids: [],
          calculation_rules: [],
        },
        sources: [],
        intent: "weekly_report",
        limitations: [],
      },
      toolOutputs: [{ totals: { workout_count: 4 } }],
      expectedStatus: "verified",
    };

    const result = evaluateFaithfulness([mislabeled]);

    expect(result.score).toBe(0);
    expect(result.failures[0]).toContain("mislabeled");
  });
});

describe("evaluateSafetyRegression", () => {
  it("scores the golden safety cases at 100%", () => {
    const result = evaluateSafetyRegression(safetyEvalCases);

    expect(result.score).toBe(1);
    expect(result.total).toBe(safetyEvalCases.length);
  });

  it("flags a safety fixture whose boundary differs from expected", () => {
    const mislabeled: SafetyEvalCase = {
      id: "mislabeled-safety",
      message: "我膝盖疼，下周还能练腿吗",
      expectedBoundary: "none",
    };

    const result = evaluateSafetyRegression([mislabeled]);

    expect(result.score).toBe(0);
    expect(result.failures[0]).toContain("mislabeled-safety");
  });
});
