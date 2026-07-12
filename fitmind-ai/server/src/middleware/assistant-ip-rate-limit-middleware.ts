import type { NextFunction, Request, Response } from "express";

import {
  createAiRateLimiter,
  type AiRateLimitDecision,
  type AiRateLimiter,
} from "../services/assistant/ai-rate-limiter.js";
import {
  getConfiguredAssistantProvider,
  type AssistantProviderName,
} from "../services/assistant/provider-config.js";

const AI_IP_REQUESTS_PER_MINUTE = 10;
const AI_IP_REQUESTS_PER_DAY = 30;

export type AssistantIpBudgetReason =
  | "per_ip_minute_limit_exceeded"
  | "per_ip_daily_limit_exceeded"
  | "invalid_per_ip_limit_decision";

interface AssistantIpBudgetTelemetryCounters {
  budget_scope: "ip";
  budget_ip_minute_count: number;
  budget_ip_minute_limit: number;
  budget_ip_day_count: number;
  budget_ip_day_limit: number;
  budget_retry_after_seconds: number | null;
}

export interface AssistantIpBudgetAllowTelemetry extends AssistantIpBudgetTelemetryCounters {
  budget_fallback: false;
  budget_reason: null;
}

export interface AssistantIpBudgetFallbackTelemetry extends AssistantIpBudgetTelemetryCounters {
  budget_fallback: true;
  budget_reason: AssistantIpBudgetReason;
}

export type AssistantIpGuardDecision =
  | {
      kind: "allow";
      telemetry: AssistantIpBudgetAllowTelemetry;
    }
  | {
      kind: "fallback";
      fallback_provider: "mock";
      telemetry: AssistantIpBudgetFallbackTelemetry;
    };

export interface AssistantIpRateLimitLocals {
  userId: string;
  assistantIpGuardDecision?: AssistantIpGuardDecision | undefined;
}

export interface AssistantIpRateLimitMiddlewareOptions {
  limiter?: AiRateLimiter;
  getProvider?: () => AssistantProviderName;
}

/**
 * Creates request middleware for the per-IP real-provider-eligible turn cap.
 *
 * The middleware never throws a public 429. It records an allow/fallback
 * decision in response locals and always continues; AR-1d will consume that
 * request-scoped decision before any real provider call.
 *
 * @param options - Injectable limiter and configured-provider getter.
 * @returns Express middleware that records the per-IP guard decision.
 */
export function createAssistantIpRateLimitMiddleware(
  options: AssistantIpRateLimitMiddlewareOptions = {},
) {
  const limiter =
    options.limiter ??
    createAiRateLimiter({
      perMinute: AI_IP_REQUESTS_PER_MINUTE,
      perDay: AI_IP_REQUESTS_PER_DAY,
      dayWindow: "utc_calendar_day",
    });
  const getProvider = options.getProvider ?? getConfiguredAssistantProvider;

  return function assistantIpRateLimit(
    req: Request,
    res: Response<unknown, AssistantIpRateLimitLocals>,
    next: NextFunction,
  ): void {
    if (getProvider() === "mock") {
      next();
      return;
    }

    const decision = limiter.consume(`ai:ip:${req.ip}:assistant`);
    res.locals.assistantIpGuardDecision = mapIpLimitDecision(decision);
    next();
  };
}

const defaultAssistantIpRateLimitMiddleware =
  createAssistantIpRateLimitMiddleware();

/**
 * Returns the middleware backed by the process-level default IP limiter.
 *
 * @returns The singleton middleware shared across future assistant routes.
 */
export function getDefaultAssistantIpRateLimitMiddleware() {
  return defaultAssistantIpRateLimitMiddleware;
}

function mapIpLimitDecision(
  decision: AiRateLimitDecision,
): AssistantIpGuardDecision {
  const counters: AssistantIpBudgetTelemetryCounters = {
    budget_scope: "ip",
    budget_ip_minute_count: decision.minuteCount,
    budget_ip_minute_limit: decision.minuteLimit,
    budget_ip_day_count: decision.dayCount,
    budget_ip_day_limit: decision.dayLimit,
    budget_retry_after_seconds: decision.retryAfterSeconds ?? null,
  };

  if (decision.allowed) {
    return {
      kind: "allow",
      telemetry: {
        budget_fallback: false,
        budget_reason: null,
        ...counters,
      },
    };
  }

  const reason: AssistantIpBudgetReason =
    decision.code === "RATE_LIMITED"
      ? "per_ip_minute_limit_exceeded"
      : decision.code === "AI_QUOTA_EXCEEDED"
        ? "per_ip_daily_limit_exceeded"
        : "invalid_per_ip_limit_decision";

  return {
    kind: "fallback",
    fallback_provider: "mock",
    telemetry: {
      budget_fallback: true,
      budget_reason: reason,
      ...counters,
    },
  };
}
