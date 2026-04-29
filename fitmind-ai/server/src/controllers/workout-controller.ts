import type { Request, Response } from "express";
import { z } from "zod";

import {
  addWorkoutSetSchema,
  createWorkoutSchema,
  updateWorkoutSchema,
  updateWorkoutSetSchema,
  workoutListQuerySchema,
} from "../schemas/workout-schemas.js";
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
import { createSuccessResponse } from "../utils/api-response.js";

type AuthLocals = {
  userId: string;
};

const idParamsSchema = z.object({
  id: z.string().uuid(),
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
