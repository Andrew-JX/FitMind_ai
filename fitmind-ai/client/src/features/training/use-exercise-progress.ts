import { useEffect, useState } from "react";

import { HttpClientError } from "../../services/http-client";
import type { AnalysisDateRange } from "./analysis-range";
import {
  getExerciseProgress,
  type ExerciseProgress,
} from "./exercise-progress-api";

export interface UseExerciseProgressResult {
  errorMessage: string | null;
  isLoading: boolean;
  progress: ExerciseProgress | null;
}

/**
 * Loads deterministic progress for one exercise inside one date range.
 *
 * Shared by the analysis tab's 动作进展 card and the progress drawer opened
 * from the exercise list, so both render from the same fetch semantics.
 *
 * @param token - Current in-memory auth token
 * @param exerciseId - Selected exercise, or null to stay idle
 * @param range - Inclusive date-only range
 * @param refreshSignal - Increment to force a reload
 * @returns Progress state
 */
export function useExerciseProgress(
  token: string | null,
  exerciseId: string | null,
  range: AnalysisDateRange,
  refreshSignal = 0,
): UseExerciseProgressResult {
  const [progress, setProgress] = useState<ExerciseProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadProgress(): Promise<void> {
      if (!token || !exerciseId) {
        setProgress(null);
        setIsLoading(false);
        setErrorMessage(null);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextProgress = await getExerciseProgress(token, {
          endDate: range.end_date,
          exerciseId,
          startDate: range.start_date,
        });

        if (!isActive) {
          return;
        }

        setProgress(nextProgress);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setProgress(null);
        setErrorMessage(getReadableErrorMessage(error));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadProgress();

    return () => {
      isActive = false;
    };
  }, [exerciseId, range.end_date, range.start_date, refreshSignal, token]);

  return { errorMessage, isLoading, progress };
}

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "动作进展暂时不可用。";
}
