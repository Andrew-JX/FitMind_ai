import type { Request, Response } from "express";
import { z } from "zod";

import {
  acceptPlan,
  acceptPlanInputSchema,
  getCurrentPlanWithAdherence,
  setPlanStatus,
} from "../services/planned-workout-service.js";
import { createSuccessResponse } from "../utils/api-response.js";

type AuthLocals = {
  userId: string;
};

const planIdParamSchema = z.object({ id: z.string().uuid() });
const planStatusBodySchema = z
  .object({ status: z.enum(["completed", "abandoned"]) })
  .strict();

export async function postAcceptPlanController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const body = acceptPlanInputSchema.parse(req.body);
  const plannedWorkout = await acceptPlan(res.locals.userId, body);

  return res.status(201).json(createSuccessResponse({ plannedWorkout }));
}

export async function getCurrentPlannedWorkoutController(
  _req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const plannedWorkout = await getCurrentPlanWithAdherence(res.locals.userId);

  return res.status(200).json(createSuccessResponse({ plannedWorkout }));
}

export async function patchPlannedWorkoutStatusController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const { id } = planIdParamSchema.parse(req.params);
  const { status } = planStatusBodySchema.parse(req.body);
  const plannedWorkout = await setPlanStatus(res.locals.userId, id, status);

  return res.status(200).json(createSuccessResponse({ plannedWorkout }));
}
