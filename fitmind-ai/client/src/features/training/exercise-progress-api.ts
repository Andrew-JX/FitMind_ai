import { requestJson } from "../../services/http-client";

export interface ExerciseProgressRange {
  start_date: string;
  end_date: string;
}

export interface ExerciseProgressExercise {
  exercise_id: string;
  exercise_name: string | null;
}

export interface ExerciseProgressTotals {
  workout_count: number;
  set_count: number;
  total_reps: number;
  total_volume: number;
  max_weight_kg: number | null;
  estimated_1rm_kg: number | null;
}

export interface ExerciseProgressSession {
  workout_id: string;
  performed_at: string;
  set_count: number;
  total_reps: number;
  total_volume: number;
  max_weight_kg: number | null;
  estimated_1rm_kg: number | null;
  set_ids: string[];
}

export interface ExerciseProgressEvidence {
  workout_ids: string[];
  set_ids: string[];
  calculation_rules: string[];
}

export interface ExerciseProgress {
  range: ExerciseProgressRange;
  exercise: ExerciseProgressExercise;
  totals: ExerciseProgressTotals;
  sessions: ExerciseProgressSession[];
  evidence: ExerciseProgressEvidence;
}

interface ExerciseProgressQuery {
  endDate: string;
  exerciseId: string;
  startDate: string;
}

/**
 * Loads deterministic exercise progress for the authenticated user.
 *
 * @param token - In-memory auth token
 * @param query - Requested exercise id plus inclusive date-only range
 * @returns Exercise progress payload
 */
export async function getExerciseProgress(
  token: string,
  query: ExerciseProgressQuery,
): Promise<ExerciseProgress> {
  const searchParams = new URLSearchParams({
    end_date: query.endDate,
    exercise_id: query.exerciseId,
    start_date: query.startDate,
  });

  return requestJson<ExerciseProgress>(
    `/api/training/exercise-progress?${searchParams.toString()}`,
    {
      token,
    },
  );
}
