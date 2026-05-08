import type {
  CreateWorkoutRequest,
  WorkoutSetInput,
} from "../../../../shared/src/training";

import type { DictionaryExercise } from "./dictionary-api";

export type EffortLevel = "easy" | "normal" | "hard";

export interface DraftSet {
  completed: boolean;
  effort: EffortLevel;
  id: string;
  reps: string;
  restSeconds: number | null;
  weightKg: string;
}

export interface DraftExercise {
  categoryLabel: string;
  exercise: DictionaryExercise;
  exerciseId: string;
  id: string;
  isExpanded: boolean;
  name: string;
  sets: DraftSet[];
}

export function createDraftExercise(
  exercise: DictionaryExercise,
  categoryLabel: string,
): DraftExercise {
  return {
    categoryLabel,
    exercise,
    exerciseId: exercise.id,
    id: `exercise-${exercise.id}`,
    isExpanded: false,
    name: exercise.name_en,
    sets: [],
  };
}

export function createDraftSet(previousSet?: DraftSet): DraftSet {
  return {
    completed: false,
    effort: previousSet?.effort ?? "normal",
    id: createDraftSetId(),
    reps: previousSet?.reps ?? "",
    restSeconds: previousSet?.restSeconds ?? null,
    weightKg: previousSet?.weightKg ?? "",
  };
}

export function getCompletedValidSetCount(draftExercises: DraftExercise[]): number {
  return draftExercises.reduce((sum, exercise) => {
    return (
      sum +
      exercise.sets.filter((setDraft) => {
        return isDraftSetValid(setDraft) && setDraft.completed;
      }).length
    );
  }, 0);
}

export function getExerciseSummary(draftExercise: DraftExercise): {
  completedSets: number;
  totalVolumeKg: number;
} {
  return draftExercise.sets.reduce(
    (summary, setDraft) => {
      if (!(setDraft.completed && isDraftSetValid(setDraft))) {
        return summary;
      }

      const weightKg = Number.parseFloat(setDraft.weightKg);
      const reps = Number.parseInt(setDraft.reps, 10);

      return {
        completedSets: summary.completedSets + 1,
        totalVolumeKg: summary.totalVolumeKg + weightKg * reps,
      };
    },
    {
      completedSets: 0,
      totalVolumeKg: 0,
    },
  );
}

export function isDraftSetValid(setDraft: DraftSet): boolean {
  const weightKg = Number.parseFloat(setDraft.weightKg);
  const reps = Number.parseInt(setDraft.reps, 10);

  return Number.isFinite(weightKg) && weightKg > 0 && Number.isInteger(reps) && reps > 0;
}

export function mapEffortToRpe(effort: EffortLevel): number {
  if (effort === "easy") {
    return 6;
  }

  if (effort === "hard") {
    return 9;
  }

  return 8;
}

export function buildWorkoutRequestFromDraft(input: {
  draftExercises: DraftExercise[];
  elapsedSeconds: number;
  performedAt: Date;
}): CreateWorkoutRequest | null {
  const preparedSets: Array<Omit<WorkoutSetInput, "set_index">> = [];

  input.draftExercises.forEach((draftExercise) => {
    draftExercise.sets.forEach((setDraft) => {
      if (!(setDraft.completed && isDraftSetValid(setDraft))) {
        return;
      }

      preparedSets.push({
        exercise_id: draftExercise.exerciseId,
        is_warmup: false,
        reps: Number.parseInt(setDraft.reps, 10),
        rpe: mapEffortToRpe(setDraft.effort),
        weight_kg: Number.parseFloat(setDraft.weightKg),
      });
    });
  });

  if (preparedSets.length === 0) {
    return null;
  }

  return {
    duration_minutes: Math.floor(input.elapsedSeconds / 60),
    performed_at: input.performedAt.toISOString(),
    sets: assignSetIndexes(preparedSets),
  };
}

function assignSetIndexes(
  setInputs: Array<Omit<WorkoutSetInput, "set_index">>,
): WorkoutSetInput[] {
  const setIndexByExerciseId = new Map<string, number>();

  return setInputs.map((setInput) => {
    const currentIndex = (setIndexByExerciseId.get(setInput.exercise_id) ?? 0) + 1;
    setIndexByExerciseId.set(setInput.exercise_id, currentIndex);

    return {
      ...setInput,
      set_index: currentIndex,
    };
  });
}

function createDraftSetId(): string {
  return `set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
