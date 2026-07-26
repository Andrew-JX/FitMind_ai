import { useEffect, useEffectEvent, useState } from "react";

import { HttpClientError } from "../../services/http-client";
import type { AnalysisDateRange } from "./analysis-range";
import {
  getTrainingSummary,
  type TrainingSummary,
} from "./training-summary-api";

export interface UseTrainingSummaryResult {
  errorMessage: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  summary: TrainingSummary | null;
}

/**
 * Loads readonly training summary data for one date range.
 *
 * Callers own the range, so the training tab's fixed 30-day strip and the
 * analysis tab's switchable range stay independent instances and can never
 * mislabel each other's window.
 *
 * @param token - Current in-memory auth token
 * @param range - Inclusive date-only range
 * @param refreshSignal - Increment to force a reload
 * @returns Summary state and a refresh action
 */
export function useTrainingSummary(
  token: string | null,
  range: AnalysisDateRange,
  refreshSignal = 0,
): UseTrainingSummaryResult {
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useEffectEvent(async () => {
    await refresh();
  });

  useEffect(() => {
    if (!token) {
      setSummary(null);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    void reload();
  }, [range.end_date, range.start_date, refreshSignal, token]);

  async function refresh(): Promise<void> {
    if (!token) {
      setErrorMessage("You must be signed in to view training summary.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextSummary = await getTrainingSummary(token, {
        endDate: range.end_date,
        startDate: range.start_date,
      });
      setSummary(nextSummary);
    } catch (error) {
      setSummary(null);
      setErrorMessage(getReadableErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  return {
    errorMessage,
    isLoading,
    refresh,
    summary,
  };
}

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Training summary is unavailable right now.";
}
