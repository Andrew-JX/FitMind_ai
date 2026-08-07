import type { NextFunction, Request, Response } from "express";

import {
  createAiRateLimiter,
  type AiRateLimiter,
} from "../services/assistant/ai-rate-limiter.js";
import { HttpError } from "../utils/http-error.js";

const REGISTER_REQUESTS_PER_MINUTE = 5;
const LOGIN_REQUESTS_PER_MINUTE = 10;
/**
 * Tighter than login, because a wrong guess here is cheaper for the attacker
 * and far more expensive for the user: they already hold a valid session, and
 * what they are guessing at unlocks an irreversible delete.
 */
const ACCOUNT_DELETION_REQUESTS_PER_MINUTE = 3;
const AUTH_RATE_LIMIT_DAILY_CAP = Number.MAX_SAFE_INTEGER;

export type AuthRateLimitRoute = "register" | "login" | "account-deletion";

export interface AuthRateLimitMiddlewareOptions {
  route: AuthRateLimitRoute;
  limiter?: AiRateLimiter;
}

const AUTH_RATE_LIMIT_CONFIG: Record<
  AuthRateLimitRoute,
  { routeKey: string; requestsPerMinute: number }
> = {
  login: {
    routeKey: "POST /api/auth/login",
    requestsPerMinute: LOGIN_REQUESTS_PER_MINUTE,
  },
  register: {
    routeKey: "POST /api/auth/register",
    requestsPerMinute: REGISTER_REQUESTS_PER_MINUTE,
  },
  // The login limiter does not cover this: deletion re-authenticates without
  // going through `/api/auth/login`, so a holder of a leaked seven-day session
  // could otherwise guess the current password without limit — and each guess
  // buys a deliberately slow bcrypt comparison at the server's expense.
  "account-deletion": {
    routeKey: "DELETE /api/auth/account",
    requestsPerMinute: ACCOUNT_DELETION_REQUESTS_PER_MINUTE,
  },
};

/**
 * Builds auth endpoint rate-limit middleware keyed by client IP, authenticated
 * account where one exists, and auth route.
 *
 * @param options - Route-specific limits and optional injected limiter
 * @returns Express middleware that throws `429 RATE_LIMITED` when blocked
 *
 * @remarks
 * **Counted per process.** The underlying limiter is an in-memory `Map`, so on
 * a multi-instance or serverless deployment each instance keeps its own tally
 * and the effective limit is the configured number multiplied by however many
 * instances are warm. That is a real gap for account deletion in particular,
 * and closing it needs shared state (Redis or a database counter) rather than
 * a change here. Documented rather than papered over: this raises the cost of
 * guessing, it does not bound it.
 */
export function createAuthRateLimitMiddleware(
  options: AuthRateLimitMiddlewareOptions,
) {
  const config = AUTH_RATE_LIMIT_CONFIG[options.route];
  const limiter =
    options.limiter ??
    createAiRateLimiter({
      perMinute: config.requestsPerMinute,
      perDay: AUTH_RATE_LIMIT_DAILY_CAP,
    });

  return function authRateLimit(
    req: Request,
    res: Response<unknown, { userId?: string | undefined }>,
    next: NextFunction,
  ): void {
    // Register and login have no authenticated subject yet, so IP is all there
    // is. Account deletion runs after authentication, so it can also be counted
    // per account — which is the dimension that matters there: the attacker
    // holds a session for one specific user, and changing IP would otherwise
    // reset their guess budget.
    const subjects =
      res.locals.userId === undefined
        ? [`ip:${req.ip}`]
        : [`ip:${req.ip}`, `user:${res.locals.userId}`];

    for (const subject of subjects) {
      const decision = limiter.consume(`${subject}:${config.routeKey}`);

      if (!decision.allowed) {
        throw new HttpError(429, "RATE_LIMITED", "Rate limited.", {
          retry_after_seconds: decision.retryAfterSeconds,
        });
      }
    }

    next();
  };
}

/** Process-wide default register rate-limit middleware. */
export const registerRateLimitMiddleware = createAuthRateLimitMiddleware({
  route: "register",
});

/** Process-wide default login rate-limit middleware. */
export const loginRateLimitMiddleware = createAuthRateLimitMiddleware({
  route: "login",
});

/** Process-wide default account-deletion re-authentication rate limit. */
export const accountDeletionRateLimitMiddleware = createAuthRateLimitMiddleware(
  { route: "account-deletion" },
);
