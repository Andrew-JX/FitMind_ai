import { describe, expect, it, vi } from "vitest";

import {
  createAssistantBudgetCounter,
  type AssistantBudgetCounter,
  type AssistantBudgetPolicy,
} from "./assistant-budget-policy.js";
import {
  createAssistantProviderGuard,
  getDefaultAssistantProviderGuard,
} from "./assistant-provider-guard.js";

const livePolicy: AssistantBudgetPolicy = {
  killSwitchEngaged: false,
  dailyCallBudget: 2,
  dailyCostBudgetUsd: 1,
};

function createGuard(policy: AssistantBudgetPolicy = livePolicy) {
  return createAssistantProviderGuard(
    createAssistantBudgetCounter({ policy, now: () => 0 }),
  );
}

describe("assistant provider guard", () => {
  it("returns the same process-level default guard on every lookup", () => {
    expect(getDefaultAssistantProviderGuard()).toBe(
      getDefaultAssistantProviderGuard(),
    );
  });

  it("consumes exactly once and returns deterministic allow telemetry", () => {
    const consumeCall = vi.fn(() => ({
      allowed: true,
      reason: null,
      scope: "instance" as const,
      currentCalls: 1,
      callLimit: 500,
      currentCostUsd: 0,
      costLimitUsd: 1,
    }));
    const recordCost = vi.fn();
    const counter: AssistantBudgetCounter = { consumeCall, recordCost };
    const guard = createAssistantProviderGuard(counter);

    expect(guard.guardRealProviderAttempt()).toEqual({
      kind: "allow",
      telemetry: {
        budget_fallback: false,
        budget_reason: null,
        budget_scope: "instance",
        budget_current_calls: 1,
        budget_call_limit: 500,
        budget_current_cost_usd: 0,
        budget_cost_limit_usd: 1,
      },
    });
    expect(consumeCall).toHaveBeenCalledTimes(1);

    guard.recordCost(null);
    expect(recordCost).toHaveBeenCalledWith(null);
  });

  it("fails safe when an injected counter denies without a reason", () => {
    const counter: AssistantBudgetCounter = {
      consumeCall: () => ({
        allowed: false,
        reason: null,
        scope: "instance",
        currentCalls: 0,
        callLimit: 500,
        currentCostUsd: 0,
        costLimitUsd: 1,
      }),
      recordCost: () => undefined,
    };

    expect(
      createAssistantProviderGuard(counter).guardRealProviderAttempt(),
    ).toMatchObject({
      kind: "fallback",
      fallback_provider: "mock",
      telemetry: {
        budget_fallback: true,
        budget_reason: "invalid_budget_decision",
      },
    });
  });

  it("prioritizes the kill-switch over exhausted cost and call budgets", () => {
    const policy: AssistantBudgetPolicy = {
      killSwitchEngaged: false,
      dailyCallBudget: 1,
      dailyCostBudgetUsd: 1,
    };
    const guard = createGuard(policy);

    expect(guard.guardRealProviderAttempt().kind).toBe("allow");
    guard.recordCost(1);
    policy.killSwitchEngaged = true;

    expect(guard.guardRealProviderAttempt()).toMatchObject({
      kind: "fallback",
      fallback_provider: "mock",
      telemetry: {
        budget_fallback: true,
        budget_reason: "kill_switch",
        budget_scope: "instance",
        budget_current_calls: 1,
      },
    });
  });

  it("prioritizes exhausted cost over an exhausted call budget", () => {
    const guard = createGuard({
      killSwitchEngaged: false,
      dailyCallBudget: 1,
      dailyCostBudgetUsd: 1,
    });

    expect(guard.guardRealProviderAttempt().kind).toBe("allow");
    guard.recordCost(1);

    expect(guard.guardRealProviderAttempt()).toMatchObject({
      kind: "fallback",
      telemetry: {
        budget_reason: "daily_cost_budget_exceeded",
        budget_current_calls: 1,
        budget_current_cost_usd: 1,
      },
    });
  });

  it("consumes each attempt and falls back when call count is exhausted", () => {
    const guard = createGuard();

    expect(guard.guardRealProviderAttempt().kind).toBe("allow");
    expect(guard.guardRealProviderAttempt().kind).toBe("allow");
    expect(guard.guardRealProviderAttempt()).toMatchObject({
      kind: "fallback",
      fallback_provider: "mock",
      telemetry: {
        budget_fallback: true,
        budget_reason: "daily_call_budget_exceeded",
        budget_scope: "instance",
        budget_current_calls: 2,
        budget_call_limit: 2,
      },
    });
  });

  it("keeps call-count protection active when recorded cost is unknown", () => {
    const guard = createGuard({
      killSwitchEngaged: false,
      dailyCallBudget: 1,
      dailyCostBudgetUsd: 1,
    });

    expect(guard.guardRealProviderAttempt().kind).toBe("allow");
    guard.recordCost(null);
    expect(guard.guardRealProviderAttempt()).toMatchObject({
      kind: "fallback",
      telemetry: {
        budget_reason: "daily_call_budget_exceeded",
        budget_current_cost_usd: 0,
      },
    });
  });
});
