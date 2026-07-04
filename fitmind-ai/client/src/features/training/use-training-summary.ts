import { useEffect, useEffectEvent, useState } from "react";

import { HttpClientError } from "../../services/http-client";
import {
  getTrainingSummary,
  type TrainingSummary,
  type TrainingSummaryRange,
} from "./training-summary-api";

export interface UseTrainingSummaryResult {
  errorMessage: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  summary: TrainingSummary | null;
}

/**
 * Loads readonly training summary data for the authenticated user.
 *
 * @param token - Current in-memory auth token
 * @returns Summary state and a refresh action
 */
export function useTrainingSummary(
  token: string | null,
): UseTrainingSummaryResult {
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [range] = useState<TrainingSummaryRange>(() => createDefaultRange());

  const refreshOnTokenChange = useEffectEvent(async () => {
    await refresh();
  });

  useEffect(() => {
    if (!token) {
      setSummary(null);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    void refreshOnTokenChange();
  }, [token]);

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

function createDefaultRange(): TrainingSummaryRange {
  const today = new Date();
  const endDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startDate = new Date(endDate);

  startDate.setDate(startDate.getDate() - 29);

  return {
    end_date: formatDateOnly(endDate),
    start_date: formatDateOnly(startDate),
  };
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}
