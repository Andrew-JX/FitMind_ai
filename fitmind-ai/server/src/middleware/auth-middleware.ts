import type { NextFunction, Request, Response } from "express";

import { getPendingConsents } from "../services/auth/consent-service.js";
import { verifyJwt } from "../services/auth/jwt.js";
import { readAuthCookie } from "../utils/auth-cookie.js";
import { HttpError } from "../utils/http-error.js";

type AuthLocals = {
  userId: string;
  /** Set once the token has been verified for this request. */
  authResolved?: boolean | undefined;
  /** Set once the consent gate has run and allowed this request through. */
  consentsSettled?: boolean | undefined;
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

export interface AuthMiddlewareOptions {
  /**
   * Set to false only for the endpoints the catch-up flow itself needs.
   *
   * Defaults to true so that a router added later is gated unless its author
   * deliberately opts out. The previous shape had no gate at all and relied on
   * the client to stop, which meant any caller holding a valid cookie or bearer
   * token reached every business endpoint while still owing consent.
   */
  requireSettledConsents?: boolean | undefined;
}

/**
 * Build auth middleware that verifies the token and, by default, refuses
 * callers who still owe a consent.
 *
 * @param options - Optional opt-out from the consent gate
 * @returns Express middleware
 *
 * @remarks
 * Authentication and consent are checked in the same place on purpose. Keeping
 * them apart is what produced the hole this closes: every protected router
 * already called `authMiddleware`, so folding the gate into it covers all of
 * them at once and leaves no list to keep in sync.
 *
 * The gate costs one extra query per authenticated request (a single row of
 * `EXISTS` subqueries, see `getConsentStatus`). That is deliberate — a
 * compliance check billed at three round trips is one someone eventually
 * removes for being slow.
 */
export function createAuthMiddleware(options?: AuthMiddlewareOptions) {
  const requireSettledConsents = options?.requireSettledConsents ?? true;

  const middleware = async function authenticate(
    req: Request,
    res: Response<unknown, AuthLocals>,
    next: NextFunction,
  ) {
    try {
      // Both halves are memoized per request. Several routers share the `/api`
      // prefix, so more than one gate could sit on a single request's path;
      // scoping each gate to the paths its own router owns keeps that to one in
      // practice, and memoizing keeps the cost bounded if that ever stops being
      // true.
      //
      // Note what this does *not* do: the exempt variant records only
      // `authResolved`, never `consentsSettled`, so a gated middleware reached
      // later would still run the check and refuse. The exemption is protected
      // by routing — the exempt routes are reached before any gated router —
      // not by this cache.
      if (res.locals.authResolved !== true) {
        const token = extractAuthToken(req);
        const payload = await verifyJwt(token);

        res.locals.userId = payload.userId;
        res.locals.authResolved = true;
      }

      if (requireSettledConsents && res.locals.consentsSettled !== true) {
        const pending = await getPendingConsents(res.locals.userId);

        if (pending.length > 0) {
          throw new HttpError(
            403,
            "CONSENT_REQUIRED",
            "This account must complete an outstanding consent before using the service.",
            { pending_consents: pending },
          );
        }

        res.locals.consentsSettled = true;
      }

      next();
    } catch (error) {
      next(error);
    }
  };

  // The two variants carry distinct names so router-wiring tests can assert
  // which one a route actually mounted. Without this they are both
  // `authenticate`, and a route that quietly lost its consent gate would still
  // satisfy a name-based assertion.
  Object.defineProperty(middleware, "name", {
    value: requireSettledConsents
      ? "authenticateWithConsentGate"
      : "authenticateAllowingPendingConsents",
  });

  return middleware;
}

/**
 * Verify a bearer token, attach the user id, and refuse callers who owe a
 * consent. Used by every protected router.
 */
export const authMiddleware = createAuthMiddleware();

/**
 * Auth without the consent gate, for the three endpoints the catch-up flow
 * needs to reach while consent is still outstanding: reading what is owed
 * (`GET /api/auth/me`), settling it (`POST /api/auth/consents`), and leaving
 * (`POST /api/auth/logout`, which is unauthenticated anyway).
 *
 * Gating those would deadlock the user: they could neither give the consent nor
 * find out what it was.
 */
export const authMiddlewareAllowingPendingConsents = createAuthMiddleware({
  requireSettledConsents: false,
});
