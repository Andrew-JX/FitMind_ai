import { createAiRateLimiter, type AiRateLimiter } from "./ai-rate-limiter.js";

const DEFAULT_DAILY_CALL_BUDGET = 500;
const DEFAULT_DAILY_COST_BUDGET_USD = 1;
const INSTANCE_CALL_BUDGET_KEY = "ai:instance:real-provider:calls";
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface AssistantBudgetPolicy {
  killSwitchEngaged: boolean;
  dailyCallBudget: number;
  dailyCostBudgetUsd: number;
}

export type AssistantBudgetReason =
  | "kill_switch"
  | "daily_call_budget_exceeded"
  | "daily_cost_budget_exceeded";

export interface AssistantBudgetDecision {
  allowed: boolean;
  reason: AssistantBudgetReason | null;
  scope: "instance";
  currentCalls: number;
  callLimit: number;
  currentCostUsd: number;
  costLimitUsd: number;
}

export interface AssistantBudgetCounter {
  /** Checks all instance budgets and consumes one call only when allowed. */
  consumeCall(): AssistantBudgetDecision;
  /** Records a completed call's estimated cost; null leaves cost unchanged. */
  recordCost(estimatedCostUsd: number | null): void;
}

/**
 * Parses the real-provider wallet policy from environment values.
 *
 * @param source - Environment values to parse.
 * @returns A conservative policy with bounded defaults for invalid budgets.
 */
export function parseAssistantBudgetPolicy(
  source: NodeJS.ProcessEnv,
): AssistantBudgetPolicy {
  return {
    killSwitchEngaged: parseKillSwitch(
      source.ASSISTANT_REAL_PROVIDER_KILL_SWITCH,
    ),
    dailyCallBudget: parsePositiveInteger(
      source.ASSISTANT_REAL_PROVIDER_DAILY_CALL_BUDGET,
      DEFAULT_DAILY_CALL_BUDGET,
    ),
    dailyCostBudgetUsd: parsePositiveNumber(
      source.ASSISTANT_REAL_PROVIDER_DAILY_COST_BUDGET_USD,
      DEFAULT_DAILY_COST_BUDGET_USD,
    ),
  };
}

/**
 * Creates the per-instance in-memory real-provider budget counter.
 *
 * @param options - Parsed policy plus injectable clock and limiter seams.
 * @returns A counter that resets on UTC calendar-day boundaries.
 */
export function createAssistantBudgetCounter(options: {
  policy: AssistantBudgetPolicy;
  now?: () => number;
  callLimiter?: AiRateLimiter;
}): AssistantBudgetCounter {
  const clock = options.now ?? Date.now;
  const callLimiter =
    options.callLimiter ??
    createAiRateLimiter({
      perMinute: Number.MAX_SAFE_INTEGER,
      perDay: options.policy.dailyCallBudget,
      now: clock,
      dayWindow: "utc_calendar_day",
    });
  let dayKey = utcDayKey(clock());
  let currentCalls = 0;
  let currentCostUsd = 0;

  function resetForNewUtcDay(): void {
    const nextDayKey = utcDayKey(clock());

    if (nextDayKey !== dayKey) {
      dayKey = nextDayKey;
      currentCalls = 0;
      currentCostUsd = 0;
    }
  }

  function decision(
    allowed: boolean,
    reason: AssistantBudgetReason | null,
  ): AssistantBudgetDecision {
    return {
      allowed,
      reason,
      scope: "instance",
      currentCalls,
      callLimit: options.policy.dailyCallBudget,
      currentCostUsd,
      costLimitUsd: options.policy.dailyCostBudgetUsd,
    };
  }

  return {
    consumeCall(): AssistantBudgetDecision {
      resetForNewUtcDay();

      if (options.policy.killSwitchEngaged) {
        return decision(false, "kill_switch");
      }

      if (currentCostUsd >= options.policy.dailyCostBudgetUsd) {
        return decision(false, "daily_cost_budget_exceeded");
      }

      const callDecision = callLimiter.consume(INSTANCE_CALL_BUDGET_KEY);

      if (!callDecision.allowed) {
        return decision(false, "daily_call_budget_exceeded");
      }

      currentCalls += 1;
      return decision(true, null);
    },

    recordCost(estimatedCostUsd: number | null): void {
      resetForNewUtcDay();

      if (
        estimatedCostUsd !== null &&
        Number.isFinite(estimatedCostUsd) &&
        estimatedCostUsd >= 0
      ) {
        currentCostUsd += estimatedCostUsd;
      }
    },
  };
}

function parseKillSwitch(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "on", "yes"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "off", "no"].includes(normalized)) {
    return false;
  }

  return true;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined || !/^\d+$/.test(value.trim())) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveNumber(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function utcDayKey(timestampMs: number): number {
  return Math.floor(timestampMs / DAY_WINDOW_MS);
}
