import { describe, expect, it } from "vitest";

import type { DictionaryExercise } from "./dictionary-api";
import type { WorkoutIntakeDraft } from "./workout-intake-api";
import {
  buildWorkoutRequestFromIntakeDraft,
  getWorkoutIntakeSaveBlockReason,
  removeWorkoutIntakeExercise,
  resolveIncompleteSetFields,
  updateWorkoutIntakeDraftDate,
  resolveWorkoutIntakeCandidate,
  resolveWorkoutIntakeExercise,
} from "./workout-intake-draft";

function createMatchedDraft(): WorkoutIntakeDraft {
  return {
    duration_min: 55,
    date_label: null,
    date_source: "request_performed_at",
    exercises: [
      {
        candidate_exercises: [
          {
            confidence: 0.95,
            exercise_id: "bench-id",
            exercise_name: "Barbell Bench Press",
          },
        ],
        incomplete_sets: [],
        input_name: "bench",
        match_confidence: 0.95,
        match_status: "matched",
        matched_exercise_id: "bench-id",
        matched_exercise_name: "Barbell Bench Press",
        sets: [
          {
            intensity_label: null,
            reps: 10,
            rpe: null,
            weight_kg: 60,
          },
          {
            intensity_label: null,
            reps: 8,
            rpe: 8,
            weight_kg: 65,
          },
        ],
      },
      {
        candidate_exercises: [
          {
            confidence: 0.93,
            exercise_id: "row-id",
            exercise_name: "Seated Cable Row",
          },
        ],
        incomplete_sets: [],
        input_name: "row",
        match_confidence: 0.93,
        match_status: "matched",
        matched_exercise_id: "row-id",
        matched_exercise_name: "Seated Cable Row",
        sets: [
          {
            intensity_label: null,
            reps: 12,
            rpe: null,
            weight_kg: 50,
          },
          {
            intensity_label: null,
            reps: 10,
            rpe: null,
            weight_kg: 55,
          },
        ],
      },
    ],
    note: "quick intake",
    performed_at: "2026-05-30T10:00:00.000Z",
  };
}

function createDictionaryExercise(
  overrides: Partial<DictionaryExercise> = {},
): DictionaryExercise {
  return {
    code: "lat_pulldown_cable",
    equipment: "cable",
    id: "lat-pulldown-id",
    movement_pattern: "pull",
    muscles: [],
    name_en: "Lat Pulldown",
    name_zh: "高位下拉",
    ...overrides,
  };
}

describe("buildWorkoutRequestFromIntakeDraft", () => {
  it("converts a fully matched intake draft into a create workout request", () => {
    const request = buildWorkoutRequestFromIntakeDraft(createMatchedDraft());

    expect(request).toEqual({
      duration_minutes: 55,
      notes: "quick intake",
      performed_at: "2026-05-30T10:00:00.000Z",
      sets: [
        {
          exercise_id: "bench-id",
          is_warmup: false,
          reps: 10,
          set_index: 1,
          weight_kg: 60,
        },
        {
          exercise_id: "bench-id",
          is_warmup: false,
          reps: 8,
          rpe: 8,
          set_index: 2,
          weight_kg: 65,
        },
        {
          exercise_id: "row-id",
          is_warmup: false,
          reps: 12,
          set_index: 1,
          weight_kg: 50,
        },
        {
          exercise_id: "row-id",
          is_warmup: false,
          reps: 10,
          set_index: 2,
          weight_kg: 55,
        },
      ],
    });
  });

  it("uses the edited draft training date when building the create workout request", () => {
    const updated = updateWorkoutIntakeDraftDate(createMatchedDraft(), "2026-05-29");
    const request = buildWorkoutRequestFromIntakeDraft(updated);

    expect(updated).toMatchObject({
      date_label: "2026-05-29",
      date_source: "request_performed_at",
      performed_at: "2026-05-29T10:00:00.000Z",
    });
    expect(request?.performed_at).toBe("2026-05-29T10:00:00.000Z");
  });

  it("blocks ambiguous and unresolved exercises until they are resolved or deleted", () => {
    const draft = createMatchedDraft();
    const [firstExercise, secondExercise] = draft.exercises;

    if (!firstExercise || !secondExercise) {
      throw new Error("Expected matched draft fixture to include two exercises.");
    }

    draft.exercises[0] = {
      ...firstExercise,
      match_status: "ambiguous",
      matched_exercise_id: null,
      matched_exercise_name: null,
    };
    draft.exercises[1] = {
      ...secondExercise,
      match_status: "unresolved",
      matched_exercise_id: null,
      matched_exercise_name: null,
    };

    expect(buildWorkoutRequestFromIntakeDraft(draft)).toBeNull();

    const resolved = resolveWorkoutIntakeCandidate(draft, 0, {
      confidence: 0.91,
      exercise_id: "bench-id",
      exercise_name: "Barbell Bench Press",
    });
    const trimmed = removeWorkoutIntakeExercise(resolved, 1);

    expect(buildWorkoutRequestFromIntakeDraft(trimmed)?.sets).toHaveLength(2);
  });

  it("allows unresolved exercises to be manually resolved from dictionary results", () => {
    const draft = createMatchedDraft();
    const firstExercise = draft.exercises[0];

    if (!firstExercise) {
      throw new Error("Expected matched draft fixture to include an exercise.");
    }

    draft.exercises[0] = {
      ...firstExercise,
      input_name: "unknown pull movement",
      match_status: "unresolved",
      matched_exercise_id: null,
      matched_exercise_name: null,
    };

    expect(buildWorkoutRequestFromIntakeDraft(draft)).toBeNull();

    const resolved = resolveWorkoutIntakeExercise(
      draft,
      0,
      createDictionaryExercise(),
    );

    expect(resolved.exercises[0]?.input_name).toBe("unknown pull movement");
    expect(resolved.exercises[0]?.sets).toEqual(firstExercise.sets);
    expect(resolved.exercises[0]?.match_status).toBe("matched");
    expect(resolved.exercises[0]?.matched_exercise_id).toBe("lat-pulldown-id");
    expect(resolved.exercises[0]?.matched_exercise_name).toBe("高位下拉");
    expect(buildWorkoutRequestFromIntakeDraft(resolved)?.sets[0]).toMatchObject({
      exercise_id: "lat-pulldown-id",
      set_index: 1,
    });
  });

  it("allows ambiguous exercises to be manually overridden by a non-candidate exercise", () => {
    const draft = createMatchedDraft();
    const firstExercise = draft.exercises[0];

    if (!firstExercise) {
      throw new Error("Expected matched draft fixture to include an exercise.");
    }

    draft.exercises[0] = {
      ...firstExercise,
      candidate_exercises: [
        {
          confidence: 0.84,
          exercise_id: "barbell-row-id",
          exercise_name: "Barbell Row",
        },
      ],
      match_status: "ambiguous",
      matched_exercise_id: null,
      matched_exercise_name: null,
    };

    const resolved = resolveWorkoutIntakeExercise(
      draft,
      0,
      createDictionaryExercise({
        code: "dumbbell_row",
        id: "dumbbell-row-id",
        name_en: "Dumbbell Row",
        name_zh: "哑铃划船",
      }),
    );

    expect(resolved.exercises[0]?.match_status).toBe("matched");
    expect(resolved.exercises[0]?.matched_exercise_id).toBe("dumbbell-row-id");
    expect(resolved.exercises[0]?.matched_exercise_name).toBe("哑铃划船");
  });

  it("blocks drafts with empty or invalid sets", () => {
    const emptySetDraft = createMatchedDraft();
    const emptySetExercise = emptySetDraft.exercises[0];

    if (!emptySetExercise) {
      throw new Error("Expected matched draft fixture to include an exercise.");
    }

    emptySetDraft.exercises[0] = {
      ...emptySetExercise,
      sets: [],
    };

    expect(buildWorkoutRequestFromIntakeDraft(emptySetDraft)).toBeNull();

    const invalidSetDraft = createMatchedDraft();
    const invalidSetExercise = invalidSetDraft.exercises[0];

    if (!invalidSetExercise) {
      throw new Error("Expected matched draft fixture to include an exercise.");
    }

    invalidSetDraft.exercises[0] = {
      ...invalidSetExercise,
      sets: [
        {
          intensity_label: null,
          reps: 0,
          rpe: null,
          weight_kg: 60,
        },
      ],
    };

    expect(buildWorkoutRequestFromIntakeDraft(invalidSetDraft)).toBeNull();
  });

  it("blocks incomplete recognized sets until the transcript is corrected and reparsed", () => {
    const draft = createMatchedDraft();
    const firstExercise = draft.exercises[0];

    if (!firstExercise) {
      throw new Error("Expected matched draft fixture to include an exercise.");
    }

    draft.exercises[0] = {
      ...firstExercise,
      incomplete_sets: [
        {
          group_count: 10,
          message: "已识别 10 组，每组 70kg，但缺少每组次数，请补充后重新解析。",
          missing_fields: ["reps"],
          reps: null,
          weight_kg: 70,
        },
      ],
      sets: [],
    };

    expect(buildWorkoutRequestFromIntakeDraft(draft)).toBeNull();
    expect(getWorkoutIntakeSaveBlockReason(draft)).toBe("incomplete_sets");
  });

  it("fills missing reps on an incomplete set and generates repeated valid sets", () => {
    const draft = createMatchedDraft();
    const firstExercise = draft.exercises[0];

    if (!firstExercise) {
      throw new Error("Expected matched draft fixture to include an exercise.");
    }

    draft.exercises[0] = {
      ...firstExercise,
      incomplete_sets: [
        {
          group_count: 10,
          message: "已识别 10 组，每组 70kg，但缺少每组次数。",
          missing_fields: ["reps"],
          reps: null,
          weight_kg: 70,
        },
      ],
      sets: [],
    };

    const resolved = resolveIncompleteSetFields(draft, 0, 0, { reps: 10 });

    expect(resolved.exercises[0]?.incomplete_sets).toEqual([]);
    expect(resolved.exercises[0]?.sets).toHaveLength(10);
    expect(resolved.exercises[0]?.sets).toEqual(
      Array.from({ length: 10 }, () => ({
        intensity_label: null,
        reps: 10,
        rpe: null,
        weight_kg: 70,
      })),
    );
    expect(buildWorkoutRequestFromIntakeDraft(resolved)?.sets.slice(0, 10)).toEqual(
      Array.from({ length: 10 }, (_, index) => ({
        exercise_id: "bench-id",
        is_warmup: false,
        reps: 10,
        set_index: index + 1,
        weight_kg: 70,
      })),
    );
  });

  it("fills missing weight on an incomplete set and rejects invalid completion values", () => {
    const draft = createMatchedDraft();
    const firstExercise = draft.exercises[0];

    if (!firstExercise) {
      throw new Error("Expected matched draft fixture to include an exercise.");
    }

    draft.exercises[0] = {
      ...firstExercise,
      incomplete_sets: [
        {
          group_count: 3,
          message: "已识别 3 组，每组 10 次，但缺少重量。",
          missing_fields: ["weight_kg"],
          reps: 10,
          weight_kg: null,
        },
      ],
      sets: [],
    };

    const invalid = resolveIncompleteSetFields(draft, 0, 0, { weight_kg: 0 });

    expect(invalid.exercises[0]?.incomplete_sets).toHaveLength(1);
    expect(buildWorkoutRequestFromIntakeDraft(invalid)).toBeNull();

    const resolved = resolveIncompleteSetFields(draft, 0, 0, { weight_kg: 70 });

    expect(resolved.exercises[0]?.incomplete_sets).toEqual([]);
    expect(resolved.exercises[0]?.sets).toEqual(
      Array.from({ length: 3 }, () => ({
        intensity_label: null,
        reps: 10,
        rpe: null,
        weight_kg: 70,
      })),
    );
  });
});
