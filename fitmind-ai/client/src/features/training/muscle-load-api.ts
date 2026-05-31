import { requestJson } from "../../services/http-client";

export interface MuscleLoadRange {
  start_date: string;
  end_date: string;
}

export interface MuscleLoadTotals {
  workout_count: number;
  set_count: number;
  total_reps: number;
  total_raw_volume: number;
  total_weighted_volume: number;
  muscle_group_count: number;
}

export interface MuscleLoadTopExercise {
  exercise_id: string;
  exercise_name: string;
  weighted_volume: number;
  set_count: number;
}

export interface MuscleLoadGroup {
  muscle_group_id: string;
  muscle_group_name: string;
  set_count: number;
  total_reps: number;
  raw_volume: number;
  weighted_volume: number;
  contribution_ratio: number;
  top_exercises: MuscleLoadTopExercise[];
}

export interface MuscleLoadEvidence {
  workout_ids: string[];
  set_ids: string[];
  calculation_rules: string[];
}

export interface MuscleLoadResponse {
  range: MuscleLoadRange;
  totals: MuscleLoadTotals;
  by_muscle_group: MuscleLoadGroup[];
  top_muscle_groups: MuscleLoadGroup[];
  low_volume_muscle_groups: MuscleLoadGroup[];
  evidence: MuscleLoadEvidence;
}

interface MuscleLoadQuery {
  endDate: string;
  startDate: string;
}

/**
 * Loads the authenticated user's deterministic muscle-load distribution.
 *
 * @param token - In-memory auth token
 * @param query - Inclusive date-only range formatted as YYYY-MM-DD
 * @returns Muscle-load response payload
 */
export async function getMuscleLoad(
  token: string,
  query: MuscleLoadQuery,
): Promise<MuscleLoadResponse> {
  const searchParams = new URLSearchParams({
    end_date: query.endDate,
    start_date: query.startDate,
  });

  return requestJson<MuscleLoadResponse>(
    `/api/training/muscle-load?${searchParams.toString()}`,
    {
      token,
    },
  );
}
