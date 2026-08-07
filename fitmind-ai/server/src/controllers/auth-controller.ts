import type { Request, Response } from "express";

import {
  deleteAccountSchema,
  loginSchema,
  recordConsentSchema,
  registerSchema,
} from "../schemas/auth-schemas.js";
import {
  deleteAccount,
  getCurrentUser,
  login,
  register,
} from "../services/auth/auth-service.js";
import {
  getRegistrationPolicy,
  recordConsent,
} from "../services/auth/consent-service.js";
import { createSuccessResponse } from "../utils/api-response.js";
import { clearAuthCookie, setAuthCookie } from "../utils/auth-cookie.js";

type AuthLocals = {
  userId: string;
};

/**
 * Register a new user and return an auth token.
 *
 * @param req - Express request with registration body.
 * @param res - Express response.
 * @returns JSON register response.
 */
export async function registerController(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const result = await register(input);

  setAuthCookie(res, result.token);

  return res.status(201).json(createSuccessResponse(result));
}

/**
 * Publish the registration policy this instance is serving.
 *
 * @param _req - Express request.
 * @param res - Express response.
 * @returns JSON registration policy response.
 *
 * @remarks
 * Unauthenticated by design: the client needs it before an account exists, to
 * render the sign-up form honestly instead of accepting input and returning
 * `403 REGISTRATION_CLOSED` after the fact. It exposes only what the legal
 * pages already state publicly.
 */
export async function registrationPolicyController(
  _req: Request,
  res: Response,
) {
  return res.status(200).json(createSuccessResponse(getRegistrationPolicy()));
}

/**
 * Record a consent given by an already-authenticated user.
 *
 * @param req - Express request with the consent body.
 * @param res - Express response with authenticated locals.
 * @returns JSON consent response.
 */
export async function recordConsentController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const input = recordConsentSchema.parse(req.body);
  const consent = await recordConsent({
    userId: res.locals.userId,
    consentType: input.consent_type,
    accepted: input.accepted,
    policyVersion: input.policy_version,
  });

  return res.status(201).json(createSuccessResponse({ consent }));
}

/**
 * Delete the authenticated account and end the session.
 *
 * @param req - Express request carrying the re-authentication password.
 * @param res - Express response with authenticated locals.
 * @returns JSON deletion response.
 *
 * @remarks
 * Clears the session cookie as part of the same response: leaving a cookie
 * pointing at a user id that no longer exists would put the browser in a state
 * where every subsequent request 401s with no explanation.
 */
export async function deleteAccountController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const input = deleteAccountSchema.parse(req.body);

  await deleteAccount(res.locals.userId, input.password);
  clearAuthCookie(res);

  return res.status(200).json(createSuccessResponse({ success: true }));
}

/**
 * Authenticate a user and return an auth token.
 *
 * @param req - Express request with login body.
 * @param res - Express response.
 * @returns JSON login response.
 */
export async function loginController(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const result = await login(input);

  setAuthCookie(res, result.token);

  return res.status(200).json(createSuccessResponse(result));
}

/**
 * Clear the auth session cookie and end the current session.
 *
 * @param _req - Express request.
 * @param res - Express response.
 * @returns JSON logout response.
 */
export async function logoutController(_req: Request, res: Response) {
  clearAuthCookie(res);

  return res.status(200).json(createSuccessResponse({ success: true }));
}

/**
 * Return the current authenticated user.
 *
 * @param _req - Express request.
 * @param res - Express response with authenticated locals.
 * @returns JSON current-user response.
 */
export async function meController(
  _req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const result = await getCurrentUser(res.locals.userId);

  return res.status(200).json(createSuccessResponse(result));
}
