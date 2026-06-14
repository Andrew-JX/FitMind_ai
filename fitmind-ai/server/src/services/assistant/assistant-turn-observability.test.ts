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
    });
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
