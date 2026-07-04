import type {
  CreateWorkoutRequest,
  WorkoutSetInput,
} from "../../../../shared/src/training";
import type { DictionaryExercise } from "./dictionary-api";
import { getExerciseDisplayName } from "./exercise-display";
import type {
  WorkoutIntakeCandidateExercise,
  WorkoutIntakeDraft,
  WorkoutIntakeDraftExercise,
  WorkoutIntakeIncompleteSet,
} from "./workout-intake-api";

export function resolveWorkoutIntakeCandidate(
  draft: WorkoutIntakeDraft,
  exerciseIndex: number,
  candidate: WorkoutIntakeCandidateExercise,
): WorkoutIntakeDraft {
  return updateExercise(draft, exerciseIndex, (exercise) => ({
    ...exercise,
    match_confidence: candidate.confidence,
    match_status: "matched",
    matched_exercise_id: candidate.exercise_id,
    matched_exercise_name: candidate.exercise_name,
  }));
}

export function removeWorkoutIntakeExercise(
  draft: WorkoutIntakeDraft,
  exerciseIndex: number,
): WorkoutIntakeDraft {
  return {
    ...draft,
    exercises: draft.exercises.filter((_, index) => index !== exerciseIndex),
  };
}

export function resolveWorkoutIntakeExercise(
  draft: WorkoutIntakeDraft,
  exerciseIndex: number,
  exercise: DictionaryExercise,
): WorkoutIntakeDraft {
  return updateExercise(draft, exerciseIndex, (draftExercise) => ({
    ...draftExercise,
    match_confidence: 1,
    match_status: "matched",
    matched_exercise_id: exercise.id,
    matched_exercise_name: getDictionaryExerciseDisplayName(exercise),
  }));
}

export function resolveIncompleteSetFields(
  draft: WorkoutIntakeDraft,
  exerciseIndex: number,
  incompleteIndex: number,
  patch: Partial<Pick<WorkoutIntakeIncompleteSet, "reps" | "weight_kg">>,
): WorkoutIntakeDraft {
  return updateExercise(draft, exerciseIndex, (exercise) => {
    const target = exercise.incomplete_sets[incompleteIndex];

    if (!target) {
      return exercise;
    }

    const nextWeightKg = normalizePositiveNumber(
      patch.weight_kg ?? target.weight_kg,
    );
    const nextReps = normalizePositiveInteger(patch.reps ?? target.reps);
    const groupCount = target.group_count ?? 1;

    if (!nextWeightKg || !nextReps || groupCount <= 0) {
      return {
        ...exercise,
        incomplete_sets: exercise.incomplete_sets.map((incompleteSet, index) =>
          index === incompleteIndex
            ? {
                ...incompleteSet,
                missing_fields: buildMissingFields(nextWeightKg, nextReps),
                reps: nextReps,
                weight_kg: nextWeightKg,
              }
            : incompleteSet,
        ),
      };
    }

    const generatedSets = Array.from({ length: groupCount }, () => ({
      intensity_label: null,
      reps: nextReps,
      rpe: null,
      weight_kg: nextWeightKg,
    }));

    return {
      ...exercise,
      incomplete_sets: exercise.incomplete_sets.filter(
        (_, index) => index !== incompleteIndex,
      ),
      sets: [...exercise.sets, ...generatedSets],
    };
  });
}

export function updateWorkoutIntakeDraftDate(
  draft: WorkoutIntakeDraft,
  dateValue: string,
): WorkoutIntakeDraft {
  const nextPerformedAt = replaceIsoDatePart(draft.performed_at, dateValue);

  if (!nextPerformedAt) {
    return draft;
  }

  return {
    ...draft,
    date_label: dateValue,
    date_source: "request_performed_at",
    performed_at: nextPerformedAt,
  };
}

export type WorkoutIntakeSaveBlockReason =
  | "empty"
  | "incomplete_sets"
  | "invalid_sets"
  | "unmatched"
  | null;

export function getWorkoutIntakeSaveBlockReason(
  draft: WorkoutIntakeDraft,
): WorkoutIntakeSaveBlockReason {
  if (draft.exercises.length === 0) {
    return "empty";
  }

  if (
    draft.exercises.some(
      (exercise) =>
        !exercise.matched_exercise_id || exercise.match_status !== "matched",
    )
  ) {
    return "unmatched";
  }

  if (draft.exercises.some((exercise) => exercise.incomplete_sets.length > 0)) {
    return "incomplete_sets";
  }

  if (
    draft.exercises.some(
      (exercise) =>
        exercise.sets.length === 0 ||
        exercise.sets.some(
          (set) => !isValidDraftSet(set.weight_kg, set.reps, set.rpe),
        ),
    )
  ) {
    return "invalid_sets";
  }

  return null;
}

export function canSaveWorkoutIntakeDraft(draft: WorkoutIntakeDraft): boolean {
  return getWorkoutIntakeSaveBlockReason(draft) === null;
}

export function buildWorkoutRequestFromIntakeDraft(
  draft: WorkoutIntakeDraft,
): CreateWorkoutRequest | null {
  if (getWorkoutIntakeSaveBlockReason(draft) !== null) {
    return null;
  }

  const setIndexByExerciseId = new Map<string, number>();
  const sets: WorkoutSetInput[] = [];

  for (const exercise of draft.exercises) {
    const exerciseId = exercise.matched_exercise_id;

    if (!exerciseId) {
      return null;
    }

    for (const draftSet of exercise.sets) {
      const currentIndex = setIndexByExerciseId.get(exerciseId) ?? 0;
      const nextIndex = currentIndex + 1;
      setIndexByExerciseId.set(exerciseId, nextIndex);

      const setInput: WorkoutSetInput = {
        exercise_id: exerciseId,
        is_warmup: false,
        reps: draftSet.reps,
        set_index: nextIndex,
        weight_kg: draftSet.weight_kg,
      };

      if (draftSet.rpe !== null) {
        setInput.rpe = draftSet.rpe;
      }

      sets.push(setInput);
    }
  }

  if (sets.length === 0) {
    return null;
  }

  const request: CreateWorkoutRequest = {
    performed_at: draft.performed_at,
    sets,
  };

  if (draft.duration_min !== null) {
    request.duration_minutes = draft.duration_min;
  }

  const trimmedNote = draft.note?.trim();
  if (trimmedNote) {
    request.notes = trimmedNote;
  }

  return request;
}

function getDictionaryExerciseDisplayName(
  exercise: DictionaryExercise,
): string {
  return getExerciseDisplayName(exercise);
}

function replaceIsoDatePart(value: string, dateValue: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(dateValue)) {
    return null;
  }

  const match = /^(\d{4}-\d{2}-\d{2})(T.+)$/u.exec(value);

  if (!match) {
    return null;
  }

  return `${dateValue}${match[2]}`;
}

function updateExercise(
  draft: WorkoutIntakeDraft,
  exerciseIndex: number,
  update: (exercise: WorkoutIntakeDraftExercise) => WorkoutIntakeDraftExercise,
): WorkoutIntakeDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((exercise, index) =>
      index === exerciseIndex ? update(exercise) : exercise,
    ),
  };
}

function buildMissingFields(
  weightKg: number | null,
  reps: number | null,
): Array<"weight_kg" | "reps"> {
  const missingFields: Array<"weight_kg" | "reps"> = [];

  if (!weightKg) {
    missingFields.push("weight_kg");
  }

  if (!reps) {
    missingFields.push("reps");
  }

  return missingFields;
}

function normalizePositiveNumber(
  value: number | null | undefined,
): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function normalizePositiveInteger(
  value: number | null | undefined,
): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function isValidDraftSet(
  weightKg: number,
  reps: number,
  rpe: number | null,
): boolean {
  const hasValidWeight = Number.isFinite(weightKg) && weightKg > 0;
  const hasValidReps = Number.isInteger(reps) && reps > 0;
  const hasValidRpe = rpe === null || (Number.isFinite(rpe) && rpe > 0);

  return hasValidWeight && hasValidReps && hasValidRpe;
}
