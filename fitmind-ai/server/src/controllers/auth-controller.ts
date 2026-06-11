import type { Request, Response } from "express";

import { loginSchema, registerSchema } from "../schemas/auth-schemas.js";
import {
  getCurrentUser,
  login,
  register,
} from "../services/auth/auth-service.js";
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
