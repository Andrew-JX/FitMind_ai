import { z } from "zod";

import {
  createPlannedWorkoutSupersedingActive,
  getActivePlannedWorkoutForUser,
  getLatestAcceptedPlannedWorkoutForUser,
  updatePlannedWorkoutStatus,
  type PlannedWorkoutRow,
  type PlannedWorkoutStatus,
} from "../db/planned-workout-repository.js";
import { getTrainingSummary } from "../db/training-summary-repository.js";
import type {
  NextWeekPlanDraft,
  PlanAdherenceContext,
} from "./agent/react-planner-types.js";
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

const plannedExerciseAlternativeSchema = z
  .object({
    exercise_id: z.string().uuid(),
    exercise_name: z.string().trim().min(1),
    equipment: z.string().nullable(),
    movement_pattern: z.string().nullable(),
    primary_muscles: z.array(z.string()),
    rest_seconds: z.number().int().positive(),
  })
  .strict();

const plannedExerciseSchema = z
  .object({
    exercise_id: z.string().uuid().optional(),
    exercise_name: z.string().trim().min(1),
    sets: z.number().int().min(0),
    rep_min: z.number().int().min(0),
    rep_max: z.number().int().min(0),
    target_weight_kg: z.number().nullable(),
    rest_seconds: z.number().int().positive().optional(),
    equipment: z.string().nullable().optional(),
    movement_pattern: z.string().nullable().optional(),
    primary_muscles: z.array(z.string()).optional(),
    alternatives: z.array(plannedExerciseAlternativeSchema).max(3).optional(),
    basis: z.string(),
  })
  .strict();

const planDraftSchema = z
  .object({
    strategy: z.enum(["consolidate", "add_frequency", "maintain"]),
    exercises: z.array(plannedExerciseSchema).max(MAX_PLAN_EXERCISES),
    sessions: z
      .array(
        z
          .object({
            session_index: z.number().int().positive(),
            title: z.string().trim().min(1),
            focus_areas: z.array(z.string()).max(6),
            estimated_duration_minutes: z.number().int().positive(),
            exercises: z.array(plannedExerciseSchema).max(MAX_PLAN_EXERCISES),
          })
          .strict(),
      )
      .max(7)
      .optional(),
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
  createPlannedWorkoutSupersedingActive: typeof createPlannedWorkoutSupersedingActive;
  getActivePlannedWorkoutForUser: typeof getActivePlannedWorkoutForUser;
  getLatestAcceptedPlannedWorkoutForUser: typeof getLatestAcceptedPlannedWorkoutForUser;
  updatePlannedWorkoutStatus: typeof updatePlannedWorkoutStatus;
  getTrainingSummary: typeof getTrainingSummary;
}

const defaultDependencies: PlannedWorkoutDependencies = {
  createPlannedWorkoutSupersedingActive,
  getActivePlannedWorkoutForUser,
  getLatestAcceptedPlannedWorkoutForUser,
  updatePlannedWorkoutStatus,
  getTrainingSummary,
};

/**
 * Accepts a generated plan: validates the draft, completes any plan the user
 * already had active, and persists the new one as their active plan.
 *
 * @param userId - Owner user id
 * @param input - Validated accept-plan payload (date range + plan draft)
 * @param dependencies - Injectable repository functions (for tests)
 * @returns The persisted planned workout DTO
 *
 * @remarks
 * Accepting used to be a bare INSERT, so a user could hold several active
 * plans at once. `/current` returns only the newest, which made the older rows
 * invisible in the UI and therefore impossible to abandon — while D42's planner
 * context could still read them and quietly base next week's plan on a plan the
 * user had moved on from.
 */
export async function acceptPlan(
  userId: string,
  input: AcceptPlanInput,
  dependencies: PlannedWorkoutDependencies = defaultDependencies,
): Promise<PlannedWorkoutDto> {
  const row = await dependencies.createPlannedWorkoutSupersedingActive({
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
 * Builds the best-effort previous-plan adherence context used by the planner.
 *
 * @param userId - Owner user id
 * @param input - Planner evidence date range used to find an overlapping accepted plan
 * @param dependencies - Injectable repository functions (for tests)
 * @returns Previous accepted plan adherence context, or null when none overlaps
 */
export async function getPlanAdherenceContextForPlanner(
  userId: string,
  input: { startDate: string; endDate: string },
  dependencies: PlannedWorkoutDependencies = defaultDependencies,
): Promise<PlanAdherenceContext | null> {
  const row = await dependencies.getLatestAcceptedPlannedWorkoutForUser({
    userId,
    startDate: input.startDate,
    endDate: input.endDate,
  });

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
  const targetWeightByName = new Map(
    dto.plan.exercises.map((exercise) => [
      normalizeExerciseName(exercise.exercise_name),
      exercise.target_weight_kg,
    ]),
  );

  return {
    startDate: dto.startDate,
    endDate: dto.endDate,
    exerciseAdherenceRatio: adherence.exercise_adherence_ratio,
    setAdherenceRatio: adherence.set_adherence_ratio,
    exercises: adherence.exercises.map((exercise) => ({
      exerciseName: exercise.exercise_name,
      plannedSets: exercise.planned_sets,
      performedSets: exercise.performed_sets,
      status: exercise.status,
      setCompletionRatio: exercise.set_completion_ratio,
      targetWeightKg:
        targetWeightByName.get(normalizeExerciseName(exercise.exercise_name)) ??
        null,
    })),
  };
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

function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase();
}
