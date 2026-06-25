import { beforeEach, describe, expect, it, vi } from "vitest";

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

import {
  AssistantTurnError,
  runMockAssistantTurn,
} from "./assistant-orchestrator-service.js";
import { executeAiTool } from "../ai/tools/tool-executor.js";
import { runAssistantProvider } from "./provider-adapter.js";
import { getConfiguredAssistantProvider } from "./provider-config.js";

const mockedExecuteAiTool = vi.mocked(executeAiTool);
const mockedRunAssistantProvider = vi.mocked(runAssistantProvider);
const mockedGetConfiguredAssistantProvider = vi.mocked(
  getConfiguredAssistantProvider,
);

describe("runMockAssistantTurn — weekly report end-to-end (P1 regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedExecuteAiTool.mockResolvedValue(CANNED_REPORT);
    mockedGetConfiguredAssistantProvider.mockReturnValue("mock");
  });

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

  it("throws AssistantTurnError carrying llm telemetry when the groq routing call fails (P1)", async () => {
    mockedGetConfiguredAssistantProvider.mockReturnValue("groq");
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

    const turn = runMockAssistantTurn("user-1", {
      mode: "auto",
      message: "周报",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    await expect(turn).rejects.toBeInstanceOf(AssistantTurnError);
    await turn.catch((error: unknown) => {
      if (!(error instanceof AssistantTurnError)) {
        throw error;
      }
      expect(error.turnTelemetry.llm).toEqual({
        attemptCount: 1,
        usageReportCount: 1,
        errorCount: 1,
        promptTokens: 42,
        completionTokens: 0,
        totalTokens: 42,
        provider: "groq",
        model: "llama-3.3-70b-versatile",
      });
    });
  });
});
