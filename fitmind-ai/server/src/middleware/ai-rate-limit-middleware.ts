import type { NextFunction, Request, Response } from "express";

import {
  createAiRateLimiter,
  type AiRateLimiter,
} from "../services/assistant/ai-rate-limiter.js";
import { HttpError } from "../utils/http-error.js";

type AuthLocals = {
  userId: string;
};

const RATE_LIMIT_MESSAGES: Record<string, string> = {
  RATE_LIMITED: "AI 请求过于频繁，请稍后再试。",
  AI_QUOTA_EXCEEDED: "已达到今日 AI 调用上限，请明天再试。",
};

/**
 * Builds an Express middleware that enforces per-user AI rate limits using the
 * injected limiter. Blocked requests throw a 429 HttpError with the documented
 * `RATE_LIMITED` / `AI_QUOTA_EXCEEDED` code and a `retry_after_seconds` detail.
 *
 * @param limiter - The AI rate limiter to consume against
 * @returns An Express request handler
 */
export function createAiRateLimitMiddleware(limiter: AiRateLimiter) {
  return function aiRateLimit(
    _req: Request,
    res: Response<unknown, AuthLocals>,
    next: NextFunction,
  ): void {
    const decision = limiter.consume(res.locals.userId);

    if (decision.allowed) {
      next();
      return;
    }

    const code = decision.code ?? "RATE_LIMITED";
    throw new HttpError(
      429,
      code,
      RATE_LIMIT_MESSAGES[code] ?? "Rate limited.",
      {
        retry_after_seconds: decision.retryAfterSeconds,
      },
    );
  };
}

/** Process-wide default AI rate-limit middleware (in-memory limiter). */
export const aiRateLimitMiddleware = createAiRateLimitMiddleware(
  createAiRateLimiter(),
);
