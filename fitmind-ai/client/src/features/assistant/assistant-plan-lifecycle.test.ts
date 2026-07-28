import { describe, expect, it } from "vitest";

import { classifyPlanLifecycle } from "./assistant-plan-lifecycle";

describe("classifyPlanLifecycle", () => {
  it.each([
    ["2026-07-26", "expired"],
    ["2026-07-27", "active"],
    ["2026-07-28", "active"],
  ] as const)("classifies end date %s against today", (endDate, expected) => {
    expect(classifyPlanLifecycle({ endDate, today: "2026-07-27" })).toBe(
      expected,
    );
  });

  it.each([
    ["2026-06-30", "2026-07-01"],
    ["2025-12-31", "2026-01-01"],
  ] as const)("handles calendar boundary %s → %s", (endDate, today) => {
    expect(classifyPlanLifecycle({ endDate, today })).toBe("expired");
  });

  it("depends only on injected date-only strings, not the host timezone", () => {
    const input = { endDate: "2026-03-08", today: "2026-03-09" };

    expect(classifyPlanLifecycle(input)).toBe("expired");
  });
});
