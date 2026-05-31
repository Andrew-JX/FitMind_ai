import type {
  AddWorkoutSetRequest,
  UpdateWorkoutRequest,
  UpdateWorkoutSetRequest,
  WorkoutDetailDto,
} from "../../../../shared/src/training";
import type { DictionaryExercise } from "./dictionary-api";
import {
  getExerciseLoadType,
  isDraftSetValid,
  mapEffortToRpe,
  type DraftSet,
  type EffortLevel,
  type TrainingSessionInitialDraft,
} from "./training-session-draft";

export interface WorkoutEditPlan {
  setAdds: AddWorkoutSetRequest[];
  setDeletes: string[];
  setPatches: Array<{
    input: UpdateWorkoutSetRequest;
    setId: string;
  }>;
  workoutPatch: UpdateWorkoutRequest | null;
}

export function mapWorkoutToSessionInitialDraft(
  workout: WorkoutDetailDto,
  exerciseDictionary: DictionaryExercise[],
): TrainingSessionInitialDraft {
  const exerciseById = new Map(exerciseDictionary.map((exercise) => [exercise.id, exercise]));
  const groupedSets = new Map<string, WorkoutDetailDto["sets"]>();

  for (const set of workout.sets) {
    groupedSets.set(set.exercise_id, [...(groupedSets.get(set.exercise_id) ?? []), set]);
  }

  return {
    durationMin: workout.duration_minutes,
    endedAt: workout.ended_at,
    exercises: Array.from(groupedSets.entries()).map(([exerciseId, sets]) => {
      const exercise = exerciseById.get(exerciseId) ?? null;

      return {
        candidateExercises: [],
        categoryLabel: exercise ? getExerciseCategoryLabel(exercise) : "\u672a\u77e5",
        exercise,
        exerciseId: exercise?.id ?? exerciseId,
        id: `edit-exercise-${exerciseId}`,
        inputName: null,
        isExpanded: false,
        loadType: exercise ? getExerciseLoadType(exercise) : "weighted",
        matchStatus: exercise ? "matched" : "unresolved",
        name: exercise?.name_en ?? "\u672a\u77e5\u52a8\u4f5c",
        sets: [...sets]
          .sort((left, right) => left.set_index - right.set_index)
          .map((set) => mapWorkoutSetToDraftSet(set)),
      };
    }),
    note: workout.notes,
    originalWorkout: workout,
    performedAt: workout.performed_at,
    source: "edit",
    startedAt: workout.started_at,
    workoutId: workout.id,
  };
}

export function buildWorkoutEditPlan(
  originalWorkout: WorkoutDetailDto,
  draft: TrainingSessionInitialDraft,
): WorkoutEditPlan {
  const workoutPatch = buildWorkoutPatch(originalWorkout, draft);
  const originalSetById = new Map(originalWorkout.sets.map((set) => [set.id, set]));
  const currentPersistedSetIds = new Set<string>();
  const setAdds: AddWorkoutSetRequest[] = [];
  const setPatches: WorkoutEditPlan["setPatches"] = [];
  const setIndexByExerciseId = new Map<string, number>();

  for (const exercise of draft.exercises) {
    if (!exercise.exerciseId || exercise.matchStatus !== "matched") {
      continue;
    }

    for (const setDraft of exercise.sets) {
      if (!(setDraft.completed && isDraftSetValid(setDraft, exercise))) {
        continue;
      }

      const nextIndex = (setIndexByExerciseId.get(exercise.exerciseId) ?? 0) + 1;
      setIndexByExerciseId.set(exercise.exerciseId, nextIndex);
      const setPayload = buildSetPayload(exercise.exerciseId, setDraft, nextIndex);

      if (!setDraft.persistedSetId) {
        setAdds.push(setPayload);
        continue;
      }

      currentPersistedSetIds.add(setDraft.persistedSetId);
      const originalSet = originalSetById.get(setDraft.persistedSetId);

      if (!originalSet || isSetPayloadChanged(originalSet, setPayload)) {
        setPatches.push({
          input: {
            reps: setPayload.reps,
            rpe: setPayload.rpe,
            set_index: setPayload.set_index,
            weight_kg: setPayload.weight_kg,
          },
          setId: setDraft.persistedSetId,
        });
      }
    }
  }

  const setDeletes = originalWorkout.sets
    .map((set) => set.id)
    .filter((setId) => !currentPersistedSetIds.has(setId));

  return {
    setAdds,
    setDeletes,
    setPatches,
    workoutPatch,
  };
}

function mapWorkoutSetToDraftSet(
  set: WorkoutDetailDto["sets"][number],
): DraftSet {
  return {
    completed: true,
    effort: mapRpeToEffort(set.rpe),
    id: `persisted-${set.id}`,
    persistedSetId: set.id,
    reps: `${set.reps}`,
    restSeconds: null,
    weightKg: `${set.weight_kg}`,
  };
}

function buildWorkoutPatch(
  originalWorkout: WorkoutDetailDto,
  draft: TrainingSessionInitialDraft,
): UpdateWorkoutRequest | null {
  const patch: UpdateWorkoutRequest = {};
  const nextPerformedAt = draft.startedAt ?? draft.performedAt;

  if (nextPerformedAt !== originalWorkout.performed_at) {
    patch.performed_at = nextPerformedAt;
  }

  if (draft.startedAt !== originalWorkout.started_at) {
    patch.started_at = draft.startedAt ?? null;
  }

  if (draft.endedAt !== originalWorkout.ended_at) {
    patch.ended_at = draft.endedAt ?? null;
  }

  if (draft.durationMin !== originalWorkout.duration_minutes) {
    if (draft.durationMin !== null) {
      patch.duration_minutes = draft.durationMin;
    }
  }

  const nextNotes = draft.note?.trim() ?? "";
  const originalNotes = originalWorkout.notes?.trim() ?? "";

  if (nextNotes !== originalNotes) {
    patch.notes = nextNotes;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function buildSetPayload(
  exerciseId: string,
  setDraft: DraftSet,
  setIndex: number,
): AddWorkoutSetRequest {
  return {
    exercise_id: exerciseId,
    is_warmup: false,
    reps: Number.parseInt(setDraft.reps, 10),
    rpe: mapEffortToRpe(setDraft.effort),
    set_index: setIndex,
    weight_kg: Number.parseFloat(setDraft.weightKg || "0"),
  };
}

function isSetPayloadChanged(
  originalSet: WorkoutDetailDto["sets"][number],
  nextPayload: AddWorkoutSetRequest,
): boolean {
  return (
    originalSet.reps !== nextPayload.reps ||
    originalSet.weight_kg !== nextPayload.weight_kg ||
    originalSet.set_index !== nextPayload.set_index ||
    (originalSet.rpe ?? null) !== (nextPayload.rpe ?? null)
  );
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

function getExerciseCategoryLabel(exercise: DictionaryExercise): string {
  const primaryCodes = exercise.muscles
    .filter((muscle) => muscle.is_primary)
    .map((muscle) => muscle.code.toLowerCase());

  if (primaryCodes.some((code) => code.includes("back") || code.includes("lat"))) {
    return "\u80cc";
  }

  if (primaryCodes.some((code) => code.includes("chest") || code === "pecs")) {
    return "\u80f8";
  }

  if (primaryCodes.some((code) => code.includes("quad") || code.includes("leg"))) {
    return "\u817f";
  }

  return "\u5176\u4ed6";
}
