import { describe, expect, it } from "vitest";

import {
  createForwardWeekRange,
  denormalizePlanDraft,
} from "./planned-workout-api";
import type { AssistantPlanDraft } from "./assistant-types";

describe("denormalizePlanDraft", () => {
  it("converts the normalized draft back to the snake_case wire shape", () => {
    const draft: AssistantPlanDraft = {
      strategy: "add_frequency",
      exercises: [
        {
          exerciseName: "Barbell Bench Press",
          sets: 4,
          repMin: 6,
          repMax: 10,
          targetWeightKg: 72.5,
          basis: "x",
        },
        {
          exerciseName: "Barbell Squat",
          sets: 4,
          repMin: 6,
          repMax: 10,
          targetWeightKg: null,
          basis: "y",
        },
      ],
      notes: ["note"],
    };

    expect(denormalizePlanDraft(draft)).toEqual({
      strategy: "add_frequency",
      exercises: [
        {
          exercise_name: "Barbell Bench Press",
          sets: 4,
          rep_min: 6,
          rep_max: 10,
          target_weight_kg: 72.5,
          basis: "x",
        },
        {
          exercise_name: "Barbell Squat",
          sets: 4,
          rep_min: 6,
          rep_max: 10,
          target_weight_kg: null,
          basis: "y",
        },
      ],
      notes: ["note"],
    });
  });
});

describe("createForwardWeekRange", () => {
  it("builds an inclusive 7-day window starting today", () => {
    const range = createForwardWeekRange(new Date(2026, 5, 15));

    expect(range.startDate).toBe("2026-06-15");
    expect(range.endDate).toBe("2026-06-21");
  });

  it("zero-pads month and day", () => {
    const range = createForwardWeekRange(new Date(2026, 0, 3));

    expect(range.startDate).toBe("2026-01-03");
    expect(range.endDate).toBe("2026-01-09");
  });
});
