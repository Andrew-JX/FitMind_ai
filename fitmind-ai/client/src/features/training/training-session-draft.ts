import type {
  CreateWorkoutRequest,
  WorkoutDetailDto,
  WorkoutSetInput,
} from "../../../../shared/src/training";

import type { DictionaryExercise } from "./dictionary-api";
import { getExerciseDisplayName } from "./exercise-display";

export type EffortLevel = "easy" | "normal" | "hard";
export type ExerciseLoadType = "weighted" | "bodyweight" | "timed";
export type DraftExerciseMatchStatus = "matched" | "ambiguous" | "unresolved";

export interface DraftExerciseCandidate {
  exerciseId: string;
  exerciseName: string;
}

export interface DraftSet {
  completed: boolean;
  effort: EffortLevel;
  id: string;
  /** Warm-up marker (design 热身组). Persists to `is_warmup`; still counted. */
  isWarmup: boolean;
  persistedSetId?: string | null | undefined;
  reps: string;
  restSeconds: number | null;
  weightKg: string;
}

export interface DraftExercise {
  categoryLabel: string;
  candidateExercises: DraftExerciseCandidate[];
  exercise: DictionaryExercise | null;
  exerciseId: string | null;
  id: string;
  inputName: string | null;
  isExpanded: boolean;
  loadType: ExerciseLoadType;
  matchStatus: DraftExerciseMatchStatus;
  name: string;
  sets: DraftSet[];
}

export interface TrainingSessionInitialDraft {
  durationMin: number | null;
  endedAt?: string | null | undefined;
  exercises: DraftExercise[];
  note: string | null;
  originalWorkout?: WorkoutDetailDto | undefined;
  performedAt: string;
  source: "manual" | "intake" | "edit";
  startedAt?: string | null | undefined;
  workoutId?: string | undefined;
}

export function createDraftExercise(
  exercise: DictionaryExercise,
  categoryLabel: string,
): DraftExercise {
  return {
    categoryLabel,
    candidateExercises: [],
    exercise,
    exerciseId: exercise.id,
    id: `exercise-${exercise.id}`,
    inputName: null,
    isExpanded: false,
    loadType: getExerciseLoadType(exercise),
    matchStatus: "matched",
    name: getExerciseDisplayName(exercise),
    sets: [],
  };
}

export function createDraftSet(previousSet?: DraftSet): DraftSet {
  return {
    completed: false,
    effort: previousSet?.effort ?? "normal",
    id: createDraftSetId(),
    isWarmup: previousSet?.isWarmup ?? false,
    reps: previousSet?.reps ?? "",
    restSeconds: previousSet?.restSeconds ?? null,
    weightKg: previousSet?.weightKg ?? "",
  };
}

export function getCompletedValidSetCount(
  draftExercises: DraftExercise[],
): number {
  return draftExercises.reduce((sum, exercise) => {
    return (
      sum +
      exercise.sets.filter((setDraft) => {
        return (
          exercise.matchStatus === "matched" &&
          isDraftSetValid(setDraft, exercise) &&
          setDraft.completed
        );
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
      if (!(setDraft.completed && isDraftSetValid(setDraft, draftExercise))) {
        return summary;
      }

      const weightKg = getDraftSetWeightKg(setDraft, draftExercise);
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

export function isDraftSetValid(
  setDraft: DraftSet,
  draftExercise?: Pick<DraftExercise, "loadType">,
): boolean {
  const weightKg = getDraftSetWeightKg(setDraft, draftExercise);
  const reps = Number.parseInt(setDraft.reps, 10);

  return (
    Number.isFinite(weightKg) &&
    weightKg >= 0 &&
    Number.isInteger(reps) &&
    reps > 0
  );
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
  durationMinutes?: number | null | undefined;
  endedAt?: string | null | undefined;
  notes?: string | null | undefined;
  performedAt: Date;
  startedAt?: string | null | undefined;
}): CreateWorkoutRequest | null {
  const preparedSets: Array<Omit<WorkoutSetInput, "set_index">> = [];

  input.draftExercises.forEach((draftExercise) => {
    draftExercise.sets.forEach((setDraft) => {
      if (
        !draftExercise.exerciseId ||
        draftExercise.matchStatus !== "matched" ||
        !(setDraft.completed && isDraftSetValid(setDraft, draftExercise))
      ) {
        return;
      }

      preparedSets.push({
        exercise_id: draftExercise.exerciseId,
        is_warmup: setDraft.isWarmup,
        reps: Number.parseInt(setDraft.reps, 10),
        rpe: mapEffortToRpe(setDraft.effort),
        weight_kg: getDraftSetWeightKg(setDraft, draftExercise),
      });
    });
  });

  if (preparedSets.length === 0) {
    return null;
  }

  const durationMinutes =
    input.durationMinutes ?? Math.floor(input.elapsedSeconds / 60);
  const request: CreateWorkoutRequest = {
    performed_at: input.performedAt.toISOString(),
    sets: assignSetIndexes(preparedSets),
  };

  if (input.startedAt !== undefined) {
    request.started_at = input.startedAt;
  }

  if (input.endedAt !== undefined) {
    request.ended_at = input.endedAt;
  }

  if (durationMinutes > 0) {
    request.duration_minutes = durationMinutes;
  }

  const trimmedNotes = input.notes?.trim();
  if (trimmedNotes) {
    request.notes = trimmedNotes;
  }

  return request;
}

function assignSetIndexes(
  setInputs: Array<Omit<WorkoutSetInput, "set_index">>,
): WorkoutSetInput[] {
  const setIndexByExerciseId = new Map<string, number>();

  return setInputs.map((setInput) => {
    const currentIndex =
      (setIndexByExerciseId.get(setInput.exercise_id) ?? 0) + 1;
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

export function getExerciseLoadType(
  exercise: DictionaryExercise,
): ExerciseLoadType {
  if (exercise.code === "plank_bodyweight") {
    return "timed";
  }

  if (
    exercise.equipment?.toLowerCase() === "bodyweight" ||
    isBodyweightCode(exercise.code)
  ) {
    return "bodyweight";
  }

  return "weighted";
}

function getDraftSetWeightKg(
  setDraft: DraftSet,
  draftExercise?: Pick<DraftExercise, "loadType">,
): number {
  if (
    draftExercise?.loadType === "bodyweight" &&
    setDraft.weightKg.trim() === ""
  ) {
    return 0;
  }

  return Number.parseFloat(setDraft.weightKg);
}

function isBodyweightCode(code: string): boolean {
  return (
    code.endsWith("_bodyweight") ||
    [
      "pull_up",
      "chin_up",
      "push_up",
      "dip",
      "crunch",
      "hanging_leg_raise",
      "russian_twist",
    ].some((bodyweightCode) => code.includes(bodyweightCode))
  );
}
