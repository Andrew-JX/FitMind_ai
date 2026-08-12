import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import type { WorkoutDetailDto } from "../../../../shared/src/training";
import type {
  DraftExercise,
  TrainingSessionInitialDraft,
} from "./training-session-draft";
import {
  executeTrainingSessionSave,
  prepareTrainingSessionSave,
  type TrainingSessionSaveApi,
  type TrainingSessionSavePlan,
} from "./training-session-save";

const trainingDirectory = dirname(fileURLToPath(import.meta.url));
const exerciseId = "11111111-1111-4111-8111-111111111111";
const removedExerciseId = "22222222-2222-4222-8222-222222222222";
const persistedSetId = "33333333-3333-4333-8333-333333333333";
const removedSetId = "44444444-4444-4444-8444-444444444444";
const workoutId = "99999999-9999-4999-8999-999999999999";
const fixedNow = new Date("2026-08-11T09:01:30.000Z");

function createDraftExercise(): DraftExercise {
  return {
    candidateExercises: [],
    categoryLabel: "胸",
    exercise: null,
    exerciseId,
    id: "draft-bench",
    inputName: null,
    isExpanded: false,
    loadType: "weighted",
    matchStatus: "matched",
    name: "杠铃卧推",
    sets: [
      {
        completed: true,
        effort: "normal",
        id: "draft-set",
        isWarmup: false,
        reps: "8",
        restSeconds: 90,
        weightKg: "60",
      },
    ],
  };
}

function createOriginalWorkout(): WorkoutDetailDto {
  return {
    duration_minutes: 45,
    ended_at: "2026-08-10T09:15:00.000Z",
    id: workoutId,
    notes: "original",
    performed_at: "2026-08-10T08:30:00.000Z",
    sets: [
      {
        created_at: "2026-08-10T08:35:00.000Z",
        exercise_id: exerciseId,
        id: persistedSetId,
        is_warmup: false,
        notes: null,
        reps: 10,
        rpe: 8,
        set_index: 1,
        weight_kg: 60,
      },
      {
        created_at: "2026-08-10T08:40:00.000Z",
        exercise_id: removedExerciseId,
        id: removedSetId,
        is_warmup: false,
        notes: null,
        reps: 12,
        rpe: 7,
        set_index: 1,
        weight_kg: 50,
      },
    ],
    started_at: "2026-08-10T08:30:00.000Z",
  };
}

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    draftDurationMin: null,
    draftEndedAt: null,
    draftExercises: [createDraftExercise()],
    draftNote: "  strong session  ",
    draftPerformedAt: null,
    draftStartedAt: "2026-08-11T08:00:00.000Z",
    elapsedSeconds: 3670,
    initialDraft: null,
    mode: "create_active" as const,
    now: fixedNow,
    ...overrides,
  };
}

function createApi(log: unknown[][]): TrainingSessionSaveApi {
  return {
    addWorkoutSet: vi.fn(async (...args) => {
      log.push(["addWorkoutSet", ...args]);
    }),
    createWorkout: vi.fn(async (...args) => {
      log.push(["createWorkout", ...args]);
    }),
    deleteWorkoutSet: vi.fn(async (...args) => {
      log.push(["deleteWorkoutSet", ...args]);
    }),
    updateWorkout: vi.fn(async (...args) => {
      log.push(["updateWorkout", ...args]);
    }),
    updateWorkoutSet: vi.fn(async (...args) => {
      log.push(["updateWorkoutSet", ...args]);
    }),
  };
}

describe("prepareTrainingSessionSave", () => {
  it("preserves active-session time, note, duration, and set semantics", () => {
    expect(prepareTrainingSessionSave(createInput())).toEqual({
      kind: "create",
      request: {
        duration_minutes: 61,
        ended_at: "2026-08-11T09:01:30.000Z",
        notes: "strong session",
        performed_at: "2026-08-11T08:00:00.000Z",
        sets: [
          {
            exercise_id: exerciseId,
            is_warmup: false,
            reps: 8,
            rpe: 8,
            set_index: 1,
            weight_kg: 60,
          },
        ],
        started_at: "2026-08-11T08:00:00.000Z",
      },
    });
  });

  it("uses imported training timestamps instead of active elapsed time", () => {
    expect(
      prepareTrainingSessionSave(
        createInput({
          draftDurationMin: 42,
          draftEndedAt: "2026-07-03T20:42:00.000+08:00",
          draftPerformedAt: "2026-07-03T20:00:00.000+08:00",
          draftStartedAt: "2026-07-03T20:00:00.000+08:00",
          elapsedSeconds: 9999,
          mode: "create_from_intake",
          now: new Date("2030-01-01T00:00:00.000Z"),
        }),
      ),
    ).toMatchObject({
      kind: "create",
      request: {
        duration_minutes: 42,
        ended_at: "2026-07-03T20:42:00.000+08:00",
        performed_at: "2026-07-03T12:00:00.000Z",
        started_at: "2026-07-03T20:00:00.000+08:00",
      },
    });
  });

  it("prepares the existing workout patch and ordered set mutations", () => {
    const originalWorkout = createOriginalWorkout();
    const exercise = createDraftExercise();
    exercise.sets[0] = {
      ...exercise.sets[0]!,
      persistedSetId,
      reps: "9",
    };
    exercise.sets.push({
      completed: true,
      effort: "hard",
      id: "new-set",
      isWarmup: false,
      reps: "6",
      restSeconds: null,
      weightKg: "70",
    });
    const initialDraft: TrainingSessionInitialDraft = {
      durationMin: 45,
      endedAt: originalWorkout.ended_at,
      exercises: [exercise],
      note: originalWorkout.notes,
      originalWorkout,
      performedAt: originalWorkout.performed_at,
      source: "edit",
      startedAt: originalWorkout.started_at,
      workoutId,
    };

    expect(
      prepareTrainingSessionSave(
        createInput({
          draftDurationMin: 60,
          draftEndedAt: "2026-08-10T09:30:00.000Z",
          draftExercises: [exercise],
          draftNote: "updated",
          draftPerformedAt: "2026-08-10T08:20:00.000Z",
          draftStartedAt: "2026-08-10T08:20:00.000Z",
          initialDraft,
          mode: "edit_existing",
        }),
      ),
    ).toEqual({
      editPlan: {
        setAdds: [
          {
            exercise_id: exerciseId,
            is_warmup: false,
            reps: 6,
            rpe: 9,
            set_index: 2,
            weight_kg: 70,
          },
        ],
        setDeletes: [removedSetId],
        setPatches: [
          {
            input: { reps: 9, rpe: 8, set_index: 1, weight_kg: 60 },
            setId: persistedSetId,
          },
        ],
        workoutPatch: {
          duration_minutes: 60,
          ended_at: "2026-08-10T09:30:00.000Z",
          notes: "updated",
          performed_at: "2026-08-10T08:20:00.000Z",
          started_at: "2026-08-10T08:20:00.000Z",
        },
      },
      kind: "edit",
      workoutId,
    });
  });

  it("rejects invalid create drafts and edit drafts without an original workout", () => {
    const invalidExercise = createDraftExercise();
    invalidExercise.sets[0] = {
      ...invalidExercise.sets[0]!,
      completed: false,
    };

    expect(
      prepareTrainingSessionSave(
        createInput({ draftExercises: [invalidExercise] }),
      ),
    ).toBeNull();
    expect(
      prepareTrainingSessionSave(
        createInput({ initialDraft: null, mode: "edit_existing" }),
      ),
    ).toBeNull();
  });
});

describe("executeTrainingSessionSave", () => {
  it("executes create once with the in-memory token and complete request", async () => {
    const log: unknown[][] = [];
    const api = createApi(log);
    const plan = prepareTrainingSessionSave(createInput());

    if (plan?.kind !== "create") {
      throw new Error("Expected a create save plan.");
    }

    await executeTrainingSessionSave("token-1", plan, api);

    expect(log).toEqual([["createWorkout", "token-1", plan.request]]);
  });

  it("executes edit mutations sequentially in the existing partial-failure order", async () => {
    const log: unknown[][] = [];
    const api = createApi(log);
    const plan: TrainingSessionSavePlan = {
      editPlan: {
        setAdds: [
          {
            exercise_id: exerciseId,
            is_warmup: false,
            reps: 6,
            rpe: 9,
            set_index: 2,
            weight_kg: 70,
          },
        ],
        setDeletes: [removedSetId],
        setPatches: [
          {
            input: { reps: 9, rpe: 8, set_index: 1, weight_kg: 60 },
            setId: persistedSetId,
          },
        ],
        workoutPatch: { notes: "updated" },
      },
      kind: "edit",
      workoutId,
    };

    await executeTrainingSessionSave("token-2", plan, api);

    expect(log).toEqual([
      ["updateWorkout", "token-2", workoutId, { notes: "updated" }],
      ["deleteWorkoutSet", "token-2", removedSetId],
      [
        "updateWorkoutSet",
        "token-2",
        persistedSetId,
        { reps: 9, rpe: 8, set_index: 1, weight_kg: 60 },
      ],
      [
        "addWorkoutSet",
        "token-2",
        workoutId,
        {
          exercise_id: exerciseId,
          is_warmup: false,
          reps: 6,
          rpe: 9,
          set_index: 2,
          weight_kg: 70,
        },
      ],
    ]);
  });

  it("does not issue requests for a no-op edit plan", async () => {
    const log: unknown[][] = [];

    await executeTrainingSessionSave(
      "token-3",
      {
        editPlan: {
          setAdds: [],
          setDeletes: [],
          setPatches: [],
          workoutPatch: null,
        },
        kind: "edit",
        workoutId,
      },
      createApi(log),
    );

    expect(log).toEqual([]);
  });

  it("rethrows the same mutation error and stops before later operations", async () => {
    const log: unknown[][] = [];
    const failure = new Error("delete failed");
    const api = createApi(log);
    api.deleteWorkoutSet = vi.fn(async (...args) => {
      log.push(["deleteWorkoutSet", ...args]);
      throw failure;
    });
    const plan: TrainingSessionSavePlan = {
      editPlan: {
        setAdds: [
          {
            exercise_id: exerciseId,
            is_warmup: false,
            reps: 6,
            rpe: 9,
            set_index: 2,
            weight_kg: 70,
          },
        ],
        setDeletes: [removedSetId],
        setPatches: [
          {
            input: { reps: 9, rpe: 8, set_index: 1, weight_kg: 60 },
            setId: persistedSetId,
          },
        ],
        workoutPatch: { notes: "updated" },
      },
      kind: "edit",
      workoutId,
    };

    await expect(executeTrainingSessionSave("token-4", plan, api)).rejects.toBe(
      failure,
    );
    expect(log).toEqual([
      ["updateWorkout", "token-4", workoutId, { notes: "updated" }],
      ["deleteWorkoutSet", "token-4", removedSetId],
    ]);
  });
});

describe("training session save ownership", () => {
  it("moves production mutation and edit-plan ownership out of the composer", () => {
    const composerSource = readFileSync(
      join(trainingDirectory, "TrainingSessionComposer.tsx"),
      "utf8",
    );
    const saveSource = readFileSync(
      join(trainingDirectory, "training-session-save.ts"),
      "utf8",
    );

    expect(composerSource).not.toContain('from "./workout-api"');
    expect(composerSource).not.toContain("buildWorkoutEditPlan");
    expect(composerSource).toContain('from "./training-session-save"');
    expect(saveSource).toContain('from "./workout-api"');
    expect(saveSource).toContain("buildWorkoutEditPlan");

    for (const mutation of [
      "addWorkoutSet",
      "createWorkout",
      "deleteWorkoutSet",
      "updateWorkout",
      "updateWorkoutSet",
    ]) {
      expect(saveSource).toContain(mutation);
    }
  });
});
