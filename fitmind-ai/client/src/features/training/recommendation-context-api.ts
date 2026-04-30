import { requestJson } from "../../services/http-client";

export interface RecommendationContextRange {
  start_date: string;
  end_date: string;
}

export interface RecommendationContextSummaryExercise {
  exercise_id: string;
  exercise_name: string;
  set_count: number;
  total_reps: number;
  total_volume: number;
}

export interface RecommendationContextSummary {
  workout_count: number;
  set_count: number;
  total_reps: number;
  total_volume: number;
  by_exercise: RecommendationContextSummaryExercise[];
}

export interface RecommendationContextFocusExercise {
  exercise_id: string;
  exercise_name: string;
  workout_count: number;
  set_count: number;
  total_reps: number;
  total_volume: number;
  max_weight_kg: number | null;
  estimated_1rm_kg: number | null;
}

export interface RecommendationContextRecentWorkout {
  workout_id: string;
  performed_at: string;
  notes: string | null;
  set_count: number;
  total_volume: number;
}

export interface RecommendationContextEvidence {
  source: "deterministic_calculation_layer";
  workout_ids: string[];
  set_ids: string[];
  calculation_rules: string[];
}

export interface RecommendationContext {
  range: RecommendationContextRange;
  summary: RecommendationContextSummary;
  focus_exercises: RecommendationContextFocusExercise[];
  recent_workouts: RecommendationContextRecentWorkout[];
  evidence: RecommendationContextEvidence;
}

interface RecommendationContextQuery {
  endDate: string;
  startDate: string;
}

/**
 * Loads the authenticated user's deterministic recommendation context package.
 *
 * @param token - In-memory auth token
 * @param query - Inclusive date-only range formatted as YYYY-MM-DD
 * @returns Recommendation context payload
 */
export async function getRecommendationContext(
  token: string,
  query: RecommendationContextQuery,
): Promise<RecommendationContext> {
  const searchParams = new URLSearchParams({
    end_date: query.endDate,
    start_date: query.startDate,
  });

  return requestJson<RecommendationContext>(
    `/api/training/recommendation-context?${searchParams.toString()}`,
    {
      token,
    },
  );
}
