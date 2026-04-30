import { requestJson } from "../../services/http-client";

export interface TrainingSummaryRange {
  start_date: string;
  end_date: string;
}

export interface TrainingSummaryTotals {
  workout_count: number;
  set_count: number;
  total_reps: number;
  total_volume: number;
}

export interface TrainingSummaryExercise {
  exercise_id: string;
  exercise_name: string;
  set_count: number;
  total_reps: number;
  total_volume: number;
}

export interface TrainingSummaryEvidence {
  workout_ids: string[];
  calculation_rules: string[];
}

export interface TrainingSummary {
  range: TrainingSummaryRange;
  totals: TrainingSummaryTotals;
  by_exercise: TrainingSummaryExercise[];
  evidence: TrainingSummaryEvidence;
}

interface TrainingSummaryQuery {
  endDate: string;
  startDate: string;
}

/**
 * Loads the authenticated user's deterministic training summary for one date range.
 *
 * @param token - In-memory auth token
 * @param query - Inclusive date-only range formatted as YYYY-MM-DD
 * @returns Training summary payload
 */
export async function getTrainingSummary(
  token: string,
  query: TrainingSummaryQuery,
): Promise<TrainingSummary> {
  const searchParams = new URLSearchParams({
    end_date: query.endDate,
    start_date: query.startDate,
  });

  return requestJson<TrainingSummary>(`/api/training/summary?${searchParams.toString()}`, {
    token,
  });
}
