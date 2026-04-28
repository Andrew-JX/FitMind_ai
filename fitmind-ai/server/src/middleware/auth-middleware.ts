import type { NextFunction, Request, Response } from "express";

import { verifyJwt } from "../services/auth/jwt.js";
import { HttpError } from "../utils/http-error.js";

type AuthLocals = {
  userId: string;
};

function extractBearerToken(headerValue: string | undefined): string {
  if (headerValue === undefined) {
    throw new HttpError(401, "UNAUTHORIZED", "Missing Authorization header.");
  }

  const [scheme, token] = headerValue.split(" ");

  if (scheme !== "Bearer" || token === undefined || token.length === 0) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid Authorization header.");
  }

  return token;
}

/**
 * Verify a bearer token and attach the authenticated user id to response locals.
 *
 * @param req - Express request.
 * @param res - Express response.
 * @param next - Express next callback.
 * @returns Promise resolving when auth succeeds or forwarding an error.
 */
export async function authMiddleware(
  req: Request,
  res: Response<unknown, AuthLocals>,
  next: NextFunction,
) {
  try {
    const token = extractBearerToken(req.header("authorization"));
    const payload = await verifyJwt(token);

    res.locals.userId = payload.userId;
    next();
  } catch (error) {
    next(error);
  }
}
