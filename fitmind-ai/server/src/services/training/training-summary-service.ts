import { z } from "zod";

import { getTrainingSummary } from "../../db/training-summary-repository.js";

function normalizeNumericValue(value: unknown): unknown {
  if (typeof value === "string" && value.trim() !== "") {
    const parsedValue = Number(value);

    return Number.isNaN(parsedValue) ? value : parsedValue;
  }

  return value;
}

export interface TrainingSummaryRangeDto {
  start_date: string;
  end_date: string;
}

export interface TrainingSummaryTotalsDto {
  workout_count: number;
  set_count: number;
  total_reps: number;
  total_volume: number;
}

export interface TrainingSummaryExerciseDto {
  exercise_id: string;
  exercise_name: string;
  set_count: number;
  total_reps: number;
  total_volume: number;
}

export interface TrainingSummaryEvidenceDto {
  workout_ids: string[];
  calculation_rules: string[];
}

export interface TrainingSummaryResponseData {
  range: TrainingSummaryRangeDto;
  totals: TrainingSummaryTotalsDto;
  by_exercise: TrainingSummaryExerciseDto[];
  evidence: TrainingSummaryEvidenceDto;
}

const totalsSchema = z.object({
  workout_count: z.number().int().nonnegative(),
  set_count: z.number().int().nonnegative(),
  total_reps: z.number().int().nonnegative(),
  total_volume: z.preprocess(normalizeNumericValue, z.number().nonnegative()),
  workout_ids: z.array(z.string().uuid()),
});

const exerciseSchema = z.object({
  exercise_id: z.string().uuid(),
  exercise_name: z.string().min(1),
  set_count: z.number().int().nonnegative(),
  total_reps: z.number().int().nonnegative(),
  total_volume: z.preprocess(normalizeNumericValue, z.number().nonnegative()),
});

/**
 * Build a deterministic training summary for the authenticated user.
 *
 * @param userId - Authenticated user id.
 * @param range - Inclusive date-only range.
 * @returns API response payload for the training summary endpoint.
 */
export async function getUserTrainingSummary(
  userId: string,
  range: TrainingSummaryRangeDto,
): Promise<TrainingSummaryResponseData> {
  const result = await getTrainingSummary({
    userId,
    startDate: range.start_date,
    endDate: range.end_date,
  });

  const totals = totalsSchema.parse(result.totals);
  const byExercise = result.byExercise.map((row) => exerciseSchema.parse(row));

  return {
    range,
    totals: {
      workout_count: totals.workout_count,
      set_count: totals.set_count,
      total_reps: totals.total_reps,
      total_volume: totals.total_volume,
    },
    by_exercise: byExercise,
    evidence: {
      workout_ids: totals.workout_ids,
      calculation_rules: [
        "workout_count counts distinct workouts whose performed_at falls inside the inclusive start_date to end_date range.",
        "set_count counts all sets attached to included workouts.",
        "total_reps sums reps across all included sets, treating nullable values as zero if encountered.",
        "total_volume sums weight_kg multiplied by reps across all included sets, treating nullable values as zero if encountered.",
        "by_exercise groups included sets by exercise_id and exercise name, then calculates set_count, total_reps, and total_volume for each group.",
      ],
    },
  };
}
