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

  it("submits edited session structure and exercise prescription fields", () => {
    const exercise = {
      exerciseId: "00000000-0000-4000-8000-000000000001",
      exerciseName: "哑铃卧推",
      sets: 4,
      repMin: 8,
      repMax: 12,
      targetWeightKg: null,
      restSeconds: 90,
      equipment: "dumbbell",
      movementPattern: "horizontal_push",
      primaryMuscles: ["chest"],
      alternatives: [],
      basis: "用户编辑后的动作",
    };
    const draft: AssistantPlanDraft = {
      strategy: "maintain",
      exercises: [exercise],
      sessions: [
        {
          sessionIndex: 1,
          title: "训练日 1",
          focusAreas: ["chest"],
          estimatedDurationMinutes: 30,
          exercises: [exercise],
        },
      ],
      notes: [],
    };

    const result = denormalizePlanDraft(draft);
    expect(result.sessions?.[0]?.exercises[0]).toMatchObject({
      exercise_name: "哑铃卧推",
      sets: 4,
      rep_min: 8,
      rep_max: 12,
      rest_seconds: 90,
    });
    expect(result.exercises[0]).toEqual(result.sessions?.[0]?.exercises[0]);
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
