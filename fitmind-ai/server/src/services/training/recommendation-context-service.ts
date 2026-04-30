import { z } from "zod";

import { getRecentWorkoutsForRecommendationContext } from "../../db/recommendation-context-repository.js";
import { getUserExerciseProgress } from "./exercise-progress-service.js";
import { getUserTrainingSummary } from "./training-summary-service.js";

function normalizeNumericValue(value: unknown): unknown {
  if (typeof value === "string" && value.trim() !== "") {
    const parsedValue = Number(value);

    return Number.isNaN(parsedValue) ? value : parsedValue;
  }

  return value;
}

function normalizeTimestamp(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

export interface RecommendationContextRangeDto {
  start_date: string;
  end_date: string;
}

export interface RecommendationContextSummaryExerciseDto {
  exercise_id: string;
  exercise_name: string;
  set_count: number;
  total_reps: number;
  total_volume: number;
}

export interface RecommendationContextSummaryDto {
  workout_count: number;
  set_count: number;
  total_reps: number;
  total_volume: number;
  by_exercise: RecommendationContextSummaryExerciseDto[];
}

export interface RecommendationContextFocusExerciseDto {
  exercise_id: string;
  exercise_name: string;
  workout_count: number;
  set_count: number;
  total_reps: number;
  total_volume: number;
  max_weight_kg: number | null;
  estimated_1rm_kg: number | null;
}

export interface RecommendationContextRecentWorkoutDto {
  workout_id: string;
  performed_at: string;
  notes: string | null;
  set_count: number;
  total_volume: number;
}

export interface RecommendationContextEvidenceDto {
  source: "deterministic_calculation_layer";
  workout_ids: string[];
  set_ids: string[];
  calculation_rules: string[];
}

export interface RecommendationContextResponseData {
  range: RecommendationContextRangeDto;
  summary: RecommendationContextSummaryDto;
  focus_exercises: RecommendationContextFocusExerciseDto[];
  recent_workouts: RecommendationContextRecentWorkoutDto[];
  evidence: RecommendationContextEvidenceDto;
}

const recentWorkoutSchema = z.object({
  workout_id: z.string().uuid(),
  performed_at: z.union([z.string().min(1), z.date()]),
  notes: z.string().nullable(),
  set_count: z.number().int().nonnegative(),
  total_volume: z.preprocess(normalizeNumericValue, z.number().nonnegative()),
});

function buildCalculationRules(progressRules: string[]): string[] {
  const calculationRules = new Set<string>([
    "Only workouts owned by the authenticated user are eligible for inclusion anywhere in this context package.",
    "Calendar input is inclusive, but timestamps are filtered with performed_at >= start_date::date and performed_at < (end_date::date + interval '1 day').",
    "recent_workouts selects at most 5 latest workouts in range ordered by performed_at DESC, workout_id DESC.",
    "focus_exercises is limited to the top 3 exercises from summary.by_exercise using the summary ordering, which is currently total_volume DESC.",
  ]);

  for (const rule of progressRules) {
    calculationRules.add(rule);
  }

  return [...calculationRules];
}

/**
 * Build a deterministic recommendation context package for the authenticated user.
 *
 * @param userId - Authenticated user id.
 * @param range - Inclusive date-only range.
 * @returns Structured context package for future explanation/tool-calling layers.
 */
export async function getUserRecommendationContext(
  userId: string,
  range: RecommendationContextRangeDto,
): Promise<RecommendationContextResponseData> {
  const summaryResult = await getUserTrainingSummary(userId, range);
  const topExercises = summaryResult.by_exercise.slice(0, 3);

  const [focusExerciseResults, recentWorkoutRows] = await Promise.all([
    Promise.all(
      topExercises.map((exercise) =>
        getUserExerciseProgress(userId, exercise.exercise_id, range),
      ),
    ),
    getRecentWorkoutsForRecommendationContext({
      userId,
      startDate: range.start_date,
      endDate: range.end_date,
    }),
  ]);

  const focusExercises = focusExerciseResults.map((progress) => ({
    exercise_id: progress.exercise.exercise_id,
    exercise_name:
      progress.exercise.exercise_name ??
      topExercises.find(
        (exercise) => exercise.exercise_id === progress.exercise.exercise_id,
      )?.exercise_name ??
      "Unknown exercise",
    workout_count: progress.totals.workout_count,
    set_count: progress.totals.set_count,
    total_reps: progress.totals.total_reps,
    total_volume: progress.totals.total_volume,
    max_weight_kg: progress.totals.max_weight_kg,
    estimated_1rm_kg: progress.totals.estimated_1rm_kg,
  }));
  const recentWorkouts = recentWorkoutRows.map((row) => {
    const parsedRow = recentWorkoutSchema.parse(row);

    return {
      workout_id: parsedRow.workout_id,
      performed_at: normalizeTimestamp(parsedRow.performed_at),
      notes: parsedRow.notes,
      set_count: parsedRow.set_count,
      total_volume: parsedRow.total_volume,
    };
  });
  const workoutIds = new Set<string>(summaryResult.evidence.workout_ids);
  const setIds = new Set<string>();
  const progressRules = new Set<string>();

  for (const progress of focusExerciseResults) {
    for (const workoutId of progress.evidence.workout_ids) {
      workoutIds.add(workoutId);
    }

    for (const setId of progress.evidence.set_ids) {
      setIds.add(setId);
    }

    for (const rule of progress.evidence.calculation_rules) {
      progressRules.add(rule);
    }
  }

  for (const workout of recentWorkouts) {
    workoutIds.add(workout.workout_id);
  }

  return {
    range,
    summary: {
      workout_count: summaryResult.totals.workout_count,
      set_count: summaryResult.totals.set_count,
      total_reps: summaryResult.totals.total_reps,
      total_volume: summaryResult.totals.total_volume,
      by_exercise: summaryResult.by_exercise,
    },
    focus_exercises: focusExercises,
    recent_workouts: recentWorkouts,
    evidence: {
      source: "deterministic_calculation_layer",
      workout_ids: [...workoutIds],
      set_ids: [...setIds],
      calculation_rules: [
        ...summaryResult.evidence.calculation_rules,
        ...buildCalculationRules([...progressRules]),
      ],
    },
  };
}
