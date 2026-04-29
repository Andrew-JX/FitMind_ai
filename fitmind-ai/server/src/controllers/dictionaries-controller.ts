import type { Request, Response } from "express";
import { z } from "zod";

import {
  listDictionaryMuscleGroups,
  searchDictionaryExercises,
} from "../services/training/dictionary-service.js";
import { createSuccessResponse } from "../utils/api-response.js";

const exerciseQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  muscle: z.string().trim().min(1).optional(),
});

/**
 * Return all supported muscle groups.
 *
 * @param _req - Express request.
 * @param res - Express response.
 * @returns JSON dictionary response.
 */
export async function listMuscleGroupsController(_req: Request, res: Response) {
  const result = await listDictionaryMuscleGroups();

  return res.status(200).json(createSuccessResponse(result));
}

/**
 * Search exercises by keyword and optional muscle code.
 *
 * @param req - Express request with dictionary search query.
 * @param res - Express response.
 * @returns JSON dictionary response.
 */
export async function searchExercisesController(req: Request, res: Response) {
  const query = exerciseQuerySchema.parse({
    q: typeof req.query.q === "string" ? req.query.q : undefined,
    muscle: typeof req.query.muscle === "string" ? req.query.muscle : undefined,
  });
  const result = await searchDictionaryExercises(query);

  return res.status(200).json(createSuccessResponse(result));
}
