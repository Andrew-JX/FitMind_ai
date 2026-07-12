import { describe, expect, it } from "vitest";

import {
  createAssistantBudgetCounter,
  parseAssistantBudgetPolicy,
} from "./assistant-budget-policy.js";

describe("parseAssistantBudgetPolicy", () => {
  it("keeps an unset kill-switch live while applying budget defaults", () => {
    expect(parseAssistantBudgetPolicy({})).toEqual({
      killSwitchEngaged: false,
      dailyCallBudget: 500,
      dailyCostBudgetUsd: 1,
    });
  });

  it.each(["1", "true", "ON", "yes"])(
    "engages the kill-switch for %s",
    (value) => {
      expect(
        parseAssistantBudgetPolicy({
          ASSISTANT_REAL_PROVIDER_KILL_SWITCH: value,
        }).killSwitchEngaged,
      ).toBe(true);
    },
  );

  it.each(["0", "false", "OFF", "no"])(
    "keeps live eligibility for explicit false token %s",
    (value) => {
      expect(
        parseAssistantBudgetPolicy({
          ASSISTANT_REAL_PROVIDER_KILL_SWITCH: value,
        }).killSwitchEngaged,
      ).toBe(false);
    },
  );

  it.each(["", "maybe", "tru", "2"])(
    "fails a malformed kill-switch value %j closed",
    (value) => {
      expect(
        parseAssistantBudgetPolicy({
          ASSISTANT_REAL_PROVIDER_KILL_SWITCH: value,
        }).killSwitchEngaged,
      ).toBe(true);
    },
  );

  it("uses conservative defaults for malformed budget values", () => {
    expect(
      parseAssistantBudgetPolicy({
        ASSISTANT_REAL_PROVIDER_DAILY_CALL_BUDGET: "unlimited",
        ASSISTANT_REAL_PROVIDER_DAILY_COST_BUDGET_USD: "-1",
      }),
    ).toEqual({
      killSwitchEngaged: false,
      dailyCallBudget: 500,
      dailyCostBudgetUsd: 1,
    });
  });
});

describe("createAssistantBudgetCounter", () => {
  it("blocks before consuming when the kill-switch is engaged", () => {
    const counter = createAssistantBudgetCounter({
      policy: {
        killSwitchEngaged: true,
        dailyCallBudget: 500,
        dailyCostBudgetUsd: 1,
      },
      now: () => 0,
    });

    expect(counter.consumeCall()).toMatchObject({
      allowed: false,
      reason: "kill_switch",
      currentCalls: 0,
    });
  });

  it("enforces the daily call-count floor", () => {
    const counter = createAssistantBudgetCounter({
      policy: {
        killSwitchEngaged: false,
        dailyCallBudget: 2,
        dailyCostBudgetUsd: 1,
      },
      now: () => 0,
    });

    expect(counter.consumeCall().allowed).toBe(true);
    expect(counter.consumeCall().allowed).toBe(true);
    expect(counter.consumeCall()).toMatchObject({
      allowed: false,
      reason: "daily_call_budget_exceeded",
      currentCalls: 2,
      callLimit: 2,
    });
  });

  it("enforces known cost while null cost leaves the counter unchanged", () => {
    const counter = createAssistantBudgetCounter({
      policy: {
        killSwitchEngaged: false,
        dailyCallBudget: 3,
        dailyCostBudgetUsd: 1,
      },
      now: () => 0,
    });

    expect(counter.consumeCall().allowed).toBe(true);
    counter.recordCost(null);
    expect(counter.consumeCall()).toMatchObject({
      allowed: true,
      currentCalls: 2,
      currentCostUsd: 0,
    });

    counter.recordCost(1);
    expect(counter.consumeCall()).toMatchObject({
      allowed: false,
      reason: "daily_cost_budget_exceeded",
      currentCalls: 2,
      currentCostUsd: 1,
    });
  });

  it("keeps the call-count floor active when every cost is unknown", () => {
    const counter = createAssistantBudgetCounter({
      policy: {
        killSwitchEngaged: false,
        dailyCallBudget: 2,
        dailyCostBudgetUsd: 1,
      },
      now: () => 0,
    });

    expect(counter.consumeCall().allowed).toBe(true);
    counter.recordCost(null);
    expect(counter.consumeCall().allowed).toBe(true);
    counter.recordCost(null);
    expect(counter.consumeCall()).toMatchObject({
      allowed: false,
      reason: "daily_call_budget_exceeded",
      currentCalls: 2,
      currentCostUsd: 0,
    });
  });

  it("resets call and cost counters at UTC midnight", () => {
    let now = Date.UTC(2026, 6, 11, 23, 59, 59);
    const counter = createAssistantBudgetCounter({
      policy: {
        killSwitchEngaged: false,
        dailyCallBudget: 1,
        dailyCostBudgetUsd: 1,
      },
      now: () => now,
    });

    expect(counter.consumeCall().allowed).toBe(true);
    counter.recordCost(1);
    expect(counter.consumeCall().allowed).toBe(false);

    now = Date.UTC(2026, 6, 12, 0, 0, 0);
    expect(counter.consumeCall()).toMatchObject({
      allowed: true,
      currentCalls: 1,
      currentCostUsd: 0,
    });
  });
});
