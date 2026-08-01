import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ER-2D regression: a data-bearing answer must state the range it actually
 * covers.
 *
 * The canned ranges below are one week long on purpose. Before this batch,
 * three answers asserted "最近 30 天" in prose no matter what the date resolver
 * produced, and two more described their window as "最近这段时间" without ever
 * naming it. Both shapes hide the defect class that shipped once already: an
 * answer whose numbers are real but whose stated window is not.
 */
const { CANNED_CONTEXT, CANNED_PROGRESS, CANNED_SUMMARY } = vi.hoisted(() => ({
  CANNED_SUMMARY: {
    range: { start_date: "2026-07-26", end_date: "2026-08-01" },
    totals: {
      workout_count: 1,
      set_count: 8,
      total_reps: 58,
      total_volume: 4340,
    },
    by_exercise: [{ exercise_name: "高位下拉", total_volume: 2900 }],
    evidence: {
      workout_ids: ["11111111-1111-1111-1111-111111111111"],
      set_ids: ["22222222-2222-2222-2222-222222222222"],
      calculation_rules: ["training_summary_aggregation"],
    },
  },
  CANNED_PROGRESS: {
    range: { start_date: "2026-07-26", end_date: "2026-08-01" },
    exercise: {
      exercise_id: "33333333-3333-4333-8333-333333333333",
      exercise_name: "杠铃卧推",
    },
    totals: {
      workout_count: 2,
      set_count: 14,
      total_reps: 84,
      total_volume: 4800,
      max_weight_kg: 90,
      estimated_1rm_kg: 102,
    },
    sessions: [{ performed_at: "2026-07-29T10:00:00.000Z" }],
    evidence: {
      workout_ids: ["11111111-1111-1111-1111-111111111111"],
      set_ids: ["22222222-2222-2222-2222-222222222222"],
      calculation_rules: ["exercise_progress_aggregation"],
    },
  },
  CANNED_CONTEXT: {
    range: { start_date: "2026-07-26", end_date: "2026-08-01" },
    summary: {
      workout_count: 3,
      set_count: 18,
      by_exercise: [
        { exercise_name: "高位下拉", total_volume: 2900 },
        { exercise_name: "杠铃卧推", total_volume: 1400 },
      ],
    },
    recent_workouts: [{ performed_at: "2026-07-29T10:00:00.000Z" }],
    evidence: {
      workout_ids: ["11111111-1111-1111-1111-111111111111"],
      set_ids: ["22222222-2222-2222-2222-222222222222"],
      calculation_rules: ["recommendation_context_aggregation"],
    },
  },
}));

vi.mock("./provider-adapter.js", () => ({
  runAssistantProvider: vi.fn(async () => ({
    kind: "message",
    message: "这是一段概述……",
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
  executeAiTool: vi.fn(async () => CANNED_SUMMARY),
}));

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
  searchDictionaryExercises: vi.fn(async () => ({ items: [] })),
}));

// Plateau diagnosis pairs tool evidence with RAG sources; this file is about
// the range label, so retrieval is stubbed out rather than reaching a database.
vi.mock("../rag/knowledge-retriever.js", () => ({
  retrieveKnowledgeChunks: vi.fn(async () => []),
  filterRelevantKnowledgeChunks: vi.fn(() => []),
  tokenizeKnowledgeQuery: vi.fn(() => []),
}));

vi.mock("../athlete-profile-service.js", () => ({
  getAthleteProfile: vi.fn(async () => null),
}));

vi.mock("../planned-workout-service.js", () => ({
  getPlanAdherenceContextForPlanner: vi.fn(async () => null),
}));

import { runMockAssistantTurn } from "./assistant-orchestrator-service.js";
import { executeAiTool } from "../ai/tools/tool-executor.js";

const mockedExecuteAiTool = vi.mocked(executeAiTool);

const RANGE_LABEL = "统计范围：2026-07-26 到 2026-08-01";

/** Every answer surface a user reads, flattened for whole-answer assertions. */
function readAnswerText(answer: {
  summary: string;
  bullets: string[];
  conclusion?: string | undefined;
  recommendation?: string | undefined;
}): string {
  return [
    answer.summary,
    ...answer.bullets,
    answer.conclusion ?? "",
    answer.recommendation ?? "",
  ].join("\n");
}

describe("runMockAssistantTurn — answers state their real range (ER-2D)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedExecuteAiTool.mockReset();
  });

  it("labels the training overview with the tool result range", async () => {
    mockedExecuteAiTool.mockResolvedValue(CANNED_SUMMARY);

    const { response } = await runMockAssistantTurn("user-1", {
      mode: "training_overview",
      message: "本周练得怎么样",
      start_date: "2026-07-26",
      end_date: "2026-08-01",
    });

    expect(readAnswerText(response.answer)).toContain(RANGE_LABEL);
    expect(response.faithfulness?.status).toBe("verified");
  });

  it("labels exercise progress with the tool result range", async () => {
    mockedExecuteAiTool.mockResolvedValue(CANNED_PROGRESS);

    const { response } = await runMockAssistantTurn("user-1", {
      mode: "exercise_progress",
      message: "杠铃卧推最近有没有进步",
      exercise_id: CANNED_PROGRESS.exercise.exercise_id,
      start_date: "2026-07-26",
      end_date: "2026-08-01",
    });

    expect(readAnswerText(response.answer)).toContain(RANGE_LABEL);
    expect(response.faithfulness?.status).toBe("verified");
  });

  it("labels plateau diagnosis with the tool result range", async () => {
    mockedExecuteAiTool.mockResolvedValue(CANNED_PROGRESS);

    const { response } = await runMockAssistantTurn("user-1", {
      mode: "plateau_diagnosis",
      message: "杠铃卧推是不是平台期了",
      exercise_id: CANNED_PROGRESS.exercise.exercise_id,
      start_date: "2026-07-26",
      end_date: "2026-08-01",
    });

    expect(readAnswerText(response.answer)).toContain(RANGE_LABEL);
  });

  // The first three used to assert a 30-day window in prose while running on
  // whatever range the turn resolved; the last two named no window at all.
  it.each([
    ["next_training_focus"],
    ["muscle_balance"],
    ["training_imbalance"],
    ["recovery_check"],
    ["evidence_explain"],
  ] as const)(
    "labels the %s answer with the tool result range and claims no fixed window",
    async (mode) => {
      mockedExecuteAiTool.mockResolvedValue(CANNED_CONTEXT);

      const { response } = await runMockAssistantTurn("user-1", {
        mode,
        message: "这周我该练什么",
        start_date: "2026-07-26",
        end_date: "2026-08-01",
      });

      const answerText = readAnswerText(response.answer);

      expect(answerText).toContain(RANGE_LABEL);
      // Regression guard: prose must not name a window of its own.
      expect(answerText).not.toContain("30 天");
      // The range dates trace back to the tool output, so adding the label
      // introduces no unverified number of its own.
      expect(response.faithfulness?.unverifiedClaims ?? []).not.toContain(
        "2026",
      );
    },
  );
});
