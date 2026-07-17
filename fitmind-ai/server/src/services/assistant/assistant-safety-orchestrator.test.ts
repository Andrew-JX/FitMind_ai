import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { CANNED_REPORT } = vi.hoisted(() => ({
  CANNED_REPORT: {
    range: { start_date: "2026-05-19", end_date: "2026-06-17" },
    status: "ready",
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
    low_volume_muscle_groups: [],
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

vi.mock("./provider-config.js", () => ({
  getConfiguredAssistantProvider: vi.fn(() => "mock"),
  getGroqAssistantProviderConfig: vi.fn(() => ({
    apiKey: "test-key",
    model: "llama-3.3-70b-versatile",
  })),
  isAssistantAnswerPhrasingEnabled: vi.fn(() => false),
}));

vi.mock("../ai/tools/tool-executor.js", () => ({
  executeAiTool: vi.fn(async () => CANNED_REPORT),
}));

vi.mock("../../db/chat-repository.js", () => ({
  createChatSession: vi.fn(async () => ({ id: "session-1" })),
  createChatMessage: vi.fn(async () => ({ id: "message-1" })),
  findChatSessionByIdForUser: vi.fn(async () => null),
  hasChatSessionById: vi.fn(async () => false),
  listMessagesForSession: vi.fn(async () => []),
}));

vi.mock("../training/dictionary-service.js", () => ({
  searchDictionaryExercises: vi.fn(async () => ({ items: [] })),
}));

import { executeAiTool } from "../ai/tools/tool-executor.js";
import { searchDictionaryExercises } from "../training/dictionary-service.js";
import { runMockAssistantTurn } from "./assistant-orchestrator-service.js";
import { runAssistantProvider } from "./provider-adapter.js";
import type {
  LlmIntentClassification,
  LlmIntentRouter,
} from "./llm-intent-router.js";

const mockedExecuteAiTool = vi.mocked(executeAiTool);
const mockedRunAssistantProvider = vi.mocked(runAssistantProvider);
const mockedSearchDictionaryExercises = vi.mocked(searchDictionaryExercises);

function createRouter(): LlmIntentRouter {
  const classify = vi.fn<(message: string) => Promise<LlmIntentClassification>>(
    async () => ({
      intent: "weekly_report",
      call: { attempted: true, errored: false, provider: "groq", model: null },
    }),
  );

  return {
    classify,
  };
}

describe("runMockAssistantTurn safety gate", () => {
  const originalSafetyGate = process.env.ASSISTANT_SAFETY_GATE;

  beforeEach(() => {
    vi.clearAllMocks();
    restoreSafetyGateEnv();
  });

  afterEach(() => {
    restoreSafetyGateEnv();
  });

  function restoreSafetyGateEnv(): void {
    if (originalSafetyGate === undefined) {
      delete process.env.ASSISTANT_SAFETY_GATE;
    } else {
      process.env.ASSISTANT_SAFETY_GATE = originalSafetyGate;
    }
  }

  it("short-circuits medical boundary messages before router, provider, tools, and RAG", async () => {
    const router = createRouter();
    const events: string[] = [];

    const { response, telemetry } = await runMockAssistantTurn(
      "user-1",
      {
        mode: "auto",
        message: "我膝盖疼，下周还能练腿吗",
        start_date: "2026-05-19",
        end_date: "2026-06-17",
      },
      {
        intentRouter: router,
        onEvent: (event) => {
          events.push(event.type);
        },
      },
    );

    expect(response.intent).toBe("unsupported");
    expect(response.tool_calls).toEqual([]);
    expect(response).not.toHaveProperty("telemetry");
    expect(response).not.toHaveProperty("safety");
    expect(response.answer.summary).toContain("不能诊断");
    expect(telemetry).toEqual({
      safety: {
        boundary: "medical_boundary",
        reason: "ambiguous_pain_or_symptom",
      },
    });
    expect(router.classify).not.toHaveBeenCalled();
    expect(mockedSearchDictionaryExercises).not.toHaveBeenCalled();
    expect(mockedRunAssistantProvider).not.toHaveBeenCalled();
    expect(mockedExecuteAiTool).not.toHaveBeenCalled();
    expect(events).not.toContain("retrieving");
    expect(events).toContain("structured_output");
    expect(events).toContain("done");
  });

  it("lets prior routing continue when ASSISTANT_SAFETY_GATE is explicitly disabled", async () => {
    process.env.ASSISTANT_SAFETY_GATE = "off";

    const { response, telemetry } = await runMockAssistantTurn("user-1", {
      mode: "auto",
      message: "帮我做一份本周训练报告，膝盖疼",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });

    expect(response.intent).toBe("weekly_report");
    expect(response.tool_calls).toEqual([
      expect.objectContaining({
        tool_name: "get_weekly_training_report",
        status: "success",
      }),
    ]);
    expect(telemetry.safety).toBeUndefined();
    expect(mockedExecuteAiTool).toHaveBeenCalledTimes(1);
  });
});
