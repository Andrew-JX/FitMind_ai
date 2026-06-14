import type { NextFunction, Request, Response } from "express";
import { describe, expect, it } from "vitest";

import { createAiRateLimiter } from "../services/assistant/ai-rate-limiter.js";
import { isHttpError } from "../utils/http-error.js";
import { createAiRateLimitMiddleware } from "./ai-rate-limit-middleware.js";

function createResponse() {
  return {
    locals: { userId: "u1" },
  } as unknown as Response<unknown, { userId: string }>;
}

function createNext(): { fn: NextFunction; calls: () => number } {
  let count = 0;
  return {
    fn: () => {
      count += 1;
    },
    calls: () => count,
  };
}

describe("createAiRateLimitMiddleware", () => {
  it("calls next when the request is within limits", () => {
    const middleware = createAiRateLimitMiddleware(
      createAiRateLimiter({ perMinute: 5, perDay: 50, now: () => 0 }),
    );
    const next = createNext();

    middleware({} as Request, createResponse(), next.fn);

    expect(next.calls()).toBe(1);
  });

  it("throws a 429 HttpError with the rate-limit code when blocked", () => {
    const middleware = createAiRateLimitMiddleware(
      createAiRateLimiter({ perMinute: 1, perDay: 50, now: () => 0 }),
    );
    const next = createNext();
    const res = createResponse();

    middleware({} as Request, res, next.fn);

    expect(() => middleware({} as Request, res, next.fn)).toThrow();

    try {
      middleware({} as Request, res, next.fn);
    } catch (error) {
      expect(isHttpError(error)).toBe(true);
      if (isHttpError(error)) {
        expect(error.statusCode).toBe(429);
        expect(error.code).toBe("RATE_LIMITED");
        expect(error.details?.retry_after_seconds).toBeGreaterThan(0);
      }
    }

    expect(next.calls()).toBe(1);
  });
});
