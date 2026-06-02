import type { DictionaryExercise } from "./dictionary-api";
import {
  getExerciseCategoryLabel as getDisplayExerciseCategoryLabel,
  getExerciseDisplayName,
} from "./exercise-display";
import {
  getExerciseLoadType,
  type DraftExercise,
  type DraftSet,
  type EffortLevel,
  type TrainingSessionInitialDraft,
} from "./training-session-draft";
import type {
  WorkoutIntakeDraft,
  WorkoutIntakeDraftExercise,
  WorkoutIntakeDraftSet,
  WorkoutIntakeIncompleteSet,
} from "./workout-intake-api";

export function mapWorkoutIntakeDraftToSessionInitialDraft(
  draft: WorkoutIntakeDraft,
  exerciseDictionary: DictionaryExercise[],
): TrainingSessionInitialDraft {
  return {
    durationMin: draft.duration_min,
    exercises: draft.exercises.map((exercise, index) =>
      mapWorkoutIntakeExerciseToDraftExercise(exercise, exerciseDictionary, index),
    ),
    note: draft.note,
    performedAt: draft.performed_at,
    source: "intake",
  };
}

function mapWorkoutIntakeExerciseToDraftExercise(
  exercise: WorkoutIntakeDraftExercise,
  exerciseDictionary: DictionaryExercise[],
  index: number,
): DraftExercise {
  const matchedExercise =
    exercise.match_status === "matched" && exercise.matched_exercise_id
      ? (exerciseDictionary.find((item) => item.id === exercise.matched_exercise_id) ??
        null)
      : null;
  const matchStatus = matchedExercise ? "matched" : exercise.match_status;
  const displayName =
    (matchedExercise ? getExerciseDisplayName(matchedExercise) : null) ??
    exercise.matched_exercise_name ??
    exercise.input_name;
  const loadType = matchedExercise ? getExerciseLoadType(matchedExercise) : "weighted";

  return {
    candidateExercises: exercise.candidate_exercises.map((candidate) => ({
      exerciseId: candidate.exercise_id,
      exerciseName: candidate.exercise_name,
    })),
    categoryLabel: matchedExercise ? getDisplayExerciseCategoryLabel(matchedExercise) : "\u9700\u8981\u786e\u8ba4",
    exercise: matchedExercise,
    exerciseId: matchedExercise?.id ?? null,
    id: `intake-exercise-${index}-${exercise.input_name}`,
    inputName: exercise.input_name,
    isExpanded: true,
    loadType,
    matchStatus,
    name: displayName,
    sets: [
      ...exercise.sets.map((set, setIndex) =>
        mapCompleteSet(set, setIndex, loadType),
      ),
      ...exercise.incomplete_sets.flatMap((set, incompleteIndex) =>
        mapIncompleteSet(set, incompleteIndex),
      ),
    ],
  };
}

function mapCompleteSet(
  set: WorkoutIntakeDraftSet,
  index: number,
  loadType: DraftExercise["loadType"],
): DraftSet {
  return {
    completed: loadType !== "timed",
    effort: mapRpeToEffort(set.rpe),
    id: `intake-set-${index}`,
    reps: `${set.reps}`,
    restSeconds: null,
    weightKg: `${set.weight_kg}`,
  };
}

function mapIncompleteSet(
  set: WorkoutIntakeIncompleteSet,
  incompleteIndex: number,
): DraftSet[] {
  const count = set.group_count ?? 1;

  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    completed: false,
    effort: "normal",
    id: `intake-incomplete-${incompleteIndex}-${index}`,
    reps: set.reps === null ? "" : `${set.reps}`,
    restSeconds: null,
    weightKg: set.weight_kg === null ? "" : `${set.weight_kg}`,
  }));
}

function mapRpeToEffort(rpe: number | null): EffortLevel {
  if (rpe !== null && rpe >= 9) {
    return "hard";
  }

  if (rpe !== null && rpe <= 6) {
    return "easy";
  }

  return "normal";
}
