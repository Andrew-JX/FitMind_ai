import { useCallback, useEffect, useState } from "react";

import { HttpClientError } from "../../services/http-client";
import {
  listMuscleGroups,
  searchExercises,
  type DictionaryExercise,
  type DictionaryMuscleGroup,
} from "./dictionary-api";

export interface UseExerciseSearchResult {
  exercises: DictionaryExercise[];
  isLoadingExercises: boolean;
  isLoadingMuscleGroups: boolean;
  muscleGroups: DictionaryMuscleGroup[];
  searchError: string | null;
  searchExercises: (input: { muscle: string; q: string }) => Promise<void>;
}

/**
 * Loads dictionary muscle groups and exposes exercise search state for the client.
 *
 * @returns Search state, muscle groups, and a search action
 */
export function useExerciseSearch(): UseExerciseSearchResult {
  const [muscleGroups, setMuscleGroups] = useState<DictionaryMuscleGroup[]>([]);
  const [exercises, setExercises] = useState<DictionaryExercise[]>([]);
  const [isLoadingMuscleGroups, setIsLoadingMuscleGroups] = useState(true);
  const [isLoadingExercises, setIsLoadingExercises] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadInitialMuscleGroups(): Promise<void> {
      setIsLoadingMuscleGroups(true);
      setIsLoadingExercises(true);
      setSearchError(null);

      try {
        const [muscleItems, exerciseItems] = await Promise.all([
          listMuscleGroups(),
          searchExercises({}),
        ]);

        if (!isActive) {
          return;
        }

        setMuscleGroups(muscleItems);
        setExercises(exerciseItems);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setSearchError(getReadableErrorMessage(error));
      } finally {
        if (isActive) {
          setIsLoadingMuscleGroups(false);
          setIsLoadingExercises(false);
        }
      }
    }

    void loadInitialMuscleGroups();

    return () => {
      isActive = false;
    };
  }, []);

  const runExerciseSearch = useCallback(
    async function runExerciseSearch(input: {
      muscle: string;
      q: string;
    }): Promise<void> {
      setIsLoadingExercises(true);
      setSearchError(null);

      try {
        const items = await searchExercises({
          muscle: input.muscle || undefined,
          q: input.q || undefined,
        });

        setExercises(items);
      } catch (error) {
        setExercises([]);
        setSearchError(getReadableErrorMessage(error));
      } finally {
        setIsLoadingExercises(false);
      }
    },
    [],
  );

  return {
    exercises,
    isLoadingExercises,
    isLoadingMuscleGroups,
    muscleGroups,
    searchError,
    searchExercises: runExerciseSearch,
  };
}

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  return "Exercise search is unavailable right now.";
}
