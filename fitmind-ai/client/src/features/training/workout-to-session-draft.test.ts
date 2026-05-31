import { describe, expect, it } from "vitest";

import type { WorkoutDetailDto } from "../../../../shared/src/training";
import type { DictionaryExercise } from "./dictionary-api";
import {
  buildWorkoutEditPlan,
  mapWorkoutToSessionInitialDraft,
} from "./workout-to-session-draft";

const benchId = "11111111-1111-4111-8111-111111111111";
const rowId = "22222222-2222-4222-8222-222222222222";
const setId = "33333333-3333-4333-8333-333333333333";

function createExercise(
  overrides: Partial<DictionaryExercise> = {},
): DictionaryExercise {
  return {
    code: "bench_press_barbell",
    equipment: "barbell",
    id: benchId,
    movement_pattern: "horizontal_push",
    muscles: [],
    name_en: "Barbell Bench Press",
    name_zh: "\u6760\u94c3\u5367\u63a8",
    ...overrides,
  };
}

function createWorkout(overrides: Partial<WorkoutDetailDto> = {}): WorkoutDetailDto {
  return {
    duration_minutes: 45,
    ended_at: "2026-05-31T09:15:00.000Z",
    id: "99999999-9999-4999-8999-999999999999",
    notes: "solid session",
    performed_at: "2026-05-31T08:30:00.000Z",
    sets: [
      {
        created_at: "2026-05-31T08:35:00.000Z",
        exercise_id: benchId,
        id: setId,
        is_warmup: false,
        notes: null,
        reps: 10,
        rpe: 8,
        set_index: 1,
        weight_kg: 60,
      },
    ],
    started_at: "2026-05-31T08:30:00.000Z",
    ...overrides,
  };
}

describe("mapWorkoutToSessionInitialDraft", () => {
  it("maps an existing workout into an edit composer draft", () => {
    const draft = mapWorkoutToSessionInitialDraft(createWorkout(), [
      createExercise(),
    ]);

    expect(draft).toMatchObject({
      durationMin: 45,
      endedAt: "2026-05-31T09:15:00.000Z",
      note: "solid session",
      performedAt: "2026-05-31T08:30:00.000Z",
      source: "edit",
      startedAt: "2026-05-31T08:30:00.000Z",
      workoutId: "99999999-9999-4999-8999-999999999999",
    });
    expect(draft.exercises[0]).toMatchObject({
      exerciseId: benchId,
      matchStatus: "matched",
      sets: [
        {
          completed: true,
          persistedSetId: setId,
          reps: "10",
          weightKg: "60",
        },
      ],
    });
  });

  it("preserves unset historical start and end time", () => {
    const draft = mapWorkoutToSessionInitialDraft(
      createWorkout({
        duration_minutes: null,
        ended_at: null,
        started_at: null,
      }),
      [createExercise()],
    );

    expect(draft.startedAt).toBeNull();
    expect(draft.endedAt).toBeNull();
    expect(draft.durationMin).toBeNull();
  });
});

describe("buildWorkoutEditPlan", () => {
  it("detects metadata, set updates, set additions, and set deletions", () => {
    const original = createWorkout({
      sets: [
        createWorkout().sets[0]!,
        {
          created_at: "2026-05-31T08:40:00.000Z",
          exercise_id: rowId,
          id: "44444444-4444-4444-8444-444444444444",
          is_warmup: false,
          notes: null,
          reps: 12,
          rpe: 7,
          set_index: 1,
          weight_kg: 50,
        },
      ],
    });
    const draft = mapWorkoutToSessionInitialDraft(original, [
      createExercise(),
      createExercise({
        code: "seated_cable_row",
        id: rowId,
        name_en: "Seated Cable Row",
        name_zh: "\u5750\u59ff\u5212\u8239",
      }),
    ]);

    draft.note = "updated note";
    draft.startedAt = "2026-05-31T08:45:00.000Z";
    draft.endedAt = "2026-05-31T09:45:00.000Z";
    draft.durationMin = 60;
    draft.exercises[0]!.sets[0]!.reps = "8";
    draft.exercises[0]!.sets.push({
      completed: true,
      effort: "hard",
      id: "new-set",
      persistedSetId: null,
      reps: "6",
      restSeconds: null,
      weightKg: "70",
    });
    draft.exercises = draft.exercises.filter(
      (exercise) => exercise.exerciseId !== rowId,
    );

    const plan = buildWorkoutEditPlan(original, draft);

    expect(plan.workoutPatch).toEqual({
      duration_minutes: 60,
      ended_at: "2026-05-31T09:45:00.000Z",
      notes: "updated note",
      performed_at: "2026-05-31T08:45:00.000Z",
      started_at: "2026-05-31T08:45:00.000Z",
    });
    expect(plan.setPatches).toEqual([
      {
        input: {
          reps: 8,
          rpe: 8,
          set_index: 1,
          weight_kg: 60,
        },
        setId,
      },
    ]);
    expect(plan.setAdds).toEqual([
      {
        exercise_id: benchId,
        is_warmup: false,
        reps: 6,
        rpe: 9,
        set_index: 2,
        weight_kg: 70,
      },
    ]);
    expect(plan.setDeletes).toEqual(["44444444-4444-4444-8444-444444444444"]);
  });
});
