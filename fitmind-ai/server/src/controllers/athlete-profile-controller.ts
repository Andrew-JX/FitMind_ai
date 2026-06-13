import type { Request, Response } from "express";

import {
  athleteProfileInputSchema,
  getAthleteProfile,
  saveAthleteProfile,
} from "../services/athlete-profile-service.js";
import { createSuccessResponse } from "../utils/api-response.js";

type AuthLocals = {
  userId: string;
};

export async function getAthleteProfileController(
  _req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const profile = await getAthleteProfile(res.locals.userId);

  return res.status(200).json(createSuccessResponse({ profile }));
}

export async function putAthleteProfileController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const body = athleteProfileInputSchema.parse(req.body);
  const profile = await saveAthleteProfile(res.locals.userId, body);

  return res.status(200).json(createSuccessResponse({ profile }));
}
