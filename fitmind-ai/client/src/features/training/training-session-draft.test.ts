import { describe, expect, it } from "vitest";

import type { DictionaryExercise } from "./dictionary-api";
import {
  buildWorkoutRequestFromDraft,
  createDraftExercise,
  isDraftSetValid,
} from "./training-session-draft";

function createExercise(
  overrides: Partial<DictionaryExercise> = {},
): DictionaryExercise {
  return {
    code: "bench_press_barbell",
    equipment: "barbell",
    id: "bench-id",
    movement_pattern: "horizontal_push",
    muscles: [],
    name_en: "Barbell Bench Press",
    name_zh: "\u6760\u94c3\u5367\u63a8",
    ...overrides,
  };
}

describe("training-session-draft", () => {
  it("allows completed bodyweight sets with reps and zero weight", () => {
    const exercise = createDraftExercise(
      createExercise({
        code: "pull_up_bodyweight",
        equipment: "bodyweight",
        id: "pull-up-id",
        name_en: "Pull-Up",
        name_zh: "\u5f15\u4f53\u5411\u4e0a",
      }),
      "\u80cc",
    );
    exercise.sets = [
      {
        completed: true,
        effort: "normal",
        id: "set-1",
        reps: "10",
        restSeconds: null,
        weightKg: "0",
      },
    ];

    expect(isDraftSetValid(exercise.sets[0]!, exercise)).toBe(true);
    expect(
      buildWorkoutRequestFromDraft({
        draftExercises: [exercise],
        elapsedSeconds: 0,
        performedAt: new Date("2026-05-29T10:00:00.000Z"),
      }),
    ).toMatchObject({
      performed_at: "2026-05-29T10:00:00.000Z",
      sets: [
        {
          exercise_id: "pull-up-id",
          reps: 10,
          set_index: 1,
          weight_kg: 0,
        },
      ],
    });
  });

  it("keeps incomplete weighted draft sets out of the create payload", () => {
    const exercise = createDraftExercise(createExercise(), "\u80f8");
    exercise.sets = [
      {
        completed: false,
        effort: "normal",
        id: "set-1",
        reps: "",
        restSeconds: null,
        weightKg: "100",
      },
    ];

    expect(isDraftSetValid(exercise.sets[0]!, exercise)).toBe(false);
    expect(
      buildWorkoutRequestFromDraft({
        draftExercises: [exercise],
        elapsedSeconds: 0,
        performedAt: new Date("2026-05-29T10:00:00.000Z"),
      }),
    ).toBeNull();
  });
});
