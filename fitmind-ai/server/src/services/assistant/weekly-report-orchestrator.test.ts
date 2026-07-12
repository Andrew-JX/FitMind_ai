import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Canned weekly-report tool result, shared between the executeAiTool mock and the
// assertions. Hoisted so the (hoisted) vi.mock factory below can reference it.
const { CANNED_REPORT } = vi.hoisted(() => ({
  CANNED_REPORT: {
    range: { start_date: "2026-05-19", end_date: "2026-06-17" },
    status: "ready" as const,
    totals: {
      workout_count: 4,
      set_count: 20,
      total_reps: 200,
      total_volume: 5000,
      total_weighted_volume: 5000,
    },
    frequency: { range_days: 30, workouts_per_week: 1 },
    top_exercises: [
      { exercise_name: "卧推", set_count: 8, total_volume: 2000 },
    ],
    top_muscle_groups: [{ muscle_group_name: "胸", contribution_ratio: 0.4 }],
    low_volume_muscle_groups: [
      { muscle_group_name: "小腿", contribution_ratio: 0.1 },
    ],
    selected_exercise_progress: null,
    recovery_notes: [],
    limitations: [],
    evidence: {
      workout_ids: ["11111111-1111-1111-1111-111111111111"],
      set_ids: ["22222222-2222-2222-2222-222222222222"],
      calculation_rules: ["weekly_report_aggregation"],
    },
  },
}));

// Provider returns prose (no tool call) → exercises the Slice 11.2a/11.3a safety net.
vi.mock("./provider-adapter.js", () => ({
  runAssistantProvider: vi.fn(async () => ({
    kind: "message",
    message: "这是你的周报概述……",
  })),
  runAssistantAnswerPhrasing: vi.fn(
    async (input: { draftSummary: string }) => ({
      summary: input.draftSummary,
      call: { attempted: false, errored: false, provider: null, model: null },
    }),
  ),
}));

// mock provider keeps the deterministic keyword router (no Groq), so "周报" routes
// via the keyword fast path without any LLM call. Phrasing stays off.
vi.mock("./provider-config.js", () => ({
  getConfiguredAssistantProvider: vi.fn(() => "mock"),
  getGroqAssistantProviderConfig: vi.fn(() => ({
    apiKey: "test-key",
    model: "llama-3.3-70b-versatile",
  })),
  isAssistantAnswerPhrasingEnabled: vi.fn(() => false),
}));

// Stub the real tool executor: assert it is reached and feed a deterministic result.
vi.mock("../ai/tools/tool-executor.js", () => ({
  executeAiTool: vi.fn(async () => CANNED_REPORT),
}));

// Stub the chat persistence layer so the turn runs with no database.
vi.mock("../../db/chat-repository.js", () => ({
  createChatSession: vi.fn(async () => ({ id: "session-1" })),
  createChatMessage: vi.fn(async () => ({ id: "message-1" })),
  findChatSessionByIdForUser: vi.fn(async () => null),
  hasChatSessionById: vi.fn(async () => false),
}));

vi.mock("../athlete-profile-service.js", () => ({
  getAthleteProfile: vi.fn(async () => null),
}));

vi.mock("../planned-workout-service.js", () => ({
  getPlanAdherenceContextForPlanner: vi.fn(async () => null),
}));

import { runMockAssistantTurn } from "./assistant-orchestrator-service.js";
import { executeAiTool } from "../ai/tools/tool-executor.js";
import { getPlanAdherenceContextForPlanner } from "../planned-workout-service.js";
import {
  runAssistantAnswerPhrasing,
  runAssistantProvider,
} from "./provider-adapter.js";
import {
  getConfiguredAssistantProvider,
  isAssistantAnswerPhrasingEnabled,
} from "./provider-config.js";
import type {
  AssistantProviderGuard,
  AssistantProviderGuardDecision,
} from "./assistant-provider-guard.js";
import type { AssistantIpGuardDecision } from "../../middleware/assistant-ip-rate-limit-middleware.js";

const mockedExecuteAiTool = vi.mocked(executeAiTool);
const mockedGetPlanAdherenceContext = vi.mocked(
  getPlanAdherenceContextForPlanner,
);
const mockedRunAssistantProvider = vi.mocked(runAssistantProvider);
const mockedRunAssistantAnswerPhrasing = vi.mocked(runAssistantAnswerPhrasing);
const mockedGetConfiguredAssistantProvider = vi.mocked(
  getConfiguredAssistantProvider,
);
const mockedIsAssistantAnswerPhrasingEnabled = vi.mocked(
  isAssistantAnswerPhrasingEnabled,
);

describe("runMockAssistantTurn — weekly report end-to-end (P1 regression)", () => {
  const originalPlanAdherenceFlag =
    process.env.ASSISTANT_PLAN_ADHERENCE_CONTEXT;

  beforeEach(() => {
    vi.clearAllMocks();
    restorePlanAdherenceFlag();
    mockedExecuteAiTool.mockResolvedValue(CANNED_REPORT);
    mockedGetPlanAdherenceContext.mockResolvedValue(null);
    mockedGetConfiguredAssistantProvider.mockReturnValue("mock");
    mockedIsAssistantAnswerPhrasingEnabled.mockReturnValue(false);
  });

  afterEach(() => {
    restorePlanAdherenceFlag();
  });

  function restorePlanAdherenceFlag(): void {
    if (originalPlanAdherenceFlag === undefined) {
      delete process.env.ASSISTANT_PLAN_ADHERENCE_CONTEXT;
      return;
    }

    process.env.ASSISTANT_PLAN_ADHERENCE_CONTEXT = originalPlanAdherenceFlag;
  }

  it('runs get_weekly_training_report for "周报" with no exercise_id when the provider only returns prose', async () => {
    const { response } = await runMockAssistantTurn("user-1", {
      mode: "auto",
      message: "周报",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    // Routed to weekly_report via the keyword fast path.
    expect(response.intent).toBe("weekly_report");

    // The prose reply was coerced into the real tool call — exercise_id absent,
    // and crucially NOT sent as a key at all (optional arg stays optional).
    expect(mockedExecuteAiTool).toHaveBeenCalledTimes(1);
    const [, toolName, toolArgs] = mockedExecuteAiTool.mock.calls[0] ?? [];
    expect(toolName).toBe("get_weekly_training_report");
    expect(toolArgs).toEqual({
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    // The tool call is recorded as a successful step.
    expect(response.tool_calls).toEqual([
      expect.objectContaining({
        tool_name: "get_weekly_training_report",
        status: "success",
      }),
    ]);

    // The final answer carries Evidence bound to the tool output (not prose).
    expect(response.answer.intent).toBe("weekly_report");
    expect(response.answer.evidence.tool_names).toEqual([
      "get_weekly_training_report",
    ]);
    expect(response.answer.evidence.workout_ids).toEqual(
      CANNED_REPORT.evidence.workout_ids,
    );
    expect(response.answer.evidence.set_ids).toEqual(
      CANNED_REPORT.evidence.set_ids,
    );

    // Numbers in the answer all trace back to the tool output.
    expect(response.faithfulness?.status).toBe("verified");
  });

  it("counts the routing call's token usage in telemetry on the groq path (not the public response)", async () => {
    mockedGetConfiguredAssistantProvider.mockReturnValue("groq");
    mockedRunAssistantProvider.mockResolvedValueOnce({
      kind: "message",
      message: "这是你的周报概述……",
      telemetry: {
        attempted: true,
        errored: false,
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
      },
    });

    const { response, telemetry } = await runMockAssistantTurn("user-1", {
      mode: "auto",
      message: "周报",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    expect(telemetry.llm).toEqual({
      attemptCount: 1,
      usageReportCount: 1,
      errorCount: 0,
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120,
      provider: "groq",
      model: "llama-3.3-70b-versatile",
    });
    // Token telemetry is server-only, never on the public response DTO.
    expect(response).not.toHaveProperty("token_usage");
    expect(response).not.toHaveProperty("telemetry");
  });

  it("leaves telemetry undefined on the deterministic mock path (no billed call)", async () => {
    const { telemetry } = await runMockAssistantTurn("user-1", {
      mode: "auto",
      message: "周报",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    expect(telemetry.llm).toBeUndefined();
  });

  it("completes a non-stream turn with deterministic fallback and llm telemetry when provider routing fails", async () => {
    mockedGetConfiguredAssistantProvider.mockReturnValue("groq");
    mockedIsAssistantAnswerPhrasingEnabled.mockReturnValue(true);
    mockedRunAssistantProvider.mockResolvedValueOnce({
      kind: "error",
      error_code: "GROQ_PROVIDER_ERROR",
      message: "Groq request failed (500): boom",
      telemetry: {
        attempted: true,
        errored: true,
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        usage: { prompt_tokens: 42, completion_tokens: 0, total_tokens: 42 },
      },
    });

    const { response, telemetry } = await runMockAssistantTurn("user-1", {
      mode: "auto",
      message: "周报",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    expect(response.tool_calls).toEqual([
      expect.objectContaining({
        tool_name: "get_weekly_training_report",
        status: "success",
      }),
    ]);
    expect(response.faithfulness?.status).toBe("verified");
    expect(response.message_id).toBe("message-1");
    expect(mockedRunAssistantAnswerPhrasing).not.toHaveBeenCalled();
    expect(telemetry.llm).toEqual({
      attemptCount: 1,
      usageReportCount: 1,
      errorCount: 1,
      promptTokens: 42,
      completionTokens: 0,
      totalTokens: 42,
      provider: "groq",
      model: "llama-3.3-70b-versatile",
    });
    expect(telemetry.providerErrorFallback).toEqual({
      provider_error_fallback: true,
      provider_error_code: "GROQ_PROVIDER_ERROR",
      provider_error_message_sanitized: "Groq request failed (500): boom",
      fallback_provider: "mock",
      fallback_reason: "provider_error",
    });
  });

  it.each([
    {
      name: "key/config missing",
      provider: "openai_compatible" as const,
      providerErrorCode: "OPENAI_COMPATIBLE_PROVIDER_ERROR",
      providerMessage:
        "OpenAI-compatible config unavailable: OPENAI_COMPAT_API_KEY is required.",
      telemetry: {
        attempted: false,
        errored: false,
        provider: "openai_compatible" as const,
        model: null,
      },
      expectedLlm: undefined,
    },
    {
      name: "HTTP error",
      provider: "groq" as const,
      providerErrorCode: "GROQ_PROVIDER_ERROR",
      providerMessage: "Groq request failed (500): boom",
      telemetry: {
        attempted: true,
        errored: true,
        provider: "groq" as const,
        model: "llama-3.3-70b-versatile",
        usage: { prompt_tokens: 42, completion_tokens: 0, total_tokens: 42 },
      },
      expectedLlm: {
        attemptCount: 1,
        usageReportCount: 1,
        errorCount: 1,
        promptTokens: 42,
        completionTokens: 0,
        totalTokens: 42,
        provider: "groq" as const,
        model: "llama-3.3-70b-versatile",
      },
    },
    {
      name: "timeout status 0",
      provider: "openai_compatible" as const,
      providerErrorCode: "OPENAI_COMPATIBLE_PROVIDER_ERROR",
      providerMessage: "OpenAI-compatible request timed out after 20000ms.",
      telemetry: {
        attempted: true,
        errored: true,
        provider: "openai_compatible" as const,
        model: "deepseek-chat",
      },
      expectedLlm: {
        attemptCount: 1,
        usageReportCount: 0,
        errorCount: 1,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        provider: "openai_compatible" as const,
        model: "deepseek-chat",
      },
    },
    {
      name: "malformed response",
      provider: "openai_compatible" as const,
      providerErrorCode: "OPENAI_COMPATIBLE_PROVIDER_ERROR",
      providerMessage:
        "OpenAI-compatible provider returned neither text nor a tool call.",
      telemetry: {
        attempted: true,
        errored: true,
        provider: "openai_compatible" as const,
        model: "deepseek-chat",
        usage: { prompt_tokens: 17, completion_tokens: 0, total_tokens: 17 },
      },
      expectedLlm: {
        attemptCount: 1,
        usageReportCount: 1,
        errorCount: 1,
        promptTokens: 17,
        completionTokens: 0,
        totalTokens: 17,
        provider: "openai_compatible" as const,
        model: "deepseek-chat",
      },
    },
  ])(
    "falls back through the deterministic stream path for $name (AR-0c)",
    async ({
      provider,
      providerErrorCode,
      providerMessage,
      telemetry,
      expectedLlm,
    }) => {
      mockedGetConfiguredAssistantProvider.mockReturnValue(provider);
      mockedRunAssistantProvider.mockResolvedValueOnce({
        kind: "error",
        error_code: providerErrorCode,
        message: providerMessage,
        telemetry,
      });
      const events: string[] = [];

      const turn = runMockAssistantTurn(
        "user-1",
        {
          mode: "weekly_report",
          message: "weekly report",
          start_date: "2026-05-19",
          end_date: "2026-06-17",
        },
        {
          onEvent: (event) => {
            events.push(event.type);
          },
        },
      );

      const { response, telemetry: turnTelemetry } = await turn;

      expect(response.tool_calls).toEqual([
        expect.objectContaining({
          tool_name: "get_weekly_training_report",
          status: "success",
        }),
      ]);
      expect(response.faithfulness?.status).toBe("verified");
      expect(response.message_id).toBe("message-1");
      expect(turnTelemetry.llm).toEqual(expectedLlm);
      expect(turnTelemetry.providerErrorFallback).toEqual({
        provider_error_fallback: true,
        provider_error_code: providerErrorCode,
        provider_error_message_sanitized: providerMessage,
        fallback_provider: "mock",
        fallback_reason: "provider_error",
      });
      expect(mockedExecuteAiTool).toHaveBeenCalledWith(
        { userId: "user-1" },
        "get_weekly_training_report",
        { start_date: "2026-05-19", end_date: "2026-06-17" },
      );
      expect(events).toContain("provider_selected");
      expect(events).toContain("done");
      expect(events).not.toContain("error");
    },
  );

  it("completes provider-error fallback with guidance and done when required tool args are missing", async () => {
    mockedGetConfiguredAssistantProvider.mockReturnValue("groq");
    mockedRunAssistantProvider.mockResolvedValueOnce({
      kind: "error",
      error_code: "GROQ_PROVIDER_ERROR",
      message: "Groq request failed (503): unavailable",
      telemetry: {
        attempted: true,
        errored: true,
        provider: "groq",
        model: "llama-3.3-70b-versatile",
      },
    });
    const events: string[] = [];

    const { response, telemetry } = await runMockAssistantTurn(
      "user-1",
      {
        mode: "exercise_progress",
        message: "分析这个动作的进展",
        start_date: "2026-05-19",
        end_date: "2026-06-17",
      },
      {
        onEvent: (event) => {
          events.push(event.type);
        },
      },
    );

    expect(response.tool_calls).toEqual([]);
    expect(response.answer.summary).toContain("请先指定要分析的动作");
    expect(response.faithfulness).toBeUndefined();
    expect(response.message_id).toBe("message-1");
    expect(telemetry.providerErrorFallback).toEqual({
      provider_error_fallback: true,
      provider_error_code: "GROQ_PROVIDER_ERROR",
      provider_error_message_sanitized:
        "Groq request failed (503): unavailable",
      fallback_provider: "mock",
      fallback_reason: "provider_error",
    });
    expect(mockedExecuteAiTool).not.toHaveBeenCalled();
    expect(events).toContain("structured_output");
    expect(events).toContain("done");
    expect(events).not.toContain("error");
  });

  it("keeps plan-adherence context off by default for next-week plans", async () => {
    const { response } = await runMockAssistantTurn("user-1", {
      mode: "next_week_plan",
      message: "帮我安排下周训练",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    expect(response.intent).toBe("next_week_plan");
    expect(response.plan?.strategy).toBe("add_frequency");
    expect(mockedGetPlanAdherenceContext).not.toHaveBeenCalled();
  });

  it("injects plan-adherence context when opted in without leaking derived adherence numbers into answer prose", async () => {
    process.env.ASSISTANT_PLAN_ADHERENCE_CONTEXT = "on";
    mockedGetPlanAdherenceContext.mockResolvedValue({
      startDate: "2026-05-19",
      endDate: "2026-06-17",
      exerciseAdherenceRatio: 0.5,
      setAdherenceRatio: 0.25,
      exercises: [
        {
          exerciseName: "卧推",
          plannedSets: 4,
          performedSets: 2,
          status: "partial",
          setCompletionRatio: 0.5,
          targetWeightKg: 70,
        },
      ],
    });

    const { response } = await runMockAssistantTurn("user-1", {
      mode: "next_week_plan",
      message: "帮我安排下周训练",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    const answerText = [
      response.answer.summary,
      ...response.answer.bullets,
      response.answer.recommendation,
      response.answer.conclusion,
    ].join("\n");

    expect(mockedGetPlanAdherenceContext).toHaveBeenCalledWith("user-1", {
      startDate: "2026-05-19",
      endDate: "2026-06-17",
    });
    expect(response.plan?.strategy).toBe("consolidate");
    expect(response.plan?.exercises[0]?.basis).toContain("完成 2/4 组");
    expect(response.answer.recommendation).toContain("保持相近频率");
    expect(answerText).not.toContain("2/4");
    expect(answerText).not.toContain("0.25");
  });

  it("falls back cleanly when opted-in plan-adherence loading fails", async () => {
    process.env.ASSISTANT_PLAN_ADHERENCE_CONTEXT = "on";
    mockedGetPlanAdherenceContext.mockRejectedValue(new Error("db down"));

    const { response } = await runMockAssistantTurn("user-1", {
      mode: "next_week_plan",
      message: "帮我安排下周训练",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    expect(response.intent).toBe("next_week_plan");
    expect(response.plan?.strategy).toBe("add_frequency");
    expect(mockedGetPlanAdherenceContext).toHaveBeenCalledTimes(1);
  });
});

describe("runMockAssistantTurn provider budget gate (AR-1d commit 1)", () => {
  const input = {
    mode: "weekly_report" as const,
    message: "weekly report",
    start_date: "2026-05-19",
    end_date: "2026-06-17",
  };
  const allowDecision: AssistantProviderGuardDecision = {
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
  };
  const fallbackDecision: AssistantProviderGuardDecision = {
    kind: "fallback",
    fallback_provider: "mock",
    telemetry: {
      budget_fallback: true,
      budget_reason: "daily_call_budget_exceeded",
      budget_scope: "instance",
      budget_current_calls: 500,
      budget_call_limit: 500,
      budget_current_cost_usd: 0,
      budget_cost_limit_usd: 1,
    },
  };
  const ipFallbackDecision: AssistantIpGuardDecision = {
    kind: "fallback",
    fallback_provider: "mock",
    telemetry: {
      budget_fallback: true,
      budget_reason: "per_ip_daily_limit_exceeded",
      budget_scope: "ip",
      budget_ip_minute_count: 1,
      budget_ip_minute_limit: 10,
      budget_ip_day_count: 30,
      budget_ip_day_limit: 30,
      budget_retry_after_seconds: 60,
    },
  };

  function createGuard(decisions: AssistantProviderGuardDecision[]) {
    const guardRealProviderAttempt = vi.fn<
      AssistantProviderGuard["guardRealProviderAttempt"]
    >(() => decisions.shift() ?? allowDecision);
    const recordCost = vi.fn<AssistantProviderGuard["recordCost"]>();

    return {
      guardRealProviderAttempt,
      recordCost,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockedExecuteAiTool.mockResolvedValue(CANNED_REPORT);
    mockedGetPlanAdherenceContext.mockResolvedValue(null);
    mockedGetConfiguredAssistantProvider.mockReturnValue("groq");
    mockedIsAssistantAnswerPhrasingEnabled.mockReturnValue(false);
    mockedRunAssistantProvider.mockResolvedValue({
      kind: "message",
      message: "provider prose",
      telemetry: {
        attempted: true,
        errored: false,
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
      },
    });
  });

  it("keeps safety ahead of the instance gate and every provider call", async () => {
    const originalSafetyGate = process.env.ASSISTANT_SAFETY_GATE;
    process.env.ASSISTANT_SAFETY_GATE = "on";
    const guard = createGuard([allowDecision]);

    try {
      await runMockAssistantTurn(
        "user-1",
        { ...input, mode: "auto", message: "I have chest pain right now" },
        { providerGuard: guard },
      );
    } finally {
      if (originalSafetyGate === undefined) {
        delete process.env.ASSISTANT_SAFETY_GATE;
      } else {
        process.env.ASSISTANT_SAFETY_GATE = originalSafetyGate;
      }
    }

    expect(guard.guardRealProviderAttempt).not.toHaveBeenCalled();
    expect(guard.recordCost).not.toHaveBeenCalled();
    expect(mockedGetConfiguredAssistantProvider).not.toHaveBeenCalled();
    expect(mockedRunAssistantProvider).not.toHaveBeenCalled();
    expect(mockedRunAssistantAnswerPhrasing).not.toHaveBeenCalled();
  });

  it("bypasses both budget layers completely in mock mode", async () => {
    mockedGetConfiguredAssistantProvider.mockReturnValue("mock");
    const guard = createGuard([fallbackDecision]);

    await runMockAssistantTurn("user-1", input, {
      providerGuard: guard,
      assistantIpGuardDecision: ipFallbackDecision,
    });

    expect(guard.guardRealProviderAttempt).not.toHaveBeenCalled();
    expect(guard.recordCost).not.toHaveBeenCalled();
    expect(mockedRunAssistantProvider).toHaveBeenCalledTimes(1);
  });

  it("locks the whole turn on per-IP fallback without touching the instance guard", async () => {
    mockedIsAssistantAnswerPhrasingEnabled.mockReturnValue(true);
    const guard = createGuard([allowDecision]);

    const { response, telemetry } = await runMockAssistantTurn(
      "user-1",
      input,
      {
        providerGuard: guard,
        assistantIpGuardDecision: ipFallbackDecision,
      },
    );

    expect(guard.guardRealProviderAttempt).not.toHaveBeenCalled();
    expect(guard.recordCost).not.toHaveBeenCalled();
    expect(mockedRunAssistantProvider).not.toHaveBeenCalled();
    expect(mockedRunAssistantAnswerPhrasing).not.toHaveBeenCalled();
    expect(mockedExecuteAiTool).toHaveBeenCalledTimes(1);
    expect(response.message_id).toBe("message-1");
    expect(telemetry.budgetFallback).toEqual(ipFallbackDecision.telemetry);
    expect(telemetry.providerErrorFallback).toBeUndefined();
  });

  it("stops after the first instance denial without rechecking later calls", async () => {
    mockedIsAssistantAnswerPhrasingEnabled.mockReturnValue(true);
    const guard = createGuard([fallbackDecision]);

    const { telemetry } = await runMockAssistantTurn("user-1", input, {
      providerGuard: guard,
    });

    expect(guard.guardRealProviderAttempt).toHaveBeenCalledTimes(1);
    expect(guard.recordCost).not.toHaveBeenCalled();
    expect(mockedRunAssistantProvider).not.toHaveBeenCalled();
    expect(mockedRunAssistantAnswerPhrasing).not.toHaveBeenCalled();
    expect(mockedExecuteAiTool).toHaveBeenCalledTimes(1);
    expect(telemetry.budgetFallback).toEqual(fallbackDecision.telemetry);
  });

  it("reuses AR-0 missing-argument guidance and emits one done on budget denial", async () => {
    const guard = createGuard([fallbackDecision]);
    const events: string[] = [];

    const { response } = await runMockAssistantTurn(
      "user-1",
      {
        ...input,
        mode: "exercise_progress",
        message: "show exercise progress",
      },
      {
        providerGuard: guard,
        onEvent: (event) => {
          events.push(event.type);
        },
      },
    );

    expect(mockedRunAssistantProvider).not.toHaveBeenCalled();
    expect(mockedExecuteAiTool).not.toHaveBeenCalled();
    expect(response.tool_calls).toEqual([]);
    expect(response.answer.summary).not.toBe("");
    expect(events.filter((event) => event === "done")).toHaveLength(1);
    expect(events).not.toContain("error");
  });

  it("guards routing first, records its cost, then locks on tool-selection denial", async () => {
    const guard = createGuard([allowDecision, fallbackDecision]);
    const classify = vi.fn(async () => ({
      intent: "weekly_report" as const,
      call: {
        attempted: true,
        errored: false,
        provider: "groq" as const,
        model: "llama-3.3-70b-versatile",
        usage: {
          prompt_tokens: 100,
          completion_tokens: 20,
          total_tokens: 120,
        },
      },
    }));

    await runMockAssistantTurn(
      "user-1",
      { ...input, mode: "auto", message: "alpha beta gamma" },
      { providerGuard: guard, intentRouter: { classify } },
    );

    expect(classify).toHaveBeenCalledTimes(1);
    expect(guard.guardRealProviderAttempt).toHaveBeenCalledTimes(2);
    expect(guard.recordCost).toHaveBeenCalledTimes(1);
    expect(guard.recordCost).toHaveBeenCalledWith(0.000075);
    expect(mockedRunAssistantProvider).not.toHaveBeenCalled();
    expect(mockedExecuteAiTool).toHaveBeenCalledTimes(1);
  });

  it("guards all three real call sites and records each returned call once", async () => {
    mockedIsAssistantAnswerPhrasingEnabled.mockReturnValue(true);
    const guard = createGuard([allowDecision, allowDecision, allowDecision]);
    const classify = vi.fn(async () => ({
      intent: "weekly_report" as const,
      call: {
        attempted: true,
        errored: false,
        provider: "groq" as const,
        model: "llama-3.3-70b-versatile",
        usage: {
          prompt_tokens: 100,
          completion_tokens: 20,
          total_tokens: 120,
        },
      },
    }));
    mockedRunAssistantAnswerPhrasing.mockImplementationOnce(async (value) => ({
      summary: value.draftSummary,
      call: {
        attempted: true,
        errored: false,
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
      },
    }));

    await runMockAssistantTurn(
      "user-1",
      { ...input, mode: "auto", message: "alpha beta gamma" },
      { providerGuard: guard, intentRouter: { classify } },
    );

    expect(guard.guardRealProviderAttempt).toHaveBeenCalledTimes(3);
    expect(guard.recordCost).toHaveBeenCalledTimes(3);
    expect(guard.recordCost).toHaveBeenNthCalledWith(1, 0.000075);
    expect(guard.recordCost).toHaveBeenNthCalledWith(2, 0.000037);
    expect(guard.recordCost).toHaveBeenNthCalledWith(3, 0.000016);
    expect(mockedRunAssistantProvider).toHaveBeenCalledTimes(1);
    expect(mockedRunAssistantAnswerPhrasing).toHaveBeenCalledTimes(1);
  });

  it("keeps the deterministic draft when the phrasing call is denied", async () => {
    mockedIsAssistantAnswerPhrasingEnabled.mockReturnValue(true);
    const guard = createGuard([allowDecision, fallbackDecision]);

    const { response, telemetry } = await runMockAssistantTurn(
      "user-1",
      input,
      { providerGuard: guard },
    );

    expect(guard.guardRealProviderAttempt).toHaveBeenCalledTimes(2);
    expect(guard.recordCost).toHaveBeenCalledTimes(1);
    expect(mockedRunAssistantAnswerPhrasing).not.toHaveBeenCalled();
    expect(response.answer.summary).not.toBe("");
    expect(telemetry.budgetFallback).toEqual(fallbackDecision.telemetry);
  });

  it("records returned provider-error usage without changing AR-0 fallback telemetry", async () => {
    const guard = createGuard([allowDecision]);
    mockedRunAssistantProvider.mockResolvedValueOnce({
      kind: "error",
      error_code: "GROQ_PROVIDER_ERROR",
      message: "Groq request failed (500): boom",
      telemetry: {
        attempted: true,
        errored: true,
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        usage: { prompt_tokens: 42, completion_tokens: 0, total_tokens: 42 },
      },
    });

    const { telemetry } = await runMockAssistantTurn("user-1", input, {
      providerGuard: guard,
    });

    expect(guard.recordCost).toHaveBeenCalledTimes(1);
    expect(guard.recordCost).toHaveBeenCalledWith(0.000025);
    expect(telemetry.providerErrorFallback).toEqual({
      provider_error_fallback: true,
      provider_error_code: "GROQ_PROVIDER_ERROR",
      provider_error_message_sanitized: "Groq request failed (500): boom",
      fallback_provider: "mock",
      fallback_reason: "provider_error",
    });
  });

  it("records null cost for an unknown model while preserving call-count gating", async () => {
    const guard = createGuard([allowDecision]);
    mockedRunAssistantProvider.mockResolvedValueOnce({
      kind: "message",
      message: "provider prose",
      telemetry: {
        attempted: true,
        errored: false,
        provider: "openai_compatible",
        model: "deepseek-chat",
        usage: { prompt_tokens: 30, completion_tokens: 5, total_tokens: 35 },
      },
    });

    await runMockAssistantTurn("user-1", input, { providerGuard: guard });

    expect(guard.guardRealProviderAttempt).toHaveBeenCalledTimes(1);
    expect(guard.recordCost).toHaveBeenCalledWith(null);
  });
});
