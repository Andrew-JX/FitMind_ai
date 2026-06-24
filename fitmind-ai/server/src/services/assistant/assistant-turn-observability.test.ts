import { describe, expect, it, vi } from "vitest";

import {
  buildAssistantTurnLogEvent,
  logAssistantTurnEvent,
} from "./assistant-turn-observability.js";

describe("buildAssistantTurnLogEvent", () => {
  it("summarizes tool counts, durations, and faithfulness", () => {
    const event = buildAssistantTurnLogEvent({
      intent: "weekly_report",
      durationMs: 1234.6,
      toolCalls: [
        { status: "success", duration_ms: 30 },
        { status: "error", duration_ms: 12 },
      ],
      faithfulness: { status: "flagged", unverifiedClaims: ["999"] },
      hasPlan: false,
    });

    expect(event).toEqual({
      event: "assistant_turn",
      intent: "weekly_report",
      duration_ms: 1235,
      tool_call_count: 2,
      tool_error_count: 1,
      total_tool_ms: 42,
      agent_step_count: null,
      faithfulness_status: "flagged",
      unverified_claim_count: 1,
      has_plan: false,
      llm_call_count: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      estimated_cost_usd: 0,
    });
  });

  it("defaults token/cost fields to 0 on the deterministic (no-LLM) path", () => {
    const event = buildAssistantTurnLogEvent({
      intent: "summary",
      durationMs: 10,
      toolCalls: [],
    });

    expect(event.llm_call_count).toBe(0);
    expect(event.total_tokens).toBe(0);
    expect(event.estimated_cost_usd).toBe(0);
  });

  it("reports token usage and a list-price cost estimate", () => {
    const event = buildAssistantTurnLogEvent({
      intent: "weekly_report",
      durationMs: 100,
      toolCalls: [{ status: "success", duration_ms: 5 }],
      tokenUsage: {
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
        totalTokens: 2_000_000,
        llmCallCount: 2,
      },
    });

    expect(event.llm_call_count).toBe(2);
    expect(event.prompt_tokens).toBe(1_000_000);
    expect(event.completion_tokens).toBe(1_000_000);
    expect(event.total_tokens).toBe(2_000_000);
    // 1M prompt * 0.59 + 1M completion * 0.79 = 1.38 USD
    expect(event.estimated_cost_usd).toBeCloseTo(1.38, 6);
  });

  it("marks faithfulness as unchecked when no tool data was verified", () => {
    const event = buildAssistantTurnLogEvent({
      intent: "knowledge",
      durationMs: 50,
      toolCalls: [],
    });

    expect(event.faithfulness_status).toBe("unchecked");
    expect(event.unverified_claim_count).toBe(0);
    expect(event.agent_step_count).toBeNull();
  });

  it("carries agent step count and plan presence for the agent path", () => {
    const event = buildAssistantTurnLogEvent({
      intent: "next_week_plan",
      durationMs: 8000,
      toolCalls: [{ status: "success", duration_ms: 5000 }],
      agentStepCount: 5,
      faithfulness: { status: "verified", unverifiedClaims: [] },
      hasPlan: true,
    });

    expect(event.agent_step_count).toBe(5);
    expect(event.has_plan).toBe(true);
    expect(event.faithfulness_status).toBe("verified");
  });
});

describe("logAssistantTurnEvent", () => {
  it("emits a single structured JSON line", () => {
    const logger = vi.fn();

    logAssistantTurnEvent(
      { intent: "summary", durationMs: 10, toolCalls: [] },
      logger,
    );

    expect(logger).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(logger.mock.calls[0]?.[0] as string);
    expect(payload.event).toBe("assistant_turn");
    expect(payload.intent).toBe("summary");
  });
});
