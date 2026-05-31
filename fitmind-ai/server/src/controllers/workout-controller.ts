import type { Request, Response } from "express";
import { z } from "zod";

import {
  addWorkoutSetSchema,
  createWorkoutSchema,
  updateWorkoutSchema,
  updateWorkoutSetSchema,
  workoutListQuerySchema,
} from "../schemas/workout-schemas.js";
import { workoutIntakeParseRequestSchema } from "../schemas/workout-intake-schemas.js";
import {
  addUserWorkoutSet,
  createUserWorkout,
  deleteUserWorkout,
  deleteUserWorkoutSet,
  getUserWorkout,
  listUserWorkouts,
  updateUserWorkout,
  updateUserWorkoutSet,
} from "../services/training/workout-service.js";
import { getUserAssistantInsights } from "../services/training/assistant-insights-service.js";
import { getUserExerciseProgress } from "../services/training/exercise-progress-service.js";
import { getUserMuscleLoad } from "../services/training/muscle-load-service.js";
import { getUserRecommendationContext } from "../services/training/recommendation-context-service.js";
import { getUserTrainingSummary } from "../services/training/training-summary-service.js";
import { parseUserWorkoutIntakeDraft } from "../services/training/workout-intake-service.js";
import { createSuccessResponse } from "../utils/api-response.js";

type AuthLocals = {
  userId: string;
};

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [yearValue, monthValue, dayValue] = value.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

const trainingDateRangeSchema = z
  .object({
    start_date: z
      .string()
      .refine(isValidDateOnly, "start_date must use YYYY-MM-DD."),
    end_date: z
      .string()
      .refine(isValidDateOnly, "end_date must use YYYY-MM-DD."),
  })
  .superRefine((value, ctx) => {
    if (value.start_date > value.end_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: "end_date must be on or after start_date.",
      });
    }
  });

const exerciseProgressQuerySchema = trainingDateRangeSchema.extend({
  exercise_id: z.string().uuid(),
});

const assistantInsightsQuerySchema = trainingDateRangeSchema.extend({
  exercise_id: z.string().uuid().optional(),
});

function parseIdParams(params: Request["params"]): { id: string } {
  return idParamsSchema.parse(params);
}

/**
 * List workouts for the authenticated user.
 *
 * @param req - Express request with query filters.
 * @param res - Express response with authenticated locals.
 * @returns JSON workout list response.
 */
export async function listWorkoutsController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const query = workoutListQuerySchema.parse({
    from: typeof req.query.from === "string" ? req.query.from : undefined,
    to: typeof req.query.to === "string" ? req.query.to : undefined,
    cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
    limit:
      typeof req.query.limit === "string" ? req.query.limit : req.query.limit,
  });
  const result = await listUserWorkouts(res.locals.userId, query);

  return res.status(200).json(createSuccessResponse(result));
}

/**
 * Return a deterministic training summary for the authenticated user.
 *
 * @param req - Express request with date range query params.
 * @param res - Express response with authenticated locals.
 * @returns JSON training summary response.
 */
export async function getTrainingSummaryController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const query = trainingDateRangeSchema.parse({
    start_date:
      typeof req.query.start_date === "string" ? req.query.start_date : "",
    end_date: typeof req.query.end_date === "string" ? req.query.end_date : "",
  });
  const result = await getUserTrainingSummary(res.locals.userId, query);

  return res.status(200).json(createSuccessResponse(result));
}

/**
 * Return deterministic exercise progress for the authenticated user.
 *
 * @param req - Express request with exercise id and date range query params.
 * @param res - Express response with authenticated locals.
 * @returns JSON exercise progress response.
 */
export async function getExerciseProgressController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const query = exerciseProgressQuerySchema.parse({
    exercise_id:
      typeof req.query.exercise_id === "string" ? req.query.exercise_id : "",
    start_date:
      typeof req.query.start_date === "string" ? req.query.start_date : "",
    end_date: typeof req.query.end_date === "string" ? req.query.end_date : "",
  });
  const result = await getUserExerciseProgress(
    res.locals.userId,
    query.exercise_id,
    {
      start_date: query.start_date,
      end_date: query.end_date,
    },
  );

  return res.status(200).json(createSuccessResponse(result));
}

/**
 * Return deterministic muscle-load distribution for the authenticated user.
 *
 * @param req - Express request with date range query params.
 * @param res - Express response with authenticated locals.
 * @returns JSON muscle-load response.
 */
export async function getMuscleLoadController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const query = trainingDateRangeSchema.parse({
    start_date:
      typeof req.query.start_date === "string" ? req.query.start_date : "",
    end_date: typeof req.query.end_date === "string" ? req.query.end_date : "",
  });
  const result = await getUserMuscleLoad(res.locals.userId, query);

  return res.status(200).json(createSuccessResponse(result));
}

/**
 * Return deterministic assistant insight cards for the authenticated user.
 *
 * @param req - Express request with date range and optional exercise id.
 * @param res - Express response with authenticated locals.
 * @returns JSON assistant insight cards response.
 */
export async function getAssistantInsightsController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const query = assistantInsightsQuerySchema.parse({
    exercise_id:
      typeof req.query.exercise_id === "string"
        ? req.query.exercise_id
        : undefined,
    start_date:
      typeof req.query.start_date === "string" ? req.query.start_date : "",
    end_date: typeof req.query.end_date === "string" ? req.query.end_date : "",
  });
  const result = await getUserAssistantInsights({
    exerciseId: query.exercise_id,
    range: {
      start_date: query.start_date,
      end_date: query.end_date,
    },
    userId: res.locals.userId,
  });

  return res.status(200).json(createSuccessResponse(result));
}

/**
 * Return a deterministic recommendation context package for the authenticated user.
 *
 * @param req - Express request with date range query params.
 * @param res - Express response with authenticated locals.
 * @returns JSON recommendation context response.
 */
export async function getRecommendationContextController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const query = trainingDateRangeSchema.parse({
    start_date:
      typeof req.query.start_date === "string" ? req.query.start_date : "",
    end_date: typeof req.query.end_date === "string" ? req.query.end_date : "",
  });
  const result = await getUserRecommendationContext(res.locals.userId, query);

  return res.status(200).json(createSuccessResponse(result));
}

/**
 * Parse natural-language workout text into a draft without saving it.
 *
 * @param req - Express request with natural-language text.
 * @param res - Express response with authenticated locals.
 * @returns JSON workout intake draft response.
 */
export async function parseWorkoutIntakeController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const input = workoutIntakeParseRequestSchema.parse(req.body);
  const result = await parseUserWorkoutIntakeDraft(res.locals.userId, input);

  return res.status(200).json(createSuccessResponse(result));
}

/**
 * Return one workout detail for the authenticated user.
 *
 * @param req - Express request with workout id.
 * @param res - Express response with authenticated locals.
 * @returns JSON workout detail response.
 */
export async function getWorkoutController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const params = parseIdParams(req.params);
  const result = await getUserWorkout(params.id, res.locals.userId);

  return res.status(200).json(createSuccessResponse(result));
}

/**
 * Create a workout with nested sets for the authenticated user.
 *
 * @param req - Express request with workout payload.
 * @param res - Express response with authenticated locals.
 * @returns JSON created workout response.
 */
export async function createWorkoutController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const input = createWorkoutSchema.parse(req.body);
  const result = await createUserWorkout(res.locals.userId, input);

  return res.status(201).json(createSuccessResponse(result));
}

/**
 * Update workout metadata for the authenticated user.
 *
 * @param req - Express request with workout id and patch payload.
 * @param res - Express response with authenticated locals.
 * @returns JSON updated workout response.
 */
export async function updateWorkoutController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const params = parseIdParams(req.params);
  const input = updateWorkoutSchema.parse(req.body);
  const result = await updateUserWorkout(params.id, res.locals.userId, input);

  return res.status(200).json(createSuccessResponse(result));
}

/**
 * Delete a workout for the authenticated user.
 *
 * @param req - Express request with workout id.
 * @param res - Express response with authenticated locals.
 * @returns JSON unified delete response.
 */
export async function deleteWorkoutController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const params = parseIdParams(req.params);
  const result = await deleteUserWorkout(params.id, res.locals.userId);

  return res.status(200).json(createSuccessResponse(result));
}

/**
 * Add a set to an existing workout for the authenticated user.
 *
 * @param req - Express request with workout id and set payload.
 * @param res - Express response with authenticated locals.
 * @returns JSON updated workout response.
 */
export async function addWorkoutSetController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const params = parseIdParams(req.params);
  const input = addWorkoutSetSchema.parse(req.body);
  const result = await addUserWorkoutSet(params.id, res.locals.userId, input);

  return res.status(201).json(createSuccessResponse(result));
}

/**
 * Update a set for the authenticated user.
 *
 * @param req - Express request with set id and patch payload.
 * @param res - Express response with authenticated locals.
 * @returns JSON updated set response.
 */
export async function updateSetController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const params = parseIdParams(req.params);
  const input = updateWorkoutSetSchema.parse(req.body);
  const result = await updateUserWorkoutSet(
    params.id,
    res.locals.userId,
    input,
  );

  return res.status(200).json(createSuccessResponse({ set: result }));
}

/**
 * Delete a set for the authenticated user.
 *
 * @param req - Express request with set id.
 * @param res - Express response with authenticated locals.
 * @returns JSON unified delete response.
 */
export async function deleteSetController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const params = parseIdParams(req.params);
  const result = await deleteUserWorkoutSet(params.id, res.locals.userId);

  return res.status(200).json(createSuccessResponse(result));
}
