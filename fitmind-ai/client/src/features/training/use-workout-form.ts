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

export interface WorkoutSetDraftErrors {
  exerciseId?: string | undefined;
  reps?: string | undefined;
  rpe?: string | undefined;
  weightKg?: string | undefined;
}

export interface WorkoutFormErrors {
  performedAt?: string | undefined;
  setDrafts: WorkoutSetDraftErrors[];
  workoutDurationMinutes?: string | undefined;
}

export interface UseWorkoutFormResult {
  addSetDraft: () => void;
  createdWorkout: WorkoutDetailDto | null;
  errorMessage: string | null;
  formErrors: WorkoutFormErrors;
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
  successMessage: string | null;
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
  const [formErrors, setFormErrors] = useState<WorkoutFormErrors>(createEmptyFormErrors(1));
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function addSetDraft(): void {
    setSetDrafts((currentDrafts) => {
      return [...currentDrafts, createEmptySetDraft()];
    });
    setFormErrors((currentErrors) => {
      return {
        ...currentErrors,
        setDrafts: [...currentErrors.setDrafts, {}],
      };
    });
    clearFeedback();
  }

  function removeSetDraft(index: number): void {
    setSetDrafts((currentDrafts) => {
      if (currentDrafts.length === 1) {
        return currentDrafts;
      }

      return currentDrafts.filter((_, currentIndex) => currentIndex !== index);
    });
    setFormErrors((currentErrors) => {
      if (currentErrors.setDrafts.length === 1) {
        return currentErrors;
      }

      return {
        ...currentErrors,
        setDrafts: currentErrors.setDrafts.filter((_, currentIndex) => currentIndex !== index),
      };
    });
    clearFeedback();
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
    setFormErrors((currentErrors) => {
      const nextErrors = [...currentErrors.setDrafts];
      const currentSetErrors = nextErrors[index] ?? {};

      nextErrors[index] = clearSetErrorForField(currentSetErrors, field);

      return {
        ...currentErrors,
        setDrafts: nextErrors,
      };
    });
    clearFeedback();
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
    setFormErrors((currentErrors) => {
      const nextErrors = [...currentErrors.setDrafts];
      nextErrors[index] = {
        ...nextErrors[index],
        exerciseId: undefined,
      };

      return {
        ...currentErrors,
        setDrafts: nextErrors,
      };
    });
    clearFeedback();
  }

  async function submitWorkout(): Promise<WorkoutDetailDto | null> {
    if (!token) {
      setErrorMessage("You must be signed in to create a workout.");
      return null;
    }

    setErrorMessage(null);
    setCreatedWorkout(null);
    setSuccessMessage(null);

    const submission = buildCreateWorkoutRequest({
      performedAt,
      setDrafts,
      workoutDurationMinutes,
      workoutNotes,
    });

    setFormErrors(submission.errors);

    if (!submission.payload) {
      setErrorMessage("Please fix the highlighted workout fields and try again.");
      return null;
    }

    setIsSubmitting(true);

    try {
      const workout = await createWorkout(token, submission.payload);

      setCreatedWorkout(workout);
      setWorkoutFormToDefaults({
        setFormErrors,
        setDurationMinutes,
        setNotes,
        setPerformedAt,
        setSetDrafts,
      });
      setSuccessMessage(
        `Saved workout with ${workout.sets.length} set${
          workout.sets.length === 1 ? "" : "s"
        }. The workout log has been refreshed.`,
      );
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
    formErrors,
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
    successMessage,
    submitWorkout,
    workoutNotes,
    workoutDurationMinutes,
  };

  function clearFeedback(): void {
    setErrorMessage(null);
    setSuccessMessage(null);
  }
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
  setFormErrors: (value: WorkoutFormErrors) => void;
  setDurationMinutes: (value: string) => void;
  setNotes: (value: string) => void;
  setPerformedAt: (value: string) => void;
  setSetDrafts: (value: WorkoutSetDraft[]) => void;
}): void {
  input.setPerformedAt(formatDateTimeLocal(new Date()));
  input.setDurationMinutes("");
  input.setNotes("");
  input.setSetDrafts([createEmptySetDraft()]);
  input.setFormErrors(createEmptyFormErrors(1));
}

function buildCreateWorkoutRequest(input: {
  performedAt: string;
  setDrafts: WorkoutSetDraft[];
  workoutDurationMinutes: string;
  workoutNotes: string;
}): {
  errors: WorkoutFormErrors;
  payload: CreateWorkoutRequest | null;
} {
  const errors = createEmptyFormErrors(input.setDrafts.length);

  if (!input.performedAt) {
    errors.performedAt = "Workout date and time are required.";
  }

  const performedAtDate = new Date(input.performedAt);

  if (!input.performedAt || Number.isNaN(performedAtDate.getTime())) {
    errors.performedAt = "Workout date and time must be valid.";
  }

  const preparedSets = input.setDrafts.map((draft, index) => {
    if (!draft.exerciseId) {
      errors.setDrafts[index] = {
        ...errors.setDrafts[index],
        exerciseId: `Set ${index + 1} needs an exercise selection.`,
      };
    }

    return {
      exercise_id: draft.exerciseId,
      is_warmup: draft.isWarmup,
      notes: draft.notes.trim() || undefined,
      reps: parseIntegerField(draft.reps, `Set ${index + 1} reps`, {
        min: 0,
        onError: (message) => {
          errors.setDrafts[index] = {
            ...errors.setDrafts[index],
            reps: message,
          };
        },
      }),
      rpe: draft.rpe.trim()
        ? parseNumberField(draft.rpe, `Set ${index + 1} RPE`, {
            max: 10,
            min: 1,
            onError: (message) => {
              errors.setDrafts[index] = {
                ...errors.setDrafts[index],
                rpe: message,
              };
            },
          })
        : undefined,
      weight_kg: parseNumberField(draft.weightKg, `Set ${index + 1} weight`, {
        min: 0,
        onError: (message) => {
          errors.setDrafts[index] = {
            ...errors.setDrafts[index],
            weightKg: message,
          };
        },
      }),
    };
  });

  const durationMinutes = input.workoutDurationMinutes.trim()
    ? parseIntegerField(input.workoutDurationMinutes, "Workout duration", {
        min: 0,
        onError: (message) => {
          errors.workoutDurationMinutes = message;
        },
      })
    : undefined;

  if (hasWorkoutFormErrors(errors)) {
    return {
      errors,
      payload: null,
    };
  }

  const sets = assignSetIndexes(preparedSets);

  return {
    errors,
    payload: {
      duration_minutes: durationMinutes,
      notes: input.workoutNotes.trim() || undefined,
      performed_at: performedAtDate.toISOString(),
      sets,
    },
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

function parseIntegerField(
  value: string,
  label: string,
  options: {
    min?: number | undefined;
    onError: (message: string) => void;
  },
): number {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    options.onError(`${label} must be a valid integer.`);
    return 0;
  }

  if (options.min !== undefined && parsed < options.min) {
    options.onError(`${label} must be at least ${options.min}.`);
    return parsed;
  }

  return parsed;
}

function parseNumberField(
  value: string,
  label: string,
  options: {
    max?: number | undefined;
    min?: number | undefined;
    onError: (message: string) => void;
  },
): number {
  const parsed = Number.parseFloat(value);

  if (Number.isNaN(parsed)) {
    options.onError(`${label} must be a valid number.`);
    return 0;
  }

  if (options.min !== undefined && parsed < options.min) {
    options.onError(`${label} must be at least ${options.min}.`);
    return parsed;
  }

  if (options.max !== undefined && parsed > options.max) {
    options.onError(`${label} must be no more than ${options.max}.`);
  }

  return parsed;
}

function createEmptyFormErrors(setCount: number): WorkoutFormErrors {
  return {
    setDrafts: Array.from({ length: setCount }, () => {
      return {};
    }),
  };
}

function hasWorkoutFormErrors(errors: WorkoutFormErrors): boolean {
  if (errors.performedAt || errors.workoutDurationMinutes) {
    return true;
  }

  return errors.setDrafts.some((setErrors) => {
    return Boolean(
      setErrors.exerciseId ||
        setErrors.reps ||
        setErrors.rpe ||
        setErrors.weightKg,
    );
  });
}

function clearSetErrorForField(
  errors: WorkoutSetDraftErrors,
  field: keyof WorkoutSetDraft,
): WorkoutSetDraftErrors {
  if (field === "exerciseId" || field === "exerciseName" || field === "exerciseQuery") {
    return {
      ...errors,
      exerciseId: undefined,
    };
  }

  if (field === "reps") {
    return {
      ...errors,
      reps: undefined,
    };
  }

  if (field === "rpe") {
    return {
      ...errors,
      rpe: undefined,
    };
  }

  if (field === "weightKg") {
    return {
      ...errors,
      weightKg: undefined,
    };
  }

  return errors;
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
