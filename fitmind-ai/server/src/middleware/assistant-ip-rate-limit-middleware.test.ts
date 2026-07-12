import type { NextFunction, Request, Response } from "express";
import { describe, expect, it } from "vitest";

import { createAiRateLimiter } from "../services/assistant/ai-rate-limiter.js";
import type { AssistantProviderName } from "../services/assistant/provider-config.js";
import {
  createAssistantIpRateLimitMiddleware,
  getDefaultAssistantIpRateLimitMiddleware,
  type AssistantIpRateLimitLocals,
} from "./assistant-ip-rate-limit-middleware.js";

function createRequest(ip: string): Request {
  return { ip } as Request;
}

function createResponse(
  userId: string,
): Response<unknown, AssistantIpRateLimitLocals> {
  return { locals: { userId } } as Response<
    unknown,
    AssistantIpRateLimitLocals
  >;
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

describe("assistant per-IP rate-limit middleware", () => {
  it("returns the same process-level default middleware", () => {
    expect(getDefaultAssistantIpRateLimitMiddleware()).toBe(
      getDefaultAssistantIpRateLimitMiddleware(),
    );
  });

  it("shares the 10/min cap across users on one IP and isolates other IPs", () => {
    let now = 0;
    const middleware = createAssistantIpRateLimitMiddleware({
      limiter: createAiRateLimiter({
        perMinute: 10,
        perDay: 30,
        dayWindow: "utc_calendar_day",
        now: () => now,
      }),
      getProvider: () => "openai_compatible",
    });
    const request = createRequest("203.0.113.10");
    const next = createNext();

    for (let index = 0; index < 10; index += 1) {
      const response = createResponse(index < 5 ? "user-1" : "user-2");
      middleware(request, response, next.fn);
      expect(response.locals.assistantIpGuardDecision?.kind).toBe("allow");
    }

    const blockedResponse = createResponse("user-3");
    middleware(request, blockedResponse, next.fn);
    expect(blockedResponse.locals.assistantIpGuardDecision).toMatchObject({
      kind: "fallback",
      fallback_provider: "mock",
      telemetry: {
        budget_fallback: true,
        budget_reason: "per_ip_minute_limit_exceeded",
        budget_scope: "ip",
        budget_ip_minute_count: 10,
        budget_ip_minute_limit: 10,
        budget_ip_day_count: 10,
        budget_ip_day_limit: 30,
      },
    });

    const otherIpResponse = createResponse("user-3");
    middleware(createRequest("203.0.113.11"), otherIpResponse, next.fn);
    expect(otherIpResponse.locals.assistantIpGuardDecision?.kind).toBe("allow");

    now += 60_000;
    const resetResponse = createResponse("user-1");
    middleware(request, resetResponse, next.fn);
    expect(resetResponse.locals.assistantIpGuardDecision).toMatchObject({
      kind: "allow",
      telemetry: {
        budget_ip_minute_count: 1,
        budget_ip_day_count: 11,
      },
    });
    expect(next.calls()).toBe(13);
  });

  it("enforces 30 per UTC day and resets at UTC midnight", () => {
    let now = Date.UTC(2026, 6, 12, 0, 0, 0);
    const middleware = createAssistantIpRateLimitMiddleware({
      limiter: createAiRateLimiter({
        perMinute: 10,
        perDay: 30,
        dayWindow: "utc_calendar_day",
        now: () => now,
      }),
      getProvider: () => "groq",
    });
    const request = createRequest("198.51.100.20");
    const next = createNext();

    for (let index = 0; index < 30; index += 1) {
      const response = createResponse("user-1");
      middleware(request, response, next.fn);
      expect(response.locals.assistantIpGuardDecision?.kind).toBe("allow");
      now += 60_000;
    }

    const blockedResponse = createResponse("user-1");
    middleware(request, blockedResponse, next.fn);
    expect(blockedResponse.locals.assistantIpGuardDecision).toMatchObject({
      kind: "fallback",
      telemetry: {
        budget_reason: "per_ip_daily_limit_exceeded",
        budget_ip_day_count: 30,
        budget_ip_day_limit: 30,
      },
    });

    now = Date.UTC(2026, 6, 13, 0, 0, 0);
    const resetResponse = createResponse("user-1");
    middleware(request, resetResponse, next.fn);
    expect(resetResponse.locals.assistantIpGuardDecision).toMatchObject({
      kind: "allow",
      telemetry: {
        budget_ip_minute_count: 1,
        budget_ip_day_count: 1,
      },
    });
    expect(next.calls()).toBe(32);
  });

  it("does not consume quota while the configured provider is mock", () => {
    let provider: AssistantProviderName = "mock";
    const middleware = createAssistantIpRateLimitMiddleware({
      limiter: createAiRateLimiter({
        perMinute: 1,
        perDay: 1,
        dayWindow: "utc_calendar_day",
        now: () => 0,
      }),
      getProvider: () => provider,
    });
    const request = createRequest("192.0.2.30");
    const next = createNext();
    const mockResponse = createResponse("user-1");

    middleware(request, mockResponse, next.fn);
    expect(mockResponse.locals.assistantIpGuardDecision).toBeUndefined();

    provider = "openai_compatible";
    const allowedResponse = createResponse("user-1");
    middleware(request, allowedResponse, next.fn);
    expect(allowedResponse.locals.assistantIpGuardDecision?.kind).toBe("allow");

    const blockedResponse = createResponse("user-1");
    middleware(request, blockedResponse, next.fn);
    expect(blockedResponse.locals.assistantIpGuardDecision?.kind).toBe(
      "fallback",
    );
    expect(next.calls()).toBe(3);
  });

  it("keeps injected middleware instances isolated", () => {
    const build = () =>
      createAssistantIpRateLimitMiddleware({
        limiter: createAiRateLimiter({
          perMinute: 1,
          perDay: 1,
          now: () => 0,
        }),
        getProvider: () => "anthropic",
      });
    const request = createRequest("192.0.2.40");
    const firstResponse = createResponse("user-1");
    const secondResponse = createResponse("user-1");

    build()(request, firstResponse, () => undefined);
    build()(request, secondResponse, () => undefined);

    expect(firstResponse.locals.assistantIpGuardDecision?.kind).toBe("allow");
    expect(secondResponse.locals.assistantIpGuardDecision?.kind).toBe("allow");
  });
});
