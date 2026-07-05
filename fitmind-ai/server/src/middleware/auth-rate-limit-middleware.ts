import type { NextFunction, Request, Response } from "express";

import {
  createAiRateLimiter,
  type AiRateLimiter,
} from "../services/assistant/ai-rate-limiter.js";
import { HttpError } from "../utils/http-error.js";

const REGISTER_REQUESTS_PER_MINUTE = 5;
const LOGIN_REQUESTS_PER_MINUTE = 10;
const AUTH_RATE_LIMIT_DAILY_CAP = Number.MAX_SAFE_INTEGER;

export type AuthRateLimitRoute = "register" | "login";

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
};

/**
 * Builds auth endpoint rate-limit middleware keyed by client IP and auth route.
 *
 * @param options - Route-specific limits and optional injected limiter
 * @returns Express middleware that throws `429 RATE_LIMITED` when blocked
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
    _res: Response,
    next: NextFunction,
  ): void {
    const decision = limiter.consume(`${req.ip}:${config.routeKey}`);

    if (decision.allowed) {
      next();
      return;
    }

    throw new HttpError(429, "RATE_LIMITED", "Rate limited.", {
      retry_after_seconds: decision.retryAfterSeconds,
    });
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
