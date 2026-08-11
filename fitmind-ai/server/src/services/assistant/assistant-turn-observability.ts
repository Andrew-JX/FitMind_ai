import type { AssistantRoutedIntent } from "./assistant-intent-router.js";
import type {
  AssistantSafetyBoundary,
  AssistantSafetyReason,
} from "./assistant-safety.js";
import type { AssistantProviderCallTelemetry } from "./provider-types.js";
import type { ProviderErrorFallbackTelemetry } from "./assistant-provider-fallback.js";
import type { AssistantProviderBudgetFallbackTelemetry } from "./assistant-provider-guard.js";
import type { AssistantIpBudgetFallbackTelemetry } from "../../middleware/assistant-ip-rate-limit-middleware.js";

type AssistantBudgetFallbackTelemetry =
  | AssistantProviderBudgetFallbackTelemetry
  | AssistantIpBudgetFallbackTelemetry;

export interface ToolArgumentFallbackTelemetry {
  tool_argument_fallback: true;
  fallback_reason: "missing_required_request_args" | "tool_validation_error";
  tool_name: string;
  argument_fields: string[];
  validation_error_code: "VALIDATION_ERROR" | null;
}

/** Faithfulness outcome bucket for telemetry (`unchecked` = no tool data this turn). */
type FaithfulnessStatus = "verified" | "flagged" | "unchecked";

/**
 * One LLM (provider) call's telemetry outcome within a turn. Same shape the
 * provider/router/phrasing calls emit, so provider/model/usage flow straight from
 * the actual client result (no downstream env re-read).
 */
export type AssistantLlmCallRecord = AssistantProviderCallTelemetry;

/**
 * Per-turn aggregate across all LLM calls (rescue router + tool-selection +
 * phrasing). Counts are kept distinct because they answer different questions:
 * how many calls we made, how many reported usage, and how many failed.
 */
export interface AssistantTurnLlmSummary {
  attemptCount: number;
  usageReportCount: number;
  errorCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  provider: AssistantProviderCallTelemetry["provider"];
  /** Model that actually served the calls (from the client), for cost pricing. */
  model: string | null;
}

/**
 * List-price USD per 1M tokens, keyed by model. Estimates for visibility only —
 * the Groq free tier bills $0. Unknown BYO models price to `null` (never a
 * wrong number). Add an entry only when a model's list price is known.
 */
const MODEL_PRICING_USD_PER_1M: Record<
  string,
  { prompt: number; completion: number }
> = {
  "llama-3.3-70b-versatile": { prompt: 0.59, completion: 0.79 },
  // DeepSeek official price verified 2026-08-11:
  // https://api-docs.deepseek.com/quick_start/pricing
  // Usage currently lacks cache-hit token detail, so prompt tokens use the
  // cache-miss rate as a conservative upper bound ($0.14/M, output $0.28/M).
  "deepseek-v4-flash": { prompt: 0.14, completion: 0.28 },
};

export interface AssistantTurnLogInput {
  intent: AssistantRoutedIntent;
  durationMs: number;
  toolCalls: ReadonlyArray<{
    status: "success" | "error";
    duration_ms: number;
  }>;
  agentStepCount?: number | null | undefined;
  faithfulness?:
    | { status: "verified" | "flagged"; unverifiedClaims: string[] }
    | null
    | undefined;
  hasPlan?: boolean | undefined;
  llm?: AssistantTurnLlmSummary | null | undefined;
  providerErrorFallback?: ProviderErrorFallbackTelemetry | null | undefined;
  budgetFallback?: AssistantBudgetFallbackTelemetry | null | undefined;
  toolArgumentFallback?: ToolArgumentFallbackTelemetry | null | undefined;
  safety?:
    | { boundary: "medical_boundary"; reason: AssistantSafetyReason }
    | null
    | undefined;
}

/** LLM call/token/cost fields shared by the ok and error turn-log events. */
interface LlmEventFields {
  llm_attempt_count: number;
  llm_usage_report_count: number;
  llm_error_count: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  provider: AssistantProviderCallTelemetry["provider"];
  /** List-price cost estimate (USD); `null` for unknown/unpriced models. */
  model: string | null;
  estimated_cost_usd: number | null;
}

interface ProviderErrorFallbackEventFields {
  provider_error_fallback: boolean;
  provider_error_code: string | null;
  provider_error_message_sanitized: string | null;
  fallback_provider: "mock" | null;
  fallback_reason: "provider_error" | null;
}

interface BudgetFallbackEventFields {
  budget_fallback: boolean;
  budget_reason: AssistantBudgetFallbackTelemetry["budget_reason"] | null;
  budget_scope: AssistantBudgetFallbackTelemetry["budget_scope"] | null;
  budget_current_calls: number | null;
  budget_call_limit: number | null;
  budget_current_cost_usd: number | null;
  budget_cost_limit_usd: number | null;
  budget_ip_minute_count: number | null;
  budget_ip_minute_limit: number | null;
  budget_ip_day_count: number | null;
  budget_ip_day_limit: number | null;
  budget_retry_after_seconds: number | null;
}

interface ToolArgumentFallbackEventFields {
  tool_argument_fallback: boolean;
  tool_argument_fallback_reason:
    | ToolArgumentFallbackTelemetry["fallback_reason"]
    | null;
  tool_argument_fallback_tool: string | null;
  tool_argument_fields: string[];
  tool_argument_validation_error_code: "VALIDATION_ERROR" | null;
}

export interface AssistantTurnLogEvent
  extends
    LlmEventFields,
    ProviderErrorFallbackEventFields,
    BudgetFallbackEventFields,
    ToolArgumentFallbackEventFields {
  event: "assistant_turn";
  status: "ok";
  intent: AssistantRoutedIntent;
  duration_ms: number;
  tool_call_count: number;
  tool_error_count: number;
  total_tool_ms: number;
  agent_step_count: number | null;
  faithfulness_status: FaithfulnessStatus;
  unverified_claim_count: number;
  has_plan: boolean;
  safety_boundary: AssistantSafetyBoundary;
  safety_reason: AssistantSafetyReason | null;
}

/** A single structured line for a turn that failed before producing a result. */
export interface FailedAssistantTurnLogEvent extends LlmEventFields {
  event: "assistant_turn";
  status: "error";
  error_code: string;
  duration_ms: number;
}

/**
 * Aggregate per-call LLM telemetry into one turn summary. provider/model come
 * from the records themselves (the actual client results), not a re-read of env.
 *
 * @param records - One entry per LLM call site reached this turn.
 * @returns The summary, or `undefined` when no call was attempted (deterministic path).
 */
export function summarizeTurnLlmCalls(
  records: ReadonlyArray<AssistantLlmCallRecord>,
): AssistantTurnLlmSummary | undefined {
  const attempts = records.filter((record) => record.attempted);

  if (attempts.length === 0) {
    return undefined;
  }

  // provider/model come from the attempts themselves (the actual client results);
  // prefer the first that reports a model for pricing.
  const priced =
    attempts.find((record) => record.model !== null) ?? attempts[0];

  let usageReportCount = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  for (const record of attempts) {
    if (record.usage !== undefined) {
      usageReportCount += 1;
      promptTokens += record.usage.prompt_tokens;
      completionTokens += record.usage.completion_tokens;
      totalTokens += record.usage.total_tokens;
    }
  }

  return {
    attemptCount: attempts.length,
    usageReportCount,
    errorCount: attempts.filter((record) => record.errored).length,
    promptTokens,
    completionTokens,
    totalTokens,
    provider: priced?.provider ?? null,
    model: priced?.model ?? null,
  };
}

/**
 * Builds the structured per-turn telemetry event (latency, tool counts/durations,
 * faithfulness status, plan presence, LLM call/token/cost telemetry).
 *
 * Pure + deterministic.
 *
 * @param input - Routed intent, latency, tool calls, and optional agent/faithfulness/plan/LLM signals.
 * @returns The structured telemetry event.
 */
export function buildAssistantTurnLogEvent(
  input: AssistantTurnLogInput,
): AssistantTurnLogEvent {
  const toolErrorCount = input.toolCalls.filter(
    (call) => call.status === "error",
  ).length;
  const totalToolMs = input.toolCalls.reduce(
    (total, call) => total + Math.max(0, call.duration_ms),
    0,
  );

  return {
    event: "assistant_turn",
    status: "ok",
    intent: input.intent,
    duration_ms: Math.max(0, Math.round(input.durationMs)),
    tool_call_count: input.toolCalls.length,
    tool_error_count: toolErrorCount,
    total_tool_ms: totalToolMs,
    agent_step_count: input.agentStepCount ?? null,
    faithfulness_status: resolveFaithfulnessStatus(input.faithfulness),
    unverified_claim_count: input.faithfulness?.unverifiedClaims.length ?? 0,
    has_plan: input.hasPlan ?? false,
    safety_boundary: input.safety?.boundary ?? "none",
    safety_reason: input.safety?.reason ?? null,
    ...buildProviderErrorFallbackEventFields(
      input.providerErrorFallback ?? null,
    ),
    ...buildBudgetFallbackEventFields(input.budgetFallback ?? null),
    ...buildToolArgumentFallbackEventFields(input.toolArgumentFallback ?? null),
    ...buildLlmEventFields(input.llm ?? null),
  };
}

function buildToolArgumentFallbackEventFields(
  fallback: ToolArgumentFallbackTelemetry | null,
): ToolArgumentFallbackEventFields {
  return {
    tool_argument_fallback: fallback?.tool_argument_fallback ?? false,
    tool_argument_fallback_reason: fallback?.fallback_reason ?? null,
    tool_argument_fallback_tool: fallback?.tool_name ?? null,
    tool_argument_fields: fallback?.argument_fields ?? [],
    tool_argument_validation_error_code:
      fallback?.validation_error_code ?? null,
  };
}

function buildBudgetFallbackEventFields(
  fallback: AssistantBudgetFallbackTelemetry | null,
): BudgetFallbackEventFields {
  const instance = fallback?.budget_scope === "instance" ? fallback : null;
  const ip = fallback?.budget_scope === "ip" ? fallback : null;

  return {
    budget_fallback: fallback?.budget_fallback ?? false,
    budget_reason: fallback?.budget_reason ?? null,
    budget_scope: fallback?.budget_scope ?? null,
    budget_current_calls: instance?.budget_current_calls ?? null,
    budget_call_limit: instance?.budget_call_limit ?? null,
    budget_current_cost_usd: instance?.budget_current_cost_usd ?? null,
    budget_cost_limit_usd: instance?.budget_cost_limit_usd ?? null,
    budget_ip_minute_count: ip?.budget_ip_minute_count ?? null,
    budget_ip_minute_limit: ip?.budget_ip_minute_limit ?? null,
    budget_ip_day_count: ip?.budget_ip_day_count ?? null,
    budget_ip_day_limit: ip?.budget_ip_day_limit ?? null,
    budget_retry_after_seconds: ip?.budget_retry_after_seconds ?? null,
  };
}

function buildProviderErrorFallbackEventFields(
  fallback: ProviderErrorFallbackTelemetry | null,
): ProviderErrorFallbackEventFields {
  return {
    provider_error_fallback: fallback?.provider_error_fallback ?? false,
    provider_error_code: fallback?.provider_error_code ?? null,
    provider_error_message_sanitized:
      fallback?.provider_error_message_sanitized ?? null,
    fallback_provider: fallback?.fallback_provider ?? null,
    fallback_reason: fallback?.fallback_reason ?? null,
  };
}

/**
 * Map an LLM turn summary into the flat log fields (counts, tokens, provider,
 * model, cost). Shared by the ok and error events so both stay in sync.
 *
 * @param llm - The turn's aggregated LLM summary, or null/undefined.
 * @returns The flat LLM event fields.
 */
function buildLlmEventFields(
  llm: AssistantTurnLlmSummary | null,
): LlmEventFields {
  const promptTokens = Math.max(0, llm?.promptTokens ?? 0);
  const completionTokens = Math.max(0, llm?.completionTokens ?? 0);

  return {
    llm_attempt_count: Math.max(0, llm?.attemptCount ?? 0),
    llm_usage_report_count: Math.max(0, llm?.usageReportCount ?? 0),
    llm_error_count: Math.max(0, llm?.errorCount ?? 0),
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: Math.max(0, llm?.totalTokens ?? 0),
    provider: llm?.provider ?? null,
    model: llm?.model ?? null,
    estimated_cost_usd: estimateCostUsd(
      llm?.model ?? null,
      promptTokens,
      completionTokens,
    ),
  };
}

/**
 * Estimate the list-price USD cost of one turn.
 *
 * @param model - Model that served the calls (or null).
 * @param promptTokens - Prompt tokens summed across the turn.
 * @param completionTokens - Completion tokens summed across the turn.
 * @returns Estimated USD (6 decimals), or `null` for an unknown/unpriced model.
 */
function estimateCostUsd(
  model: string | null,
  promptTokens: number,
  completionTokens: number,
): number | null {
  if (model === null) {
    return promptTokens === 0 && completionTokens === 0 ? 0 : null;
  }

  const pricing = MODEL_PRICING_USD_PER_1M[model];
  if (pricing === undefined) {
    return null;
  }

  const cost =
    (promptTokens / 1_000_000) * pricing.prompt +
    (completionTokens / 1_000_000) * pricing.completion;

  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Estimate one completed provider call's list-price cost for budget accounting.
 * Unknown models and calls without reported usage remain unpriced; the separate
 * call-count budget still applies to them.
 *
 * @param call - Telemetry returned by the provider call site.
 * @returns Estimated USD, or `null` when this call cannot be priced.
 */
export function estimateAssistantProviderCallCostUsd(
  call: AssistantProviderCallTelemetry,
): number | null {
  if (!call.attempted || call.usage === undefined) {
    return null;
  }

  return estimateCostUsd(
    call.model,
    Math.max(0, call.usage.prompt_tokens),
    Math.max(0, call.usage.completion_tokens),
  );
}

/**
 * Logs the per-turn telemetry event as a single structured JSON line.
 *
 * @param input - Telemetry input for the turn.
 * @param logger - Injectable sink (defaults to console.info), for tests.
 */
export function logAssistantTurnEvent(
  input: AssistantTurnLogInput,
  logger: (message: string) => void = console.info,
): void {
  logger(JSON.stringify(buildAssistantTurnLogEvent(input)));
}

/**
 * Logs a structured line for a turn that failed before producing a result, so
 * failed turns are still observable — including any LLM calls already made (e.g.
 * a Groq 429/500 on the routing call still reports attempt/error/model/usage).
 *
 * @param input - Measured latency, the error code, and any LLM summary gathered before the failure.
 * @param logger - Injectable sink (defaults to console.info), for tests.
 */
export function logFailedAssistantTurnEvent(
  input: {
    durationMs: number;
    errorCode: string;
    llm?: AssistantTurnLlmSummary | null | undefined;
  },
  logger: (message: string) => void = console.info,
): void {
  const event: FailedAssistantTurnLogEvent = {
    event: "assistant_turn",
    status: "error",
    error_code: input.errorCode,
    duration_ms: Math.max(0, Math.round(input.durationMs)),
    ...buildLlmEventFields(input.llm ?? null),
  };

  logger(JSON.stringify(event));
}

function resolveFaithfulnessStatus(
  faithfulness: AssistantTurnLogInput["faithfulness"],
): FaithfulnessStatus {
  if (faithfulness === null || faithfulness === undefined) {
    return "unchecked";
  }

  return faithfulness.status;
}
