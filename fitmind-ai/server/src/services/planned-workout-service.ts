import { z } from "zod";

import {
  createPlannedWorkout,
  getActivePlannedWorkoutForUser,
  updatePlannedWorkoutStatus,
  type PlannedWorkoutRow,
  type PlannedWorkoutStatus,
} from "../db/planned-workout-repository.js";
import { getTrainingSummary } from "../db/training-summary-repository.js";
import type { NextWeekPlanDraft } from "./agent/react-planner-types.js";
import {
  computePlanAdherence,
  type PlanAdherenceSummary,
} from "./training/plan-adherence.js";
import { HttpError } from "../utils/http-error.js";

/** Cap on snapshot list sizes so a malformed plan cannot bloat storage. */
const MAX_PLAN_EXERCISES = 20;
const MAX_PLAN_NOTES = 20;

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Date must use YYYY-MM-DD.");

const plannedExerciseSchema = z
  .object({
    exercise_name: z.string().trim().min(1),
    sets: z.number().int().min(0),
    rep_min: z.number().int().min(0),
    rep_max: z.number().int().min(0),
    target_weight_kg: z.number().nullable(),
    basis: z.string(),
  })
  .strict();

const planDraftSchema = z
  .object({
    strategy: z.enum(["consolidate", "add_frequency", "maintain"]),
    exercises: z.array(plannedExerciseSchema).max(MAX_PLAN_EXERCISES),
    notes: z.array(z.string()).max(MAX_PLAN_NOTES),
  })
  .strict();

export const acceptPlanInputSchema = z
  .object({
    startDate: dateOnlySchema,
    endDate: dateOnlySchema,
    plan: planDraftSchema,
    sourceMessageId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "endDate must be on or after startDate.",
      });
    }
  });

export type AcceptPlanInput = z.infer<typeof acceptPlanInputSchema>;

export interface PlannedWorkoutDto {
  id: string;
  status: PlannedWorkoutStatus;
  startDate: string;
  endDate: string;
  plan: NextWeekPlanDraft;
  sourceMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlannedWorkoutWithAdherenceDto extends PlannedWorkoutDto {
  adherence: PlanAdherenceSummary;
}

interface PlannedWorkoutDependencies {
  createPlannedWorkout: typeof createPlannedWorkout;
  getActivePlannedWorkoutForUser: typeof getActivePlannedWorkoutForUser;
  updatePlannedWorkoutStatus: typeof updatePlannedWorkoutStatus;
  getTrainingSummary: typeof getTrainingSummary;
}

const defaultDependencies: PlannedWorkoutDependencies = {
  createPlannedWorkout,
  getActivePlannedWorkoutForUser,
  updatePlannedWorkoutStatus,
  getTrainingSummary,
};

/**
 * Accepts a generated plan: validates the draft and persists it as the user's
 * active planned workout.
 *
 * @param userId - Owner user id
 * @param input - Validated accept-plan payload (date range + plan draft)
 * @param dependencies - Injectable repository functions (for tests)
 * @returns The persisted planned workout DTO
 */
export async function acceptPlan(
  userId: string,
  input: AcceptPlanInput,
  dependencies: PlannedWorkoutDependencies = defaultDependencies,
): Promise<PlannedWorkoutDto> {
  const row = await dependencies.createPlannedWorkout({
    userId,
    startDate: input.startDate,
    endDate: input.endDate,
    planJson: JSON.stringify(input.plan),
    sourceMessageId: input.sourceMessageId ?? null,
  });

  return mapRow(row);
}

/**
 * Returns the user's active plan with planned-vs-performed adherence computed
 * over the plan's date range, or null when there is no active plan.
 *
 * @param userId - Owner user id
 * @param dependencies - Injectable repository functions (for tests)
 * @returns The active plan DTO with adherence, or null
 */
export async function getCurrentPlanWithAdherence(
  userId: string,
  dependencies: PlannedWorkoutDependencies = defaultDependencies,
): Promise<PlannedWorkoutWithAdherenceDto | null> {
  const row = await dependencies.getActivePlannedWorkoutForUser(userId);

  if (row === null) {
    return null;
  }

  const dto = mapRow(row);
  const summary = await dependencies.getTrainingSummary({
    userId,
    startDate: dto.startDate,
    endDate: dto.endDate,
  });

  const adherence = computePlanAdherence({
    plannedExercises: dto.plan.exercises.map((exercise) => ({
      exerciseName: exercise.exercise_name,
      sets: exercise.sets,
    })),
    performedExercises: summary.byExercise.map((exercise) => ({
      exerciseName: exercise.exercise_name,
      setCount: exercise.set_count,
    })),
  });

  return { ...dto, adherence };
}

/**
 * Marks a user's planned workout as completed or abandoned.
 *
 * @param userId - Owner user id
 * @param planId - Target planned workout id
 * @param status - New status (`completed` or `abandoned`)
 * @param dependencies - Injectable repository functions (for tests)
 * @returns The updated planned workout DTO
 * @throws HttpError 404 when no matching plan exists for the user
 */
export async function setPlanStatus(
  userId: string,
  planId: string,
  status: Exclude<PlannedWorkoutStatus, "active">,
  dependencies: PlannedWorkoutDependencies = defaultDependencies,
): Promise<PlannedWorkoutDto> {
  const row = await dependencies.updatePlannedWorkoutStatus({
    id: planId,
    userId,
    status,
  });

  if (row === null) {
    throw new HttpError(404, "NOT_FOUND", "Planned workout was not found.");
  }

  return mapRow(row);
}

function mapRow(row: PlannedWorkoutRow): PlannedWorkoutDto {
  return {
    id: row.id,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    plan: planDraftSchema.parse(row.plan),
    sourceMessageId: row.source_message_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
