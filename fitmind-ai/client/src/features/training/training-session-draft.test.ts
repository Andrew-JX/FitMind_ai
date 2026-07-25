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
    common_mistakes_zh: ["避免耸肩", "避免弹起"],
    equipment: "barbell",
    equipment_notes_zh: "确认杠铃路径稳定。",
    id: "bench-id",
    movement_pattern: "horizontal_push",
    muscles: [],
    name_en: "Barbell Bench Press",
    name_zh: "\u6760\u94c3\u5367\u63a8",
    technique_cues_zh: ["肩胛稳定", "控制下降"],
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
        isWarmup: false,
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
          is_warmup: false,
          reps: 10,
          set_index: 1,
          weight_kg: 0,
        },
      ],
    });
  });

  it("carries a warm-up draft set through to is_warmup on the payload", () => {
    const exercise = createDraftExercise(
      createExercise({ id: "bench-id" }),
      "胸",
    );
    exercise.sets = [
      {
        completed: true,
        effort: "normal",
        id: "warm-1",
        isWarmup: true,
        reps: "12",
        restSeconds: null,
        weightKg: "40",
      },
    ];

    expect(
      buildWorkoutRequestFromDraft({
        draftExercises: [exercise],
        elapsedSeconds: 0,
        performedAt: new Date("2026-05-29T10:00:00.000Z"),
      }),
    ).toMatchObject({
      sets: [{ exercise_id: "bench-id", is_warmup: true, reps: 12 }],
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
