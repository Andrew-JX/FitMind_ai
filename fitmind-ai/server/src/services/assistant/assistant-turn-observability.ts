import type { AssistantRoutedIntent } from "./assistant-intent-router.js";

/** Faithfulness outcome bucket for telemetry (`unchecked` = no tool data this turn). */
type FaithfulnessStatus = "verified" | "flagged" | "unchecked";

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
  };
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
