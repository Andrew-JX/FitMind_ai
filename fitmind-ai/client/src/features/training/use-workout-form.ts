import { useState } from "react";

import type {
  CreateWorkoutRequest,
  WorkoutDetailDto,
  WorkoutSetInput,
} from "../../../../shared/src/training";

import { HttpClientError } from "../../services/http-client";
import {
  searchExercises,
  type DictionaryExercise,
} from "./dictionary-api";
import { createWorkout } from "./workout-api";

export interface WorkoutSetDraft {
  exerciseId: string;
  exerciseName: string;
  exerciseQuery: string;
  exerciseResults: DictionaryExercise[];
  isSearchingExercises: boolean;
  isWarmup: boolean;
  notes: string;
  reps: string;
  rpe: string;
  weightKg: string;
}

export interface UseWorkoutFormResult {
  addSetDraft: () => void;
  createdWorkout: WorkoutDetailDto | null;
  errorMessage: string | null;
  isSubmitting: boolean;
  performedAt: string;
  removeSetDraft: (index: number) => void;
  searchExercisesForSet: (index: number) => Promise<void>;
  selectExerciseForSet: (index: number, exercise: DictionaryExercise) => void;
  setDurationMinutes: (value: string) => void;
  setNotes: (value: string) => void;
  setPerformedAt: (value: string) => void;
  setSetDraftField: <TField extends keyof WorkoutSetDraft>(
    index: number,
    field: TField,
    value: WorkoutSetDraft[TField],
  ) => void;
  setDrafts: WorkoutSetDraft[];
  submitWorkout: () => Promise<WorkoutDetailDto | null>;
  workoutNotes: string;
  workoutDurationMinutes: string;
}

const defaultPerformedAt = formatDateTimeLocal(new Date());

/**
 * Manages the MVP workout creation form, including exercise search and set_index generation.
 *
 * @param token - The current in-memory auth token
 * @returns Form state and actions for creating a workout
 */
export function useWorkoutForm(token: string | null): UseWorkoutFormResult {
  const [performedAt, setPerformedAt] = useState(defaultPerformedAt);
  const [workoutDurationMinutes, setDurationMinutes] = useState("");
  const [workoutNotes, setNotes] = useState("");
  const [setDrafts, setSetDrafts] = useState<WorkoutSetDraft[]>([createEmptySetDraft()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdWorkout, setCreatedWorkout] = useState<WorkoutDetailDto | null>(null);

  function addSetDraft(): void {
    setSetDrafts((currentDrafts) => {
      return [...currentDrafts, createEmptySetDraft()];
    });
  }

  function removeSetDraft(index: number): void {
    setSetDrafts((currentDrafts) => {
      if (currentDrafts.length === 1) {
        return currentDrafts;
      }

      return currentDrafts.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  function setSetDraftField<TField extends keyof WorkoutSetDraft>(
    index: number,
    field: TField,
    value: WorkoutSetDraft[TField],
  ): void {
    setSetDrafts((currentDrafts) => {
      return currentDrafts.map((draft, currentIndex) => {
        if (currentIndex !== index) {
          return draft;
        }

        return {
          ...draft,
          [field]: value,
        };
      });
    });
  }

  async function searchExercisesForSet(index: number): Promise<void> {
    const draft = setDrafts[index];

    if (!draft) {
      return;
    }

    setErrorMessage(null);
    setSetDraftField(index, "isSearchingExercises", true);

    try {
      const items = await searchExercises({
        q: draft.exerciseQuery || undefined,
      });

      setSetDraftField(index, "exerciseResults", items);
    } catch (error) {
      setErrorMessage(getReadableErrorMessage(error));
      setSetDraftField(index, "exerciseResults", []);
    } finally {
      setSetDraftField(index, "isSearchingExercises", false);
    }
  }

  function selectExerciseForSet(index: number, exercise: DictionaryExercise): void {
    setSetDrafts((currentDrafts) => {
      return currentDrafts.map((draft, currentIndex) => {
        if (currentIndex !== index) {
          return draft;
        }

        return {
          ...draft,
          exerciseId: exercise.id,
          exerciseName: exercise.name_en,
          exerciseQuery: exercise.name_en,
          exerciseResults: [],
        };
      });
    });
  }

  async function submitWorkout(): Promise<WorkoutDetailDto | null> {
    if (!token) {
      setErrorMessage("You must be signed in to create a workout.");
      return null;
    }

    setErrorMessage(null);
    setCreatedWorkout(null);

    let payload: CreateWorkoutRequest;

    try {
      payload = buildCreateWorkoutRequest({
        performedAt,
        setDrafts,
        workoutDurationMinutes,
        workoutNotes,
      });
    } catch (error) {
      setErrorMessage(getReadableErrorMessage(error));
      return null;
    }

    setIsSubmitting(true);

    try {
      const workout = await createWorkout(token, payload);

      setCreatedWorkout(workout);
      setWorkoutFormToDefaults({
        setDurationMinutes,
        setNotes,
        setPerformedAt,
        setSetDrafts,
      });
      return workout;
    } catch (error) {
      setErrorMessage(getReadableErrorMessage(error));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    addSetDraft,
    createdWorkout,
    errorMessage,
    isSubmitting,
    performedAt,
    removeSetDraft,
    searchExercisesForSet,
    selectExerciseForSet,
    setDurationMinutes,
    setNotes,
    setPerformedAt,
    setSetDraftField,
    setDrafts,
    submitWorkout,
    workoutNotes,
    workoutDurationMinutes,
  };
}

function createEmptySetDraft(): WorkoutSetDraft {
  return {
    exerciseId: "",
    exerciseName: "",
    exerciseQuery: "",
    exerciseResults: [],
    isSearchingExercises: false,
    isWarmup: false,
    notes: "",
    reps: "",
    rpe: "",
    weightKg: "",
  };
}

function setWorkoutFormToDefaults(input: {
  setDurationMinutes: (value: string) => void;
  setNotes: (value: string) => void;
  setPerformedAt: (value: string) => void;
  setSetDrafts: (value: WorkoutSetDraft[]) => void;
}): void {
  input.setPerformedAt(formatDateTimeLocal(new Date()));
  input.setDurationMinutes("");
  input.setNotes("");
  input.setSetDrafts([createEmptySetDraft()]);
}

function buildCreateWorkoutRequest(input: {
  performedAt: string;
  setDrafts: WorkoutSetDraft[];
  workoutDurationMinutes: string;
  workoutNotes: string;
}): CreateWorkoutRequest {
  if (!input.performedAt) {
    throw new Error("Workout date and time are required.");
  }

  const preparedSets = input.setDrafts.map((draft, index) => {
    if (!draft.exerciseId) {
      throw new Error(`Set ${index + 1} is missing an exercise selection.`);
    }

    return {
      exercise_id: draft.exerciseId,
      is_warmup: draft.isWarmup,
      notes: draft.notes.trim() || undefined,
      reps: parseIntegerField(draft.reps, `Set ${index + 1} reps`),
      rpe: draft.rpe.trim() ? parseNumberField(draft.rpe, `Set ${index + 1} RPE`) : undefined,
      weight_kg: parseNumberField(draft.weightKg, `Set ${index + 1} weight`),
    };
  });

  const sets = assignSetIndexes(preparedSets);

  return {
    duration_minutes: input.workoutDurationMinutes.trim()
      ? parseIntegerField(input.workoutDurationMinutes, "Workout duration")
      : undefined,
    notes: input.workoutNotes.trim() || undefined,
    performed_at: new Date(input.performedAt).toISOString(),
    sets,
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

function parseIntegerField(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`${label} must be a valid integer.`);
  }

  return parsed;
}

function parseNumberField(value: string, label: string): number {
  const parsed = Number.parseFloat(value);

  if (Number.isNaN(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }

  return parsed;
}

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Workout creation is unavailable right now.";
}

function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
