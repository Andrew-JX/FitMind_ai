import { describe, expect, it } from "vitest";

import { splitAssistantQuickPrompts } from "./assistant-quick-prompts";

describe("assistant quick prompts", () => {
  it("shows three primary prompts before the collapsible group", () => {
    const groups = splitAssistantQuickPrompts([
      "weekly_report",
      "plateau_diagnosis",
      "next_week_plan",
      "training_overview",
      "next_training_focus",
    ]);

    expect(groups.primary).toEqual([
      "weekly_report",
      "plateau_diagnosis",
      "next_week_plan",
    ]);
    expect(groups.more).toEqual(["training_overview", "next_training_focus"]);
  });
});
