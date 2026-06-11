import type { NextFunction, Request, Response } from "express";

import { verifyJwt } from "../services/auth/jwt.js";
import { readAuthCookie } from "../utils/auth-cookie.js";
import { HttpError } from "../utils/http-error.js";

type AuthLocals = {
  userId: string;
};

/**
 * Resolve the auth token from the session cookie first, then a bearer header.
 *
 * @param req - Express request.
 * @returns The raw JWT string.
 *
 * @remarks
 * The HttpOnly cookie is the primary browser credential. The bearer header is
 * kept as a fallback so server-side smoke scripts and API clients keep working.
 */
function extractAuthToken(req: Request): string {
  const cookieToken = readAuthCookie(req);

  if (cookieToken !== undefined) {
    return cookieToken;
  }

  const headerValue = req.header("authorization");

  if (headerValue === undefined) {
    throw new HttpError(
      401,
      "UNAUTHORIZED",
      "Missing authentication credentials.",
    );
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
    const token = extractAuthToken(req);
    const payload = await verifyJwt(token);

    res.locals.userId = payload.userId;
    next();
  } catch (error) {
    next(error);
  }
}
