import { z } from "zod";

import { getExerciseProgress } from "../../db/exercise-progress-repository.js";

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

export interface ExerciseProgressRangeDto {
  start_date: string;
  end_date: string;
}

export interface ExerciseProgressExerciseDto {
  exercise_id: string;
  exercise_name: string | null;
}

export interface ExerciseProgressTotalsDto {
  workout_count: number;
  set_count: number;
  total_reps: number;
  total_volume: number;
  max_weight_kg: number | null;
  estimated_1rm_kg: number | null;
}

export interface ExerciseProgressSessionDto {
  workout_id: string;
  performed_at: string;
  set_count: number;
  total_reps: number;
  total_volume: number;
  max_weight_kg: number | null;
  estimated_1rm_kg: number | null;
  set_ids: string[];
}

export interface ExerciseProgressEvidenceDto {
  workout_ids: string[];
  set_ids: string[];
  calculation_rules: string[];
}

export interface ExerciseProgressResponseData {
  range: ExerciseProgressRangeDto;
  exercise: ExerciseProgressExerciseDto;
  totals: ExerciseProgressTotalsDto;
  sessions: ExerciseProgressSessionDto[];
  evidence: ExerciseProgressEvidenceDto;
}

const totalsSchema = z.object({
  exercise_name: z.string().min(1).nullable(),
  workout_count: z.number().int().nonnegative(),
  set_count: z.number().int().nonnegative(),
  total_reps: z.number().int().nonnegative(),
  total_volume: z.preprocess(normalizeNumericValue, z.number().nonnegative()),
  max_weight_kg: z.preprocess(normalizeNumericValue, z.number().nonnegative()).nullable(),
  estimated_1rm_kg: z.preprocess(normalizeNumericValue, z.number().nonnegative()).nullable(),
  workout_ids: z.array(z.string().uuid()),
  set_ids: z.array(z.string().uuid()),
});

const sessionSchema = z.object({
  workout_id: z.string().uuid(),
  performed_at: z.union([z.string().min(1), z.date()]),
  set_count: z.number().int().nonnegative(),
  total_reps: z.number().int().nonnegative(),
  total_volume: z.preprocess(normalizeNumericValue, z.number().nonnegative()),
  max_weight_kg: z.preprocess(normalizeNumericValue, z.number().nonnegative()).nullable(),
  estimated_1rm_kg: z.preprocess(normalizeNumericValue, z.number().nonnegative()).nullable(),
  set_ids: z.array(z.string().uuid()),
});

/**
 * Build deterministic exercise progress aggregates for one authenticated user.
 *
 * @param userId - Authenticated user id.
 * @param exerciseId - Requested exercise id.
 * @param range - Inclusive date-only range.
 * @returns API response payload for the exercise progress endpoint.
 */
export async function getUserExerciseProgress(
  userId: string,
  exerciseId: string,
  range: ExerciseProgressRangeDto,
): Promise<ExerciseProgressResponseData> {
  const result = await getExerciseProgress({
    userId,
    exerciseId,
    startDate: range.start_date,
    endDate: range.end_date,
  });

  const totals = totalsSchema.parse(result.totals);
  const sessions = result.sessions.map((row) => {
    const session = sessionSchema.parse(row);

    return {
      workout_id: session.workout_id,
      performed_at: normalizeTimestamp(session.performed_at),
      set_count: session.set_count,
      total_reps: session.total_reps,
      total_volume: session.total_volume,
      max_weight_kg: session.max_weight_kg,
      estimated_1rm_kg: session.estimated_1rm_kg,
      set_ids: session.set_ids,
    };
  });

  return {
    range,
    exercise: {
      exercise_id: exerciseId,
      exercise_name: totals.exercise_name,
    },
    totals: {
      workout_count: totals.workout_count,
      set_count: totals.set_count,
      total_reps: totals.total_reps,
      total_volume: totals.total_volume,
      max_weight_kg: totals.max_weight_kg,
      estimated_1rm_kg: totals.estimated_1rm_kg,
    },
    sessions,
    evidence: {
      workout_ids: totals.workout_ids,
      set_ids: totals.set_ids,
      calculation_rules: [
        "Only workouts owned by the authenticated user are included.",
        "Only sets whose exercise_id exactly matches the requested exercise_id are included.",
        "Calendar input is inclusive, but timestamps are filtered with performed_at >= start_date::date and performed_at < (end_date::date + interval '1 day').",
        "workout_count counts distinct included workouts for the requested exercise.",
        "set_count counts included sets for the requested exercise.",
        "total_reps sums included reps and treats nullable reps as zero if encountered.",
        "total_volume sums weight_kg multiplied by reps and treats nullable weight_kg or reps as zero if encountered.",
        "max_weight_kg returns the maximum included weight_kg or null when no matching sets exist.",
        "estimated_1rm_kg uses the Epley formula weight_kg * (1 + reps / 30) and returns the maximum included estimate or null when no matching sets exist.",
        "Each session row rolls up one workout and its session estimated_1rm_kg is the maximum Epley estimate across matching sets within that workout.",
      ],
    },
  };
}
