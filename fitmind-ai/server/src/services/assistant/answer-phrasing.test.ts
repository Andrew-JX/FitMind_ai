import { describe, expect, it, vi } from "vitest";

import { applyFaithfulPhrasing } from "./answer-phrasing.js";
import type { AnswerFaithfulnessResult } from "./answer-faithfulness.js";
import type { AssistantStructuredAnswer } from "./assistant-answer-composer.js";

const draft: AssistantStructuredAnswer = {
  summary: "本周共记录 4 次训练，20 组。",
  bullets: ["本周训练频率：4 次。"],
  conclusion: "保持稳定。",
  recommendation: "下周可小幅加量。",
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
};

const verified: AnswerFaithfulnessResult = {
  status: "verified",
  checkedNumbers: 2,
  unverifiedClaims: [],
};
const flagged: AnswerFaithfulnessResult = {
  status: "flagged",
  checkedNumbers: 2,
  unverifiedClaims: ["99"],
};

describe("applyFaithfulPhrasing", () => {
  it("adopts a verified rewrite (only the summary changes)", () => {
    const verify = vi.fn(() => verified);

    const result = applyFaithfulPhrasing(
      draft,
      "这周你练了 4 次，一共 20 组。",
      verify,
    );

    expect(result.phrasingApplied).toBe(true);
    expect(result.answer.summary).toBe("这周你练了 4 次，一共 20 组。");
    expect(result.answer.bullets).toEqual(draft.bullets);
    expect(result.answer.conclusion).toBe(draft.conclusion);
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("falls back to the draft when the rewrite is flagged", () => {
    const result = applyFaithfulPhrasing(
      draft,
      "这周你练了 99 次。",
      () => flagged,
    );

    expect(result.phrasingApplied).toBe(false);
    expect(result.answer).toBe(draft);
  });

  it("is a no-op for a blank rewrite (never calls verify)", () => {
    const verify = vi.fn(() => verified);

    const result = applyFaithfulPhrasing(draft, "   ", verify);

    expect(result.phrasingApplied).toBe(false);
    expect(result.answer).toBe(draft);
    expect(verify).not.toHaveBeenCalled();
  });

  it("is a no-op when the rewrite equals the draft summary", () => {
    const verify = vi.fn(() => verified);

    const result = applyFaithfulPhrasing(draft, draft.summary, verify);

    expect(result.phrasingApplied).toBe(false);
    expect(result.answer).toBe(draft);
    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects a rewrite that balloons past the length budget (bounds injected prose, never calls verify)", () => {
    const verify = vi.fn(() => verified);
    // Same numbers (would pass numeric faithfulness) but padded with extra prose.
    const padded = `${draft.summary}恢复情况很好，训练安排已经很均衡，可以放心继续加量，无需担心疲劳累积的问题。`;

    const result = applyFaithfulPhrasing(draft, padded, verify);

    expect(result.phrasingApplied).toBe(false);
    expect(result.answer).toBe(draft);
    expect(verify).not.toHaveBeenCalled();
  });
});
