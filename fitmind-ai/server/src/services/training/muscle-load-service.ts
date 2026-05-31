import { z } from "zod";

import { getMuscleLoad } from "../../db/muscle-load-repository.js";

function normalizeNumericValue(value: unknown): unknown {
  if (typeof value === "string" && value.trim() !== "") {
    const parsedValue = Number(value);

    return Number.isNaN(parsedValue) ? value : parsedValue;
  }

  return value;
}

export interface MuscleLoadRangeDto {
  start_date: string;
  end_date: string;
}

export interface MuscleLoadTotalsDto {
  workout_count: number;
  set_count: number;
  total_reps: number;
  total_raw_volume: number;
  total_weighted_volume: number;
  muscle_group_count: number;
}

export interface MuscleLoadTopExerciseDto {
  exercise_id: string;
  exercise_name: string;
  weighted_volume: number;
  set_count: number;
}

export interface MuscleLoadGroupDto {
  muscle_group_id: string;
  muscle_group_name: string;
  set_count: number;
  total_reps: number;
  raw_volume: number;
  weighted_volume: number;
  contribution_ratio: number;
  top_exercises: MuscleLoadTopExerciseDto[];
}

export interface MuscleLoadEvidenceDto {
  workout_ids: string[];
  set_ids: string[];
  calculation_rules: string[];
}

export interface MuscleLoadResponseData {
  range: MuscleLoadRangeDto;
  totals: MuscleLoadTotalsDto;
  by_muscle_group: MuscleLoadGroupDto[];
  top_muscle_groups: MuscleLoadGroupDto[];
  low_volume_muscle_groups: MuscleLoadGroupDto[];
  evidence: MuscleLoadEvidenceDto;
}

const TOP_MUSCLE_GROUP_LIMIT = 3;
const LOW_VOLUME_MUSCLE_GROUP_LIMIT = 3;

const totalsSchema = z.object({
  workout_count: z.number().int().nonnegative(),
  set_count: z.number().int().nonnegative(),
  total_reps: z.number().int().nonnegative(),
  total_raw_volume: z.preprocess(
    normalizeNumericValue,
    z.number().nonnegative(),
  ),
  total_weighted_volume: z.preprocess(
    normalizeNumericValue,
    z.number().nonnegative(),
  ),
  muscle_group_count: z.number().int().nonnegative(),
  workout_ids: z.array(z.string().uuid()),
  set_ids: z.array(z.string().uuid()),
});

const muscleGroupSchema = z.object({
  muscle_group_id: z.string().uuid(),
  muscle_group_name: z.string().min(1),
  set_count: z.number().int().nonnegative(),
  total_reps: z.number().int().nonnegative(),
  raw_volume: z.preprocess(normalizeNumericValue, z.number().nonnegative()),
  weighted_volume: z.preprocess(
    normalizeNumericValue,
    z.number().nonnegative(),
  ),
});

const topExerciseSchema = z.object({
  muscle_group_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  exercise_name: z.string().min(1),
  weighted_volume: z.preprocess(
    normalizeNumericValue,
    z.number().nonnegative(),
  ),
  set_count: z.number().int().nonnegative(),
});

function groupTopExercisesByMuscle(
  rows: Array<z.infer<typeof topExerciseSchema>>,
): Map<string, MuscleLoadTopExerciseDto[]> {
  const grouped = new Map<string, MuscleLoadTopExerciseDto[]>();

  for (const row of rows) {
    const items = grouped.get(row.muscle_group_id) ?? [];
    items.push({
      exercise_id: row.exercise_id,
      exercise_name: row.exercise_name,
      weighted_volume: row.weighted_volume,
      set_count: row.set_count,
    });
    grouped.set(row.muscle_group_id, items);
  }

  return grouped;
}

/**
 * Build deterministic muscle-load aggregates for the authenticated user.
 *
 * @param userId - Authenticated user id.
 * @param range - Inclusive date-only range.
 * @returns API response payload for the muscle-load endpoint.
 */
export async function getUserMuscleLoad(
  userId: string,
  range: MuscleLoadRangeDto,
): Promise<MuscleLoadResponseData> {
  const result = await getMuscleLoad({
    userId,
    startDate: range.start_date,
    endDate: range.end_date,
  });

  const totals = totalsSchema.parse(result.totals);
  const muscleGroups = result.byMuscleGroup.map((row) =>
    muscleGroupSchema.parse(row),
  );
  const topExerciseRows = result.topExercises.map((row) =>
    topExerciseSchema.parse(row),
  );
  const topExercisesByMuscle = groupTopExercisesByMuscle(topExerciseRows);
  const totalWeightedVolume = totals.total_weighted_volume;

  const byMuscleGroup = muscleGroups.map((row) => ({
    muscle_group_id: row.muscle_group_id,
    muscle_group_name: row.muscle_group_name,
    set_count: row.set_count,
    total_reps: row.total_reps,
    raw_volume: row.raw_volume,
    weighted_volume: row.weighted_volume,
    contribution_ratio:
      totalWeightedVolume > 0 ? row.weighted_volume / totalWeightedVolume : 0,
    top_exercises: topExercisesByMuscle.get(row.muscle_group_id) ?? [],
  }));

  const lowVolumeMuscleGroups = [...byMuscleGroup]
    .filter((row) => row.weighted_volume > 0)
    .sort((left, right) => {
      if (left.contribution_ratio !== right.contribution_ratio) {
        return left.contribution_ratio - right.contribution_ratio;
      }

      return left.muscle_group_name.localeCompare(right.muscle_group_name);
    })
    .slice(0, LOW_VOLUME_MUSCLE_GROUP_LIMIT);

  return {
    range,
    totals: {
      workout_count: totals.workout_count,
      set_count: totals.set_count,
      total_reps: totals.total_reps,
      total_raw_volume: totals.total_raw_volume,
      total_weighted_volume: totals.total_weighted_volume,
      muscle_group_count: totals.muscle_group_count,
    },
    by_muscle_group: byMuscleGroup,
    top_muscle_groups: byMuscleGroup.slice(0, TOP_MUSCLE_GROUP_LIMIT),
    low_volume_muscle_groups: lowVolumeMuscleGroups,
    evidence: {
      workout_ids: totals.workout_ids,
      set_ids: totals.set_ids,
      calculation_rules: [
        "每组 raw volume = weight_kg * reps。",
        "同一动作可关联多个肌群。",
        "肌群 weighted volume = set raw volume * normalized contribution weight。",
        "normalized contribution weight = contribution_weight / 当前动作所有 contribution_weight 之和。",
        "contribution ratio = 当前肌群 weighted volume / 全部肌群 weighted volume。",
      ],
    },
  };
}
