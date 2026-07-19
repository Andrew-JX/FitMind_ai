import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Canned weekly-report tool result, shared between the executeAiTool mock and the
// assertions. Hoisted so the (hoisted) vi.mock factory below can reference it.
const { CANNED_PROGRESS, CANNED_REPORT, EXERCISE_DICTIONARY } = vi.hoisted(
  () => ({
    CANNED_PROGRESS: {
      range: { start_date: "2026-05-19", end_date: "2026-06-17" },
      exercise: {
        exercise_id: "33333333-3333-4333-8333-333333333333",
        exercise_name: "杠铃卧推",
      },
      totals: {
        workout_count: 2,
        set_count: 8,
        total_reps: 64,
        total_volume: 4800,
        max_weight_kg: 80,
        estimated_1rm_kg: 96,
      },
      sessions: [{ performed_at: "2026-06-10T10:00:00.000Z" }],
      evidence: {
        workout_ids: ["11111111-1111-1111-1111-111111111111"],
        set_ids: ["22222222-2222-2222-2222-222222222222"],
        calculation_rules: ["exercise_progress_aggregation"],
      },
    },
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
    EXERCISE_DICTIONARY: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        code: "bench_press_barbell",
        name_en: "Barbell Bench Press",
        name_zh: "杠铃卧推",
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        code: "bench_press_dumbbell",
        name_en: "Dumbbell Bench Press",
        name_zh: "哑铃卧推",
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        code: "incline_bench_press_barbell",
        name_en: "Incline Barbell Bench Press",
        name_zh: "上斜杠铃卧推",
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        code: "incline_bench_press_dumbbell",
        name_en: "Incline Dumbbell Bench Press",
        name_zh: "上斜哑铃卧推",
      },
    ],
  }),
);

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
  findChatMessageByIdForUser: vi.fn(async () => null),
  findChatSessionByIdForUser: vi.fn(async () => null),
  hasChatMessageById: vi.fn(async () => false),
  hasChatSessionById: vi.fn(async () => false),
  listMessagesForSession: vi.fn(async () => []),
}));

vi.mock("../training/dictionary-service.js", () => ({
  searchDictionaryExercises: vi.fn(async () => ({
    items: EXERCISE_DICTIONARY,
  })),
}));

vi.mock("../athlete-profile-service.js", () => ({
  getAthleteProfile: vi.fn(async () => null),
}));

vi.mock("../planned-workout-service.js", () => ({
  getPlanAdherenceContextForPlanner: vi.fn(async () => null),
}));

import { runMockAssistantTurn } from "./assistant-orchestrator-service.js";
import {
  createChatMessage,
  findChatSessionByIdForUser,
  listMessagesForSession,
  type ChatMessageRow,
} from "../../db/chat-repository.js";
import { executeAiTool } from "../ai/tools/tool-executor.js";
import { AiToolValidationError } from "../ai/tools/tool-types.js";
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
import { saveAssistantInsightFromMessage } from "./assistant-saved-insights-service.js";

const mockedExecuteAiTool = vi.mocked(executeAiTool);
const mockedCreateChatMessage = vi.mocked(createChatMessage);
const mockedFindChatSessionByIdForUser = vi.mocked(findChatSessionByIdForUser);
const mockedListMessagesForSession = vi.mocked(listMessagesForSession);
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

function createPersistedAssistantMessage(metadata: unknown): ChatMessageRow {
  return {
    id: "message-1",
    session_id: "session-1",
    role: "assistant",
    content: [],
    structured_output: null,
    usage: null,
    metadata,
    token_input: null,
    token_output: null,
    created_at: "2026-06-17T10:00:00.000Z",
  };
}

describe("runMockAssistantTurn — weekly report end-to-end (P1 regression)", () => {
  const originalPlanAdherenceFlag =
    process.env.ASSISTANT_PLAN_ADHERENCE_CONTEXT;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedExecuteAiTool.mockReset();
    mockedRunAssistantProvider.mockReset();
    mockedRunAssistantAnswerPhrasing.mockReset();
    restorePlanAdherenceFlag();
    mockedExecuteAiTool.mockResolvedValue(CANNED_REPORT);
    mockedRunAssistantProvider.mockResolvedValue({
      kind: "message",
      message: "这是你的周报概述……",
    });
    mockedRunAssistantAnswerPhrasing.mockImplementation(
      async (phrasingInput) => ({
        summary: phrasingInput.draftSummary,
        call: {
          attempted: false,
          errored: false,
          provider: null,
          model: null,
        },
      }),
    );
    mockedGetPlanAdherenceContext.mockResolvedValue(null);
    mockedGetConfiguredAssistantProvider.mockReturnValue("mock");
    mockedIsAssistantAnswerPhrasingEnabled.mockReturnValue(false);
    mockedFindChatSessionByIdForUser.mockResolvedValue(null);
    mockedListMessagesForSession.mockResolvedValue([]);
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

    // Regression contract: ready-data labels must describe the exact tool
    // result range instead of claiming that every request covers this week.
    expect(response.answer.summary).toContain(
      "统计范围：2026-05-19 到 2026-06-17。",
    );
    expect(response.answer.summary).not.toContain("本周");
    expect(response.answer.bullets[0]).toBe("该统计范围内训练频率：4 次。");
    expect(response.answer.bullets[2]).toContain("该统计范围内主要训练动作是");

    // Numbers in the answer all trace back to the tool output.
    expect(response.faithfulness?.status).toBe("verified");
  });

  it("rounds weekly-report volume metrics to 0.5 kg without changing faithfulness", async () => {
    const fractionalReport = {
      ...CANNED_REPORT,
      totals: {
        ...CANNED_REPORT.totals,
        total_volume: 5000.333,
      },
      top_exercises: [
        {
          ...CANNED_REPORT.top_exercises[0],
          total_volume: 2000.333,
        },
      ],
    };
    mockedExecuteAiTool.mockResolvedValueOnce(fractionalReport);

    const { response } = await runMockAssistantTurn("user-1", {
      mode: "auto",
      message: "周报",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    expect(response.answer.summary).toContain("总训练量约 5,000.5 kg");
    expect(response.answer.bullets[2]).toContain("总量约 2,000.5 kg");
    expect(response.faithfulness).toMatchObject({
      status: "verified",
      unverifiedClaims: [],
    });
    expect(fractionalReport.totals.total_volume).toBe(5000.333);
    expect(fractionalReport.top_exercises[0]?.total_volume).toBe(2000.333);
  });

  it("rounds training-overview volume metrics through the shared kg formatter", async () => {
    const fractionalOverview = {
      range: { start_date: "2026-05-19", end_date: "2026-06-17" },
      totals: {
        workout_count: 2,
        set_count: 8,
        total_reps: 64,
        total_volume: 4800.333,
      },
      by_exercise: [{ exercise_name: "杠铃卧推", total_volume: 2400.333 }],
      evidence: {
        workout_ids: ["11111111-1111-1111-1111-111111111111"],
        calculation_rules: ["training_summary_aggregation"],
      },
    };
    mockedExecuteAiTool.mockResolvedValueOnce(fractionalOverview);

    const { response } = await runMockAssistantTurn("user-1", {
      mode: "training_overview",
      message: "训练总结",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    expect(response.answer.summary).toContain("总训练量约 4,800.5 kg");
    expect(response.answer.bullets[0]).toContain("累计约 2,400.5 kg");
    expect(response.faithfulness).toMatchObject({
      status: "verified",
      unverifiedClaims: [],
    });
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

  it("short-circuits a missing exercise as actionable clarification before tool selection and phrasing", async () => {
    mockedGetConfiguredAssistantProvider.mockReturnValue("groq");
    const events: string[] = [];

    const { response, telemetry } = await runMockAssistantTurn(
      "user-1",
      {
        mode: "auto",
        message: "这个动作最近有进步吗",
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
    expect(response.answer.recommendation).toContain("直接回复完整动作名");
    expect(response.answer.recommendation).toContain("不需要去分析页");
    expect(response.clarification).toEqual({
      kind: "exercise",
      reason: "unresolved",
      options: [],
    });
    expect(response.faithfulness).toBeUndefined();
    expect(response.message_id).toBe("message-1");
    expect(telemetry.toolArgumentFallback).toBeUndefined();
    expect(telemetry.providerErrorFallback).toBeUndefined();
    expect(mockedRunAssistantProvider).not.toHaveBeenCalled();
    expect(mockedRunAssistantAnswerPhrasing).not.toHaveBeenCalled();
    expect(mockedExecuteAiTool).not.toHaveBeenCalled();
    expect(mockedCreateChatMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        role: "assistant",
        metadata: expect.objectContaining({
          clarification_context: expect.objectContaining({
            version: 1,
            resolved_intent: "progress",
            resolved_entities: {
              exercise: expect.objectContaining({ status: "absent" }),
            },
          }),
        }),
      }),
    );
    expect(events).toContain("structured_output");
    expect(events).toContain("done");
    expect(events).not.toContain("error");
  });

  it("injects a uniquely parsed exercise into the normal evidence tool path", async () => {
    mockedExecuteAiTool.mockResolvedValueOnce(CANNED_PROGRESS);

    const { response } = await runMockAssistantTurn("user-1", {
      mode: "auto",
      message: "杠铃卧推最近有没有进步",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    expect(response.intent).toBe("progress");
    expect(response.clarification).toBeUndefined();
    expect(mockedRunAssistantProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        assistant_context: expect.objectContaining({
          exercise_id: "33333333-3333-4333-8333-333333333333",
        }),
      }),
    );
    expect(mockedExecuteAiTool).toHaveBeenCalledWith(
      { userId: "user-1" },
      "get_exercise_progress",
      {
        exercise_id: "33333333-3333-4333-8333-333333333333",
        start_date: "2026-05-19",
        end_date: "2026-06-17",
      },
    );
  });

  it("rounds fractional 1RM and max weight while verifying against raw tool values", async () => {
    const fractionalProgress = {
      ...CANNED_PROGRESS,
      totals: {
        ...CANNED_PROGRESS.totals,
        max_weight_kg: 80.26,
        estimated_1rm_kg: 88.667,
      },
    };
    mockedExecuteAiTool.mockResolvedValueOnce(fractionalProgress);

    const { response } = await runMockAssistantTurn("user-1", {
      mode: "auto",
      message: "杠铃卧推最近有没有进步",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    expect(response.answer.summary).toContain("估算 1RM 约为 88.5 kg");
    expect(response.answer.summary).toContain("最高训练重量约为 80.5 kg");
    expect(response.answer.summary).not.toContain("88.667");
    expect(response.faithfulness).toMatchObject({
      status: "verified",
      unverifiedClaims: [],
    });
    expect(fractionalProgress.totals.estimated_1rm_kg).toBe(88.667);
    expect(fractionalProgress.totals.max_weight_kg).toBe(80.26);
  });

  it("keeps an explicit exercise id above a conflicting message mention", async () => {
    mockedExecuteAiTool.mockResolvedValueOnce(CANNED_PROGRESS);

    await runMockAssistantTurn("user-1", {
      mode: "auto",
      message: "杠铃卧推最近有没有进步",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
      exercise_id: "44444444-4444-4444-8444-444444444444",
    });

    expect(mockedExecuteAiTool).toHaveBeenCalledWith(
      { userId: "user-1" },
      "get_exercise_progress",
      {
        exercise_id: "44444444-4444-4444-8444-444444444444",
        start_date: "2026-05-19",
        end_date: "2026-06-17",
      },
    );
  });

  it("returns validated candidates for a broad exercise without tool selection or phrasing", async () => {
    const { response } = await runMockAssistantTurn("user-1", {
      mode: "auto",
      message: "卧推最近有没有进步",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    expect(response.clarification).toEqual({
      kind: "exercise",
      reason: "ambiguous",
      options: [
        {
          exercise_id: "33333333-3333-4333-8333-333333333333",
          exercise_name: "杠铃卧推",
        },
        {
          exercise_id: "44444444-4444-4444-8444-444444444444",
          exercise_name: "哑铃卧推",
        },
        {
          exercise_id: "55555555-5555-4555-8555-555555555555",
          exercise_name: "上斜杠铃卧推",
        },
        {
          exercise_id: "66666666-6666-4666-8666-666666666666",
          exercise_name: "上斜哑铃卧推",
        },
      ],
    });
    expect(mockedRunAssistantProvider).not.toHaveBeenCalled();
    expect(mockedRunAssistantAnswerPhrasing).not.toHaveBeenCalled();
    expect(mockedExecuteAiTool).not.toHaveBeenCalled();
  });

  it("resumes only the latest validated clarification and consumes it with the next assistant reply", async () => {
    await runMockAssistantTurn("user-1", {
      mode: "auto",
      message: "卧推最近有没有进步",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });
    const pendingMetadata = mockedCreateChatMessage.mock.calls[1]?.[0].metadata;

    mockedCreateChatMessage.mockClear();
    mockedRunAssistantProvider.mockClear();
    mockedExecuteAiTool.mockClear();
    mockedFindChatSessionByIdForUser.mockResolvedValue({
      id: "77777777-7777-4777-8777-777777777777",
      user_id: "user-1",
      title: null,
      created_at: "2026-06-17T09:00:00.000Z",
      last_message_at: "2026-06-17T10:00:00.000Z",
    });
    mockedListMessagesForSession.mockResolvedValue([
      createPersistedAssistantMessage(pendingMetadata),
    ]);
    mockedExecuteAiTool.mockResolvedValueOnce(CANNED_PROGRESS);

    const resumed = await runMockAssistantTurn("user-1", {
      mode: "auto",
      session_id: "77777777-7777-4777-8777-777777777777",
      message: "杠铃卧推。",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    expect(resumed.response.clarification).toBeUndefined();
    expect(mockedRunAssistantProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation: { user_message: "卧推最近有没有进步" },
        assistant_context: expect.objectContaining({
          exercise_id: "33333333-3333-4333-8333-333333333333",
        }),
      }),
    );
    const consumedMetadata =
      mockedCreateChatMessage.mock.calls[1]?.[0].metadata;
    expect(consumedMetadata).not.toEqual(
      expect.objectContaining({ clarification_context: expect.anything() }),
    );

    mockedCreateChatMessage.mockClear();
    mockedRunAssistantProvider.mockClear();
    mockedExecuteAiTool.mockClear();
    mockedListMessagesForSession.mockResolvedValue([
      createPersistedAssistantMessage(consumedMetadata),
    ]);
    mockedExecuteAiTool.mockResolvedValueOnce(CANNED_PROGRESS);

    await runMockAssistantTurn("user-1", {
      mode: "auto",
      session_id: "77777777-7777-4777-8777-777777777777",
      message: "杠铃卧推",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    expect(mockedRunAssistantProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation: { user_message: "杠铃卧推" },
      }),
    );
  });

  it("routes an unrelated question normally instead of attaching an older clarification", async () => {
    await runMockAssistantTurn("user-1", {
      mode: "auto",
      message: "卧推最近有没有进步",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });
    const pendingMetadata = mockedCreateChatMessage.mock.calls[1]?.[0].metadata;

    mockedCreateChatMessage.mockClear();
    mockedRunAssistantProvider.mockClear();
    mockedExecuteAiTool.mockClear();
    mockedFindChatSessionByIdForUser.mockResolvedValue({
      id: "77777777-7777-4777-8777-777777777777",
      user_id: "user-1",
      title: null,
      created_at: "2026-06-17T09:00:00.000Z",
      last_message_at: "2026-06-17T10:00:00.000Z",
    });
    mockedListMessagesForSession.mockResolvedValue([
      createPersistedAssistantMessage(pendingMetadata),
    ]);

    const { response } = await runMockAssistantTurn("user-1", {
      mode: "auto",
      session_id: "77777777-7777-4777-8777-777777777777",
      message: "帮我做周报",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    expect(response.intent).toBe("weekly_report");
    expect(response.clarification).toBeUndefined();
    expect(mockedExecuteAiTool).toHaveBeenCalledWith(
      { userId: "user-1" },
      "get_weekly_training_report",
      { start_date: "2026-05-19", end_date: "2026-06-17" },
    );
  });

  it("rejects a clarification response when saving an insight", async () => {
    const { response } = await runMockAssistantTurn("user-1", {
      mode: "plateau_diagnosis",
      message: "卧推平台期",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });
    expect(mockedRunAssistantProvider).not.toHaveBeenCalled();
    expect(response.clarification).toEqual(
      expect.objectContaining({ kind: "exercise", reason: "ambiguous" }),
    );
    const createInsight = vi.fn(async () => {
      throw new Error("clarification must not be persisted as an insight");
    });

    await expect(
      saveAssistantInsightFromMessage(
        { messageId: "message-1", userId: "user-1" },
        {
          createInsight,
          deleteInsight: vi.fn(async () => false),
          findInsight: vi.fn(async () => null),
          findMessage: vi.fn(async () => ({
            ...createPersistedAssistantMessage(null),
            structured_output: response,
          })),
          hasMessage: vi.fn(async () => true),
          listInsights: vi.fn(async () => []),
        },
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Assistant clarifications cannot be saved as insights.",
    });
    expect(createInsight).not.toHaveBeenCalled();
  });

  it("degrades a successful provider's invalid tool call to guidance and done", async () => {
    mockedGetConfiguredAssistantProvider.mockReturnValue("groq");
    mockedRunAssistantProvider.mockResolvedValueOnce({
      kind: "tool_call",
      tool_name: "get_exercise_progress",
      tool_args: {
        start_date: "2026-05-19",
        end_date: "2026-06-17",
      },
      telemetry: {
        attempted: true,
        errored: false,
        provider: "groq",
        model: "llama-3.3-70b-versatile",
      },
    });
    mockedExecuteAiTool.mockRejectedValueOnce(
      new AiToolValidationError([
        { path: "exercise_id", message: "Invalid input" },
      ]),
    );
    const events: string[] = [];

    const { response, telemetry } = await runMockAssistantTurn(
      "user-1",
      {
        mode: "auto",
        message: "这个动作最近有进步吗",
        start_date: "2026-05-19",
        end_date: "2026-06-17",
        exercise_id: "33333333-3333-4333-8333-333333333333",
      },
      {
        onEvent: (event) => {
          events.push(event.type);
        },
      },
    );

    expect(mockedRunAssistantProvider).toHaveBeenCalledTimes(1);
    expect(mockedExecuteAiTool).toHaveBeenCalledWith(
      { userId: "user-1" },
      "get_exercise_progress",
      {
        start_date: "2026-05-19",
        end_date: "2026-06-17",
      },
    );
    expect(response.tool_calls).toEqual([
      expect.objectContaining({
        tool_name: "get_exercise_progress",
        status: "error",
      }),
    ]);
    expect(response.answer.summary).toContain("请先指定要分析的动作");
    expect(JSON.stringify(response)).not.toContain(
      "Tool argument validation failed",
    );
    expect(JSON.stringify(response)).not.toContain("Invalid input");
    expect(telemetry.toolArgumentFallback).toEqual({
      tool_argument_fallback: true,
      fallback_reason: "tool_validation_error",
      tool_name: "get_exercise_progress",
      argument_fields: ["exercise_id"],
      validation_error_code: "VALIDATION_ERROR",
    });
    expect(events).toContain("structured_output");
    expect(events.filter((event) => event === "done")).toHaveLength(1);
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
    mockedExecuteAiTool.mockReset();
    mockedRunAssistantProvider.mockReset();
    mockedRunAssistantAnswerPhrasing.mockReset();
    mockedExecuteAiTool.mockResolvedValue(CANNED_REPORT);
    mockedGetPlanAdherenceContext.mockResolvedValue(null);
    mockedGetConfiguredAssistantProvider.mockReturnValue("groq");
    mockedIsAssistantAnswerPhrasingEnabled.mockReturnValue(false);
    mockedFindChatSessionByIdForUser.mockResolvedValue(null);
    mockedListMessagesForSession.mockResolvedValue([]);
    mockedRunAssistantAnswerPhrasing.mockImplementation(
      async (phrasingInput) => ({
        summary: phrasingInput.draftSummary,
        call: {
          attempted: false,
          errored: false,
          provider: null,
          model: null,
        },
      }),
    );
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

  it("accounts for intent rescue but stops clarification before tool selection and phrasing", async () => {
    const guard = createGuard([allowDecision]);
    const classify = vi.fn(async () => ({
      intent: "progress" as const,
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

    const { response, telemetry } = await runMockAssistantTurn(
      "user-1",
      {
        ...input,
        mode: "auto",
        message: "帮我看看",
      },
      { providerGuard: guard, intentRouter: { classify } },
    );

    expect(response.clarification).toEqual({
      kind: "exercise",
      reason: "unresolved",
      options: [],
    });
    expect(classify).toHaveBeenCalledTimes(1);
    expect(guard.guardRealProviderAttempt).toHaveBeenCalledTimes(1);
    expect(guard.recordCost).toHaveBeenCalledTimes(1);
    expect(telemetry.llm?.attemptCount).toBe(1);
    expect(mockedRunAssistantProvider).not.toHaveBeenCalled();
    expect(mockedRunAssistantAnswerPhrasing).not.toHaveBeenCalled();
    expect(mockedExecuteAiTool).not.toHaveBeenCalled();
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
