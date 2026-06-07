import {
  getUserExerciseProgress,
  type ExerciseProgressResponseData,
} from "./exercise-progress-service.js";
import {
  getUserMuscleLoad,
  type MuscleLoadGroupDto,
} from "./muscle-load-service.js";
import { getUserRecommendationContext } from "./recommendation-context-service.js";
import { getUserTrainingSummary } from "./training-summary-service.js";

export interface WeeklyTrainingReportInput {
  start_date: string;
  end_date: string;
  exercise_id?: string | undefined;
}

export interface WeeklyTrainingReportFrequencyDto {
  range_days: number;
  workouts_per_week: number;
}

export interface WeeklyTrainingReportTotalsDto {
  workout_count: number;
  set_count: number;
  total_reps: number;
  total_volume: number;
  total_weighted_volume: number;
}

export interface WeeklyTrainingReportExerciseDto {
  exercise_id: string;
  exercise_name: string;
  set_count: number;
  total_reps: number;
  total_volume: number;
}

export interface WeeklyTrainingReportMuscleGroupDto {
  muscle_group_id: string;
  muscle_group_name: string;
  set_count: number;
  total_reps: number;
  weighted_volume: number;
  contribution_ratio: number;
}

export interface WeeklyTrainingReportSelectedExerciseDto {
  exercise_id: string;
  exercise_name: string | null;
  workout_count: number;
  set_count: number;
  max_weight_kg: number | null;
  estimated_1rm_kg: number | null;
}

export interface WeeklyTrainingReportEvidenceDto {
  workout_ids: string[];
  set_ids: string[];
  calculation_sources: string[];
  calculation_rules: string[];
}

export interface WeeklyTrainingReportResponseData {
  range: {
    start_date: string;
    end_date: string;
  };
  status: "empty" | "ready";
  totals: WeeklyTrainingReportTotalsDto;
  frequency: WeeklyTrainingReportFrequencyDto;
  top_exercises: WeeklyTrainingReportExerciseDto[];
  top_muscle_groups: WeeklyTrainingReportMuscleGroupDto[];
  low_volume_muscle_groups: WeeklyTrainingReportMuscleGroupDto[];
  selected_exercise_progress: WeeklyTrainingReportSelectedExerciseDto | null;
  recovery_notes: string[];
  limitations: string[];
  evidence: WeeklyTrainingReportEvidenceDto;
}

const REPORT_EXERCISE_LIMIT = 5;
const REPORT_MUSCLE_GROUP_LIMIT = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function countRangeDays(range: {
  start_date: string;
  end_date: string;
}): number {
  const start = Date.parse(`${range.start_date}T00:00:00.000Z`);
  const end = Date.parse(`${range.end_date}T00:00:00.000Z`);

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 0;
  }

  return Math.floor((end - start) / MS_PER_DAY) + 1;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(2));
}

function mapMuscleGroup(
  group: MuscleLoadGroupDto,
): WeeklyTrainingReportMuscleGroupDto {
  return {
    muscle_group_id: group.muscle_group_id,
    muscle_group_name: group.muscle_group_name,
    set_count: group.set_count,
    total_reps: group.total_reps,
    weighted_volume: group.weighted_volume,
    contribution_ratio: group.contribution_ratio,
  };
}

function mapSelectedExerciseProgress(
  progress: ExerciseProgressResponseData | null,
): WeeklyTrainingReportSelectedExerciseDto | null {
  if (progress === null) {
    return null;
  }

  return {
    exercise_id: progress.exercise.exercise_id,
    exercise_name: progress.exercise.exercise_name,
    workout_count: progress.totals.workout_count,
    set_count: progress.totals.set_count,
    max_weight_kg: progress.totals.max_weight_kg,
    estimated_1rm_kg: progress.totals.estimated_1rm_kg,
  };
}

function buildRecoveryNotes(input: {
  recentWorkouts: Array<{ performed_at: string; set_count: number }>;
  workoutCount: number;
}): string[] {
  const latestWorkout = input.recentWorkouts[0];

  if (!latestWorkout) {
    return [
      "No latest recorded workout is available in this range, so recovery guidance stays conservative.",
    ];
  }

  return [
    `The latest recorded workout in this range was ${latestWorkout.performed_at} with ${latestWorkout.set_count} sets.`,
    `${input.workoutCount} recorded workouts in the selected range can show training frequency, but they do not capture sleep, soreness, pain, or readiness.`,
  ];
}

function buildLimitations(): string[] {
  return [
    "Weekly reports are based only on recorded workouts and sets.",
    "This report is a conservative training summary, not medical advice or a professional coaching prescription.",
    "Recovery notes do not include sleep, soreness, injury, pain, or subjective readiness unless the user recorded them separately.",
  ];
}

/**
 * Build a deterministic weekly training coach report for one authenticated user.
 *
 * @param userId - Authenticated user id.
 * @param input - Inclusive date-only range and optional selected exercise.
 * @returns Weekly report payload built from existing deterministic services.
 */
export async function getUserWeeklyTrainingReport(
  userId: string,
  input: WeeklyTrainingReportInput,
): Promise<WeeklyTrainingReportResponseData> {
  const range = {
    start_date: input.start_date,
    end_date: input.end_date,
  };
  const [summary, muscleLoad, recommendationContext, selectedProgress] =
    await Promise.all([
      getUserTrainingSummary(userId, range),
      getUserMuscleLoad(userId, range),
      getUserRecommendationContext(userId, range),
      input.exercise_id
        ? getUserExerciseProgress(userId, input.exercise_id, range)
        : Promise.resolve(null),
    ]);

  const rangeDays = countRangeDays(range);
  const calculationRules = new Set<string>([
    ...summary.evidence.calculation_rules,
    ...muscleLoad.evidence.calculation_rules,
    ...recommendationContext.evidence.calculation_rules,
  ]);
  const workoutIds = new Set<string>([
    ...summary.evidence.workout_ids,
    ...muscleLoad.evidence.workout_ids,
    ...recommendationContext.evidence.workout_ids,
  ]);
  const setIds = new Set<string>([
    ...muscleLoad.evidence.set_ids,
    ...recommendationContext.evidence.set_ids,
  ]);
  const calculationSources = [
    "training_summary",
    "muscle_load",
    "recommendation_context",
  ];

  if (selectedProgress !== null) {
    calculationSources.push("exercise_progress");

    for (const workoutId of selectedProgress.evidence.workout_ids) {
      workoutIds.add(workoutId);
    }

    for (const setId of selectedProgress.evidence.set_ids) {
      setIds.add(setId);
    }

    for (const rule of selectedProgress.evidence.calculation_rules) {
      calculationRules.add(rule);
    }
  }

  return {
    range,
    status: summary.totals.workout_count === 0 ? "empty" : "ready",
    totals: {
      workout_count: summary.totals.workout_count,
      set_count: summary.totals.set_count,
      total_reps: summary.totals.total_reps,
      total_volume: summary.totals.total_volume,
      total_weighted_volume: muscleLoad.totals.total_weighted_volume,
    },
    frequency: {
      range_days: rangeDays,
      workouts_per_week:
        rangeDays > 0
          ? roundMetric((summary.totals.workout_count / rangeDays) * 7)
          : 0,
    },
    top_exercises: summary.by_exercise.slice(0, REPORT_EXERCISE_LIMIT),
    top_muscle_groups: muscleLoad.top_muscle_groups
      .slice(0, REPORT_MUSCLE_GROUP_LIMIT)
      .map(mapMuscleGroup),
    low_volume_muscle_groups: muscleLoad.low_volume_muscle_groups
      .slice(0, REPORT_MUSCLE_GROUP_LIMIT)
      .map(mapMuscleGroup),
    selected_exercise_progress:
      mapSelectedExerciseProgress(selectedProgress),
    recovery_notes: buildRecoveryNotes({
      recentWorkouts: recommendationContext.recent_workouts,
      workoutCount: summary.totals.workout_count,
    }),
    limitations: buildLimitations(),
    evidence: {
      workout_ids: uniqueStrings([...workoutIds]),
      set_ids: uniqueStrings([...setIds]),
      calculation_sources: calculationSources,
      calculation_rules: [...calculationRules],
    },
  };
}
