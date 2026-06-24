import type { AssistantRoutedIntent } from "./assistant-intent-router.js";

/** Faithfulness outcome bucket for telemetry (`unchecked` = no tool data this turn). */
type FaithfulnessStatus = "verified" | "flagged" | "unchecked";

/**
 * Aggregated LLM token usage for one turn (sum across all provider calls, e.g.
 * the routing/tool-selection call plus the optional 11.3b phrasing call).
 */
export interface AssistantTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Number of billed LLM calls this turn (0 for the deterministic mock path). */
  llmCallCount: number;
}

/**
 * Estimated USD list price per 1M tokens (Groq llama-3.3-70b reference rate).
 * The actual Groq free tier bills $0; this is a cost *estimate* for visibility,
 * not a billing figure. Update if the default GROQ_MODEL changes.
 */
const USD_PER_1M_PROMPT_TOKENS = 0.59;
const USD_PER_1M_COMPLETION_TOKENS = 0.79;

export interface AssistantTurnLogInput {
  intent: AssistantRoutedIntent;
  durationMs: number;
  toolCalls: ReadonlyArray<{ status: "success" | "error"; duration_ms: number }>;
  agentStepCount?: number | null | undefined;
  faithfulness?:
    | { status: "verified" | "flagged"; unverifiedClaims: string[] }
    | null
    | undefined;
  hasPlan?: boolean | undefined;
  tokenUsage?: AssistantTokenUsage | null | undefined;
}

export interface AssistantTurnLogEvent {
  event: "assistant_turn";
  intent: AssistantRoutedIntent;
  duration_ms: number;
  tool_call_count: number;
  tool_error_count: number;
  total_tool_ms: number;
  agent_step_count: number | null;
  faithfulness_status: FaithfulnessStatus;
  unverified_claim_count: number;
  has_plan: boolean;
  llm_call_count: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  /** List-price cost estimate (USD); see rate constants. Groq free tier actual = 0. */
  estimated_cost_usd: number;
}

/**
 * Builds the structured per-turn telemetry event (latency, tool counts/durations,
 * faithfulness status, plan presence) for one assistant turn.
 *
 * Pure + deterministic; token cost is intentionally omitted until a real
 * (billed) provider is wired in (roadmap Slice 7).
 *
 * @param input - Routed intent, measured latency, tool calls, and optional agent/faithfulness/plan signals
 * @returns The structured telemetry event
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

  const usage = input.tokenUsage ?? null;
  const promptTokens = Math.max(0, usage?.promptTokens ?? 0);
  const completionTokens = Math.max(0, usage?.completionTokens ?? 0);

  return {
    event: "assistant_turn",
    intent: input.intent,
    duration_ms: Math.max(0, Math.round(input.durationMs)),
    tool_call_count: input.toolCalls.length,
    tool_error_count: toolErrorCount,
    total_tool_ms: totalToolMs,
    agent_step_count: input.agentStepCount ?? null,
    faithfulness_status: resolveFaithfulnessStatus(input.faithfulness),
    unverified_claim_count: input.faithfulness?.unverifiedClaims.length ?? 0,
    has_plan: input.hasPlan ?? false,
    llm_call_count: Math.max(0, usage?.llmCallCount ?? 0),
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: Math.max(0, usage?.totalTokens ?? 0),
    estimated_cost_usd: estimateCostUsd(promptTokens, completionTokens),
  };
}

/**
 * Estimate the list-price USD cost of one turn from its token counts.
 *
 * @param promptTokens - Prompt (input) tokens summed across the turn's LLM calls.
 * @param completionTokens - Completion (output) tokens summed across the turn's LLM calls.
 * @returns Estimated cost in USD, rounded to 6 decimals (0 when no tokens).
 */
function estimateCostUsd(promptTokens: number, completionTokens: number): number {
  const cost =
    (promptTokens / 1_000_000) * USD_PER_1M_PROMPT_TOKENS +
    (completionTokens / 1_000_000) * USD_PER_1M_COMPLETION_TOKENS;

  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Logs the per-turn telemetry event as a single structured JSON line.
 *
 * @param input - Telemetry input for the turn
 * @param logger - Injectable sink (defaults to console.info), for tests
 */
export function logAssistantTurnEvent(
  input: AssistantTurnLogInput,
  logger: (message: string) => void = console.info,
): void {
  logger(JSON.stringify(buildAssistantTurnLogEvent(input)));
}

function resolveFaithfulnessStatus(
  faithfulness: AssistantTurnLogInput["faithfulness"],
): FaithfulnessStatus {
  if (faithfulness === null || faithfulness === undefined) {
    return "unchecked";
  }

  return faithfulness.status;
}
