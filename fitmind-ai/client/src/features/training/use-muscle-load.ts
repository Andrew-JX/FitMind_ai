import { useEffect, useState } from "react";

import { HttpClientError } from "../../services/http-client";
import type { AnalysisDateRange } from "./analysis-range";
import { getMuscleLoad, type MuscleLoadResponse } from "./muscle-load-api";

export interface UseMuscleLoadResult {
  errorMessage: string | null;
  isLoading: boolean;
  muscleLoad: MuscleLoadResponse | null;
}

/**
 * Loads the deterministic muscle-load distribution for one date range.
 *
 * @param token - Current in-memory auth token
 * @param range - Inclusive date-only range
 * @param refreshSignal - Increment to force a reload
 * @returns Muscle-load state
 */
export function useMuscleLoad(
  token: string | null,
  range: AnalysisDateRange,
  refreshSignal = 0,
): UseMuscleLoadResult {
  const [muscleLoad, setMuscleLoad] = useState<MuscleLoadResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadMuscleLoad(): Promise<void> {
      if (!token) {
        setMuscleLoad(null);
        setIsLoading(false);
        setErrorMessage(null);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextMuscleLoad = await getMuscleLoad(token, {
          endDate: range.end_date,
          startDate: range.start_date,
        });

        if (!isActive) {
          return;
        }

        setMuscleLoad(nextMuscleLoad);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setMuscleLoad(null);
        setErrorMessage(getReadableErrorMessage(error));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadMuscleLoad();

    return () => {
      isActive = false;
    };
  }, [range.end_date, range.start_date, refreshSignal, token]);

  return { errorMessage, isLoading, muscleLoad };
}

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "肌群负荷分析暂时不可用。";
}
