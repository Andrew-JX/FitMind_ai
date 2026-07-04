import { describe, expect, it } from "vitest";

import type { DictionaryExercise } from "./dictionary-api";
import type { DraftExercise } from "./training-session-draft";
import type { WorkoutIntakeDraft } from "./workout-intake-api";
import {
  appendIntakeExercisesToDraft,
  mapWorkoutIntakeDraftToSessionInitialDraft,
} from "./workout-intake-to-session-draft";

const benchExerciseId = "11111111-1111-4111-8111-111111111111";
const pullUpExerciseId = "77777777-7777-4777-8777-777777777777";

function createExercise(
  overrides: Partial<DictionaryExercise> = {},
): DictionaryExercise {
  return {
    code: "bench_press_barbell",
    common_mistakes_zh: ["避免耸肩", "避免弹起"],
    equipment: "barbell",
    equipment_notes_zh: "确认杠铃路径稳定。",
    id: benchExerciseId,
    movement_pattern: "horizontal_push",
    muscles: [],
    name_en: "Barbell Bench Press",
    name_zh: "\u6760\u94c3\u5367\u63a8",
    technique_cues_zh: ["肩胛稳定", "控制下降"],
    ...overrides,
  };
}

function createDraft(
  overrides: Partial<WorkoutIntakeDraft> = {},
): WorkoutIntakeDraft {
  return {
    date_label: null,
    date_source: "request_performed_at",
    duration_min: 50,
    exercises: [],
    note: "quick intake",
    performed_at: "2026-05-29T10:00:00.000Z",
    ...overrides,
  };
}

describe("mapWorkoutIntakeDraftToSessionInitialDraft", () => {
  it("maps complete intake sets into completed composer set rows", () => {
    const result = mapWorkoutIntakeDraftToSessionInitialDraft(
      createDraft({
        exercises: [
          {
            candidate_exercises: [],
            incomplete_sets: [],
            input_name: "\u9ad8\u4f4d\u4e0b\u62c9",
            match_confidence: 1,
            match_status: "matched",
            matched_exercise_id: benchExerciseId,
            matched_exercise_name: "\u6760\u94c3\u5367\u63a8",
            sets: [
              {
                intensity_label: null,
                reps: 10,
                rpe: null,
                weight_kg: 70,
              },
            ],
          },
        ],
      }),
      [createExercise()],
    );

    expect(result).toMatchObject({
      durationMin: 50,
      note: "quick intake",
      performedAt: "2026-05-29T10:00:00.000Z",
      source: "intake",
    });
    expect(result.exercises[0]).toMatchObject({
      exerciseId: benchExerciseId,
      inputName: "\u9ad8\u4f4d\u4e0b\u62c9",
      matchStatus: "matched",
      sets: [
        {
          completed: true,
          reps: "10",
          weightKg: "70",
        },
      ],
    });
  });

  it("expands incomplete weighted repeated sets with missing reps left empty", () => {
    const result = mapWorkoutIntakeDraftToSessionInitialDraft(
      createDraft({
        exercises: [
          {
            candidate_exercises: [],
            incomplete_sets: [
              {
                group_count: 3,
                message: "missing reps",
                missing_fields: ["reps"],
                reps: null,
                weight_kg: 100,
              },
            ],
            input_name: "\u5367\u63a8",
            match_confidence: 1,
            match_status: "matched",
            matched_exercise_id: benchExerciseId,
            matched_exercise_name: "\u6760\u94c3\u5367\u63a8",
            sets: [],
          },
        ],
      }),
      [createExercise()],
    );

    expect(result.exercises[0]?.sets).toEqual(
      Array.from({ length: 3 }, () =>
        expect.objectContaining({
          completed: false,
          reps: "",
          weightKg: "100",
        }),
      ),
    );
  });

  it("maps bodyweight pull-up sets as zero weight completed rows", () => {
    const result = mapWorkoutIntakeDraftToSessionInitialDraft(
      createDraft({
        exercises: [
          {
            candidate_exercises: [],
            incomplete_sets: [],
            input_name: "\u5f15\u4f53\u5411\u4e0a",
            match_confidence: 1,
            match_status: "matched",
            matched_exercise_id: pullUpExerciseId,
            matched_exercise_name: "\u5f15\u4f53\u5411\u4e0a",
            sets: [
              {
                intensity_label: null,
                reps: 10,
                rpe: null,
                weight_kg: 0,
              },
            ],
          },
        ],
      }),
      [
        createExercise({
          code: "pull_up_bodyweight",
          equipment: "bodyweight",
          id: pullUpExerciseId,
          name_en: "Pull-Up",
          name_zh: "\u5f15\u4f53\u5411\u4e0a",
        }),
      ],
    );

    expect(result.exercises[0]).toMatchObject({
      exerciseId: pullUpExerciseId,
      loadType: "bodyweight",
      matchStatus: "matched",
      sets: [
        {
          completed: true,
          reps: "10",
          weightKg: "0",
        },
      ],
    });
  });

  it("preserves ambiguous and unresolved cards for composer resolution", () => {
    const result = mapWorkoutIntakeDraftToSessionInitialDraft(
      createDraft({
        exercises: [
          {
            candidate_exercises: [
              {
                confidence: 0.8,
                exercise_id: benchExerciseId,
                exercise_name: "\u6760\u94c3\u5367\u63a8",
              },
            ],
            incomplete_sets: [],
            input_name: "\u5212\u8239",
            match_confidence: 0.8,
            match_status: "ambiguous",
            matched_exercise_id: null,
            matched_exercise_name: null,
            sets: [
              {
                intensity_label: null,
                reps: 10,
                rpe: null,
                weight_kg: 50,
              },
            ],
          },
          {
            candidate_exercises: [],
            incomplete_sets: [],
            input_name: "unknown",
            match_confidence: 0,
            match_status: "unresolved",
            matched_exercise_id: null,
            matched_exercise_name: null,
            sets: [],
          },
        ],
      }),
      [createExercise()],
    );

    expect(result.exercises[0]).toMatchObject({
      candidateExercises: [
        {
          exerciseId: benchExerciseId,
          exerciseName: "\u6760\u94c3\u5367\u63a8",
        },
      ],
      exerciseId: null,
      inputName: "\u5212\u8239",
      matchStatus: "ambiguous",
    });
    expect(result.exercises[1]).toMatchObject({
      exercise: null,
      exerciseId: null,
      inputName: "unknown",
      matchStatus: "unresolved",
    });
  });
});

function createDraftExercise(
  overrides: Partial<DraftExercise> = {},
): DraftExercise {
  return {
    candidateExercises: [],
    categoryLabel: "胸",
    exercise: null,
    exerciseId: benchExerciseId,
    id: "exercise-existing",
    inputName: null,
    isExpanded: false,
    loadType: "weighted",
    matchStatus: "matched",
    name: "杠铃卧推",
    sets: [
      {
        completed: true,
        effort: "normal",
        id: "set-existing-1",
        reps: "8",
        restSeconds: null,
        weightKg: "60",
      },
    ],
    ...overrides,
  };
}

describe("appendIntakeExercisesToDraft", () => {
  it("merges incoming sets into an existing matched exercise", () => {
    const current = [createDraftExercise()];
    const incoming = [
      createDraftExercise({
        id: "intake-exercise-0",
        sets: [
          {
            completed: true,
            effort: "normal",
            id: "intake-set-0",
            reps: "10",
            restSeconds: null,
            weightKg: "70",
          },
        ],
      }),
    ];

    const result = appendIntakeExercisesToDraft(current, incoming);

    expect(result.addedCount).toBe(0);
    expect(result.mergedCount).toBe(1);
    expect(result.next).toHaveLength(1);
    expect(result.next[0]?.sets).toHaveLength(2);
    expect(result.next[0]?.sets[1]).toMatchObject({
      reps: "10",
      weightKg: "70",
    });
    expect(result.next[0]?.isExpanded).toBe(true);
  });

  it("appends a different matched exercise as a new card", () => {
    const current = [createDraftExercise()];
    const incoming = [
      createDraftExercise({
        exerciseId: pullUpExerciseId,
        id: "intake-exercise-0",
        name: "引体向上",
      }),
    ];

    const result = appendIntakeExercisesToDraft(current, incoming);

    expect(result.addedCount).toBe(1);
    expect(result.mergedCount).toBe(0);
    expect(result.next).toHaveLength(2);
    expect(result.next[1]?.exerciseId).toBe(pullUpExerciseId);
  });

  it("regenerates exercise and set ids so appended entries stay unique", () => {
    const current = [createDraftExercise()];
    const incoming = [
      createDraftExercise({
        exerciseId: pullUpExerciseId,
        id: "exercise-existing",
        sets: [
          {
            completed: true,
            effort: "normal",
            id: "set-existing-1",
            reps: "10",
            restSeconds: null,
            weightKg: "0",
          },
        ],
      }),
    ];

    const result = appendIntakeExercisesToDraft(current, incoming);
    const ids = result.next.flatMap((exercise) => [
      exercise.id,
      ...exercise.sets.map((set) => set.id),
    ]);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
