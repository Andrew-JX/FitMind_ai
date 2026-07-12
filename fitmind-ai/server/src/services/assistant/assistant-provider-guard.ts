import {
  createAssistantBudgetCounter,
  parseAssistantBudgetPolicy,
  type AssistantBudgetCounter,
  type AssistantBudgetDecision,
  type AssistantBudgetReason,
} from "./assistant-budget-policy.js";

interface AssistantProviderBudgetCounters {
  budget_scope: "instance";
  budget_current_calls: number;
  budget_call_limit: number;
  budget_current_cost_usd: number;
  budget_cost_limit_usd: number;
}

export interface AssistantProviderBudgetAllowTelemetry extends AssistantProviderBudgetCounters {
  budget_fallback: false;
  budget_reason: null;
}

export interface AssistantProviderBudgetFallbackTelemetry extends AssistantProviderBudgetCounters {
  budget_fallback: true;
  budget_reason: AssistantBudgetReason | "invalid_budget_decision";
}

export type AssistantProviderGuardDecision =
  | {
      kind: "allow";
      telemetry: AssistantProviderBudgetAllowTelemetry;
    }
  | {
      kind: "fallback";
      fallback_provider: "mock";
      telemetry: AssistantProviderBudgetFallbackTelemetry;
    };

export interface AssistantProviderGuard {
  /** Consumes exactly one real-provider attempt and returns its guard decision. */
  guardRealProviderAttempt(): AssistantProviderGuardDecision;
  /** Records known post-call cost; null keeps the cost counter unchanged. */
  recordCost(estimatedCostUsd: number | null): void;
}

/**
 * Creates a provider guard around an injectable per-instance budget counter.
 *
 * @param budgetCounter - Counter shared by every real-provider attempt in scope.
 * @returns A transport-agnostic allow/fallback guard.
 */
export function createAssistantProviderGuard(
  budgetCounter: AssistantBudgetCounter,
): AssistantProviderGuard {
  return {
    guardRealProviderAttempt(): AssistantProviderGuardDecision {
      return mapBudgetDecision(budgetCounter.consumeCall());
    },

    recordCost(estimatedCostUsd: number | null): void {
      budgetCounter.recordCost(estimatedCostUsd);
    },
  };
}

const defaultAssistantProviderGuard = createAssistantProviderGuard(
  createAssistantBudgetCounter({
    policy: parseAssistantBudgetPolicy(process.env),
  }),
);

/**
 * Returns the process-level provider guard shared by all future call sites.
 *
 * The environment policy and counter are created once when this module loads.
 * Runtime env changes therefore require a process restart (a Vercel redeploy),
 * while the counter must remain shared for the lifetime of the warm instance.
 *
 * @returns The process-level singleton provider guard.
 */
export function getDefaultAssistantProviderGuard(): AssistantProviderGuard {
  return defaultAssistantProviderGuard;
}

function mapBudgetDecision(
  decision: AssistantBudgetDecision,
): AssistantProviderGuardDecision {
  const counters: AssistantProviderBudgetCounters = {
    budget_scope: decision.scope,
    budget_current_calls: decision.currentCalls,
    budget_call_limit: decision.callLimit,
    budget_current_cost_usd: decision.currentCostUsd,
    budget_cost_limit_usd: decision.costLimitUsd,
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

  return {
    kind: "fallback",
    fallback_provider: "mock",
    telemetry: {
      budget_fallback: true,
      budget_reason: decision.reason ?? "invalid_budget_decision",
      ...counters,
    },
  };
}
