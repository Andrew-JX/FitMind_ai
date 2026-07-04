import { describe, expect, it } from "vitest";

import type { AssistantStructuredAnswer } from "./assistant-answer-composer.js";
import {
  enforceFaithfulnessInDev,
  verifyAnswerFaithfulness,
} from "./answer-faithfulness.js";

function buildAnswer(
  overrides: Partial<AssistantStructuredAnswer> = {},
): AssistantStructuredAnswer {
  return {
    summary: "占位 summary。",
    bullets: [],
    conclusion: "占位 conclusion。",
    recommendation: "占位 recommendation。",
    evidence: {
      source: "deterministic_tool_executor",
      tool_names: ["get_weekly_training_report"],
      workout_ids: [],
      set_ids: [],
      calculation_rules: [],
    },
    sources: [],
    intent: "weekly_report",
    limitations: [],
    ...overrides,
  };
}

const weeklyToolOutput = {
  status: "ready",
  range: { start_date: "2026-06-01", end_date: "2026-06-07" },
  totals: {
    workout_count: 4,
    set_count: 40,
    total_reps: 320,
    total_volume: 12000,
  },
  frequency: { range_days: 7, workouts_per_week: 4 },
  top_muscle_groups: [{ muscle_group_name: "胸", contribution_ratio: 0.4 }],
  evidence: {
    workout_ids: ["w1", "w2"],
    set_ids: ["s1"],
    calculation_rules: ["weekly_rule"],
  },
};

describe("verifyAnswerFaithfulness", () => {
  it("verifies when every number traces back to tool output", () => {
    const answer = buildAnswer({
      summary: "本周共记录 4 次训练，40 组，320 次，总训练量约 12000 kg。",
      bullets: ["近 7 天平均训练频率：约每周 4 次。"],
      conclusion: "训练量来自已记录 workout，不是模型猜测。",
      recommendation: "下周保持 4 次频率即可。",
    });

    const result = verifyAnswerFaithfulness(answer, [weeklyToolOutput]);

    expect(result.status).toBe("verified");
    expect(result.unverifiedClaims).toHaveLength(0);
    expect(result.checkedNumbers).toBeGreaterThan(0);
  });

  it("flags a fabricated number that never appears in tool output", () => {
    const answer = buildAnswer({
      summary: "本周共记录 4 次训练，最高重量竟达到 999 kg。",
    });

    const result = verifyAnswerFaithfulness(answer, [weeklyToolOutput]);

    expect(result.status).toBe("flagged");
    expect(result.unverifiedClaims).toContain("999");
    // 真实数据 4 不应被误标。
    expect(result.unverifiedClaims).not.toContain("4");
  });

  it("does not false-flag toLocaleString commas or percent rounding", () => {
    const answer = buildAnswer({
      // 12000 → toLocaleString "12,000"；ratio 0.4 → formatPercent "40.0%"。
      summary: "总训练量约 12,000 kg，占比最高肌群约 40.0%。",
      bullets: ["近 7 天约每周 4 次。"],
    });

    const result = verifyAnswerFaithfulness(answer, [weeklyToolOutput]);

    expect(result.status).toBe("verified");
    expect(result.unverifiedClaims).toHaveLength(0);
  });

  it("treats array length as an acceptable derived count", () => {
    const answer = buildAnswer({
      // 2 = evidence.workout_ids.length（派生计数，非原始值）。
      summary: "这个总结来自 2 条已记录 workout 和 1 条 set。",
    });

    const result = verifyAnswerFaithfulness(answer, [weeklyToolOutput]);

    expect(result.status).toBe("verified");
    expect(result.unverifiedClaims).toHaveLength(0);
  });

  it("ignores structural ordinals like 第N步", () => {
    const answer = buildAnswer({
      summary: "当前记录训练次数：0 次，规划在第1步就停止了。",
    });

    const result = verifyAnswerFaithfulness(answer, [
      { totals: { workout_count: 0 } },
    ]);

    expect(result.status).toBe("verified");
    expect(result.unverifiedClaims).toHaveLength(0);
  });

  it("flags a cited UUID that is absent from evidence and sources", () => {
    const strayId = "11111111-2222-3333-4444-555555555555";
    const answer = buildAnswer({
      summary: `这条结论引用了 workout ${strayId}。`,
    });

    const result = verifyAnswerFaithfulness(answer, [weeklyToolOutput]);

    expect(result.status).toBe("flagged");
    expect(result.unverifiedClaims).toContain(strayId);
  });

  it("accepts a cited UUID that is present in evidence", () => {
    const knownId = "11111111-2222-3333-4444-555555555555";
    const answer = buildAnswer({
      summary: `这条结论引用了 workout ${knownId}。`,
      evidence: {
        source: "deterministic_tool_executor",
        tool_names: ["get_weekly_training_report"],
        workout_ids: [knownId],
        set_ids: [],
        calculation_rules: [],
      },
    });

    const result = verifyAnswerFaithfulness(answer, [weeklyToolOutput]);

    expect(result.status).toBe("verified");
    expect(result.unverifiedClaims).toHaveLength(0);
  });
});

describe("enforceFaithfulnessInDev", () => {
  it("never throws on a verified result", () => {
    expect(() =>
      enforceFaithfulnessInDev({
        status: "verified",
        checkedNumbers: 1,
        unverifiedClaims: [],
      }),
    ).not.toThrow();
  });

  it("does not throw on flagged results by default (annotate, not block)", () => {
    const previous = process.env.FAITHFULNESS_STRICT;
    delete process.env.FAITHFULNESS_STRICT;

    expect(() =>
      enforceFaithfulnessInDev({
        status: "flagged",
        checkedNumbers: 1,
        unverifiedClaims: ["999"],
      }),
    ).not.toThrow();

    if (previous !== undefined) {
      process.env.FAITHFULNESS_STRICT = previous;
    }
  });
});
