import type { Request, Response } from "express";

import {
  athleteProfileInputSchema,
  getAthleteProfile,
  saveAthleteProfile,
  withdrawInjuryConstraints,
} from "../services/athlete-profile-service.js";
import { getHealthConsentFlags } from "../services/auth/consent-service.js";
import { createSuccessResponse } from "../utils/api-response.js";

type AuthLocals = {
  userId: string;
};

/**
 * Return the athlete profile plus whether health-data consent is already held.
 *
 * @param _req - Express request.
 * @param res - Express response with authenticated locals.
 * @returns JSON profile response.
 *
 * @remarks
 * The consent flag is sent so the form can ask exactly once. Without it the
 * client would either re-ask on every save — training users to tick past it —
 * or assume an answer it has no way to know.
 */
export async function getAthleteProfileController(
  _req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const profile = await getAthleteProfile(res.locals.userId);
  const flags = await getHealthConsentFlags(res.locals.userId);

  return res.status(200).json(createSuccessResponse({ profile, ...flags }));
}

/**
 * Validate and upsert the profile, reporting the health-consent state after.
 *
 * @param req - Express request with the profile body.
 * @param res - Express response with authenticated locals.
 * @returns JSON profile response.
 *
 * @remarks
 * Returns the same shape as GET, `health_consent_on_file` included, so the form
 * does not have to re-fetch to learn that the consent it just supplied is now
 * on record. Read after the write: a save that collected the consent flips it.
 */
export async function putAthleteProfileController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const body = athleteProfileInputSchema.parse(req.body);
  const profile = await saveAthleteProfile(res.locals.userId, body);
  const flags = await getHealthConsentFlags(res.locals.userId);

  return res.status(200).json(createSuccessResponse({ profile, ...flags }));
}

/**
 * Delete only the stored injury constraints, leaving the rest of the profile.
 *
 * @param _req - Express request.
 * @param res - Express response with authenticated locals.
 * @returns JSON success response.
 *
 * @remarks
 * Mounted outside the consent gate on purpose. A user who owes the health-data
 * consent cannot reach `PUT /api/athlete-profile` to clear the field, so
 * gating this one too would leave withdrawal impossible — the user could only
 * consent, log out with the data still stored, or delete their whole account.
 * That is the trap art. 15 (easy withdrawal) and art. 16 (no refusing service
 * over an unrelated consent) exist to prevent.
 *
 * Idempotent: withdrawing when nothing is stored is the state the caller
 * wanted, not an error.
 */
export async function deleteInjuryConstraintsController(
  _req: Request,
  res: Response<unknown, AuthLocals>,
) {
  await withdrawInjuryConstraints(res.locals.userId);

  return res.status(200).json(createSuccessResponse({ success: true }));
}
