import { describe, expect, it } from "vitest";

import {
  isWeeklyPlanCreationRequest,
  WEEKLY_PLAN_GENERATION_MESSAGE,
} from "./assistant-weekly-plan-entry";

describe("assistant weekly-plan entry", () => {
  it.each([
    "给我下周计划",
    "帮我做一个下周训练计划",
    "生成本周健身计划",
    "安排一份本周计划",
  ])("routes %s into the structured setup", (message) => {
    expect(isWeeklyPlanCreationRequest(message)).toBe(true);
  });

  it.each(["为什么调整下周计划？", "本周训练怎么样？", "解释当前计划"])(
    "keeps %s in ordinary chat",
    (message) => {
      expect(isWeeklyPlanCreationRequest(message)).toBe(false);
    },
  );

  it("uses one stable generation message after setup", () => {
    expect(WEEKLY_PLAN_GENERATION_MESSAGE).toContain("本周设置");
  });
});
