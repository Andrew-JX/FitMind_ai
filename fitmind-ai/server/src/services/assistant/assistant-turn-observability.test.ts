import { describe, expect, it, vi } from "vitest";

import {
  buildAssistantTurnLogEvent,
  logAssistantTurnEvent,
  logFailedAssistantTurnEvent,
  summarizeTurnLlmCalls,
} from "./assistant-turn-observability.js";

describe("buildAssistantTurnLogEvent", () => {
  it("summarizes tool counts, faithfulness, and zeroes LLM/cost on the deterministic path", () => {
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
      status: "ok",
      intent: "weekly_report",
      duration_ms: 1235,
      tool_call_count: 2,
      tool_error_count: 1,
      total_tool_ms: 42,
      agent_step_count: null,
      faithfulness_status: "flagged",
      unverified_claim_count: 1,
      has_plan: false,
      safety_boundary: "none",
      safety_reason: null,
      llm_attempt_count: 0,
      llm_usage_report_count: 0,
      llm_error_count: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      provider: null,
      model: null,
      estimated_cost_usd: 0,
    });
  });

  it("marks faithfulness unchecked when no tool data was verified", () => {
    const event = buildAssistantTurnLogEvent({
      intent: "knowledge",
      durationMs: 50,
      toolCalls: [],
    });

    expect(event.faithfulness_status).toBe("unchecked");
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
  });

  it("logs safety boundary fields with zeroed LLM counters on safety turns", () => {
    const event = buildAssistantTurnLogEvent({
      intent: "unsupported",
      durationMs: 25,
      toolCalls: [],
      safety: {
        boundary: "medical_boundary",
        reason: "ambiguous_pain_or_symptom",
      },
    });

    expect(event.safety_boundary).toBe("medical_boundary");
    expect(event.safety_reason).toBe("ambiguous_pain_or_symptom");
    expect(event.llm_attempt_count).toBe(0);
    expect(event.llm_usage_report_count).toBe(0);
    expect(event.llm_error_count).toBe(0);
  });

  it("reports the distinct LLM counts and a list-price cost for a known model", () => {
    const event = buildAssistantTurnLogEvent({
      intent: "recommendation",
      durationMs: 100,
      toolCalls: [{ status: "success", duration_ms: 5 }],
      llm: {
        attemptCount: 3,
        usageReportCount: 2,
        errorCount: 1,
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
        totalTokens: 2_000_000,
        provider: "groq",
        model: "llama-3.3-70b-versatile",
      },
    });

    expect(event.llm_attempt_count).toBe(3);
    expect(event.llm_usage_report_count).toBe(2);
    expect(event.llm_error_count).toBe(1);
    expect(event.provider).toBe("groq");
    expect(event.model).toBe("llama-3.3-70b-versatile");
    // 1M prompt * 0.59 + 1M completion * 0.79 = 1.38 USD
    expect(event.estimated_cost_usd).toBeCloseTo(1.38, 6);
  });

  it("prices an unknown model to null (never a wrong number)", () => {
    const event = buildAssistantTurnLogEvent({
      intent: "recommendation",
      durationMs: 100,
      toolCalls: [],
      llm: {
        attemptCount: 1,
        usageReportCount: 1,
        errorCount: 0,
        promptTokens: 500,
        completionTokens: 100,
        totalTokens: 600,
        provider: "groq",
        model: "some-future-model",
      },
    });

    expect(event.model).toBe("some-future-model");
    expect(event.total_tokens).toBe(600);
    expect(event.estimated_cost_usd).toBeNull();
  });
});

describe("summarizeTurnLlmCalls", () => {
  it("counts attempts, usage reports, errors, sums tokens, and takes provider/model from records", () => {
    const summary = summarizeTurnLlmCalls([
      {
        attempted: true,
        errored: false,
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
      { attempted: true, errored: true, provider: "groq", model: null },
      { attempted: false, errored: false, provider: null, model: null },
    ]);

    expect(summary).toEqual({
      attemptCount: 2,
      usageReportCount: 1,
      errorCount: 1,
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      provider: "groq",
      model: "llama-3.3-70b-versatile",
    });
  });

  it("returns undefined when no call was attempted", () => {
    const summary = summarizeTurnLlmCalls([
      { attempted: false, errored: false, provider: null, model: null },
    ]);

    expect(summary).toBeUndefined();
  });
});

describe("logAssistantTurnEvent", () => {
  it("emits a single structured JSON line with status ok", () => {
    const logger = vi.fn();

    logAssistantTurnEvent(
      { intent: "summary", durationMs: 10, toolCalls: [] },
      logger,
    );

    expect(logger).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(logger.mock.calls[0]?.[0] as string);
    expect(payload.event).toBe("assistant_turn");
    expect(payload.status).toBe("ok");
  });
});

describe("logFailedAssistantTurnEvent", () => {
  it("emits an error line with zeroed LLM fields when no call was made", () => {
    const logger = vi.fn();

    logFailedAssistantTurnEvent(
      { durationMs: 42.7, errorCode: "AI_PROVIDER_ERROR" },
      logger,
    );

    const payload = JSON.parse(logger.mock.calls[0]?.[0] as string);
    expect(payload).toMatchObject({
      event: "assistant_turn",
      status: "error",
      error_code: "AI_PROVIDER_ERROR",
      duration_ms: 43,
      llm_attempt_count: 0,
      llm_error_count: 0,
      total_tokens: 0,
      estimated_cost_usd: 0,
    });
  });

  it("carries the LLM summary so a failed Groq call is still counted (P1)", () => {
    const logger = vi.fn();

    logFailedAssistantTurnEvent(
      {
        durationMs: 10,
        errorCode: "AI_PROVIDER_ERROR",
        llm: {
          attemptCount: 1,
          usageReportCount: 0,
          errorCount: 1,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          provider: "groq",
          model: "llama-3.3-70b-versatile",
        },
      },
      logger,
    );

    const payload = JSON.parse(logger.mock.calls[0]?.[0] as string);
    expect(payload).toMatchObject({
      status: "error",
      llm_attempt_count: 1,
      llm_error_count: 1,
      provider: "groq",
      model: "llama-3.3-70b-versatile",
    });
  });
});
