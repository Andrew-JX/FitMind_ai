import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

/**
 * ER-EVAL harness.
 *
 * The goldens are checked against **real turns**, not against the resolver
 * functions they are supposed to be testing, and only on the resolved dates and
 * tool arguments — never on answer prose. The range-label bug survived a green
 * eval precisely because a golden answer said "本周共记录 4 次训练" while the
 * tool had been called with a 30-day window: the words were right and the
 * arguments were wrong.
 *
 * The suite stays offline, DB-free, network-free and zero-cost: persistence,
 * the provider, retrieval and the tool executor are all stubbed. It runs under
 * `pnpm verify` because module mocking is what makes a real turn reachable
 * without a database; the `pnpm eval` script has no probe and skips the check.
 */
const { EXERCISE_DICTIONARY } = vi.hoisted(() => ({
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
}));

vi.mock("./provider-adapter.js", () => ({
  runAssistantProvider: vi.fn(async () => ({
    kind: "message",
    message: "……",
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

vi.mock("../../db/chat-repository.js", () => ({
  createChatSession: vi.fn(async () => ({ id: "session-1" })),
  createChatMessage: vi.fn(async () => ({ id: "message-1" })),
  findChatMessageByIdForUser: vi.fn(async () => null),
  findChatSessionByIdForUser: vi.fn(async () => null),
  hasChatMessageById: vi.fn(async () => false),
  listMessagesForSession: vi.fn(async () => []),
}));

vi.mock("../training/dictionary-service.js", () => ({
  searchDictionaryExercises: vi.fn(async () => ({
    items: EXERCISE_DICTIONARY,
  })),
}));

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

vi.mock("../ai/tools/tool-executor.js", () => ({
  executeAiTool: vi.fn(async () => null),
}));

import { runMockAssistantTurn } from "./assistant-orchestrator-service.js";
import { executeAiTool } from "../ai/tools/tool-executor.js";
import {
  assistantEntityEvalCases,
  evaluateEntityResolution,
  runAssistantEval,
  ASSISTANT_ENTITY_EVAL_REFERENCE_ISO,
  type AssistantEntityEvalCase,
  type AssistantEntityTurnObservation,
} from "./assistant-eval.js";

const mockedExecuteAiTool = vi.mocked(executeAiTool);

/**
 * Build a tool result whose range echoes the arguments it was called with.
 *
 * @param args - Arguments the orchestrator passed to the tool
 * @returns Canned deterministic tool output
 */
function buildCannedToolResult(args: Record<string, unknown>): unknown {
  return {
    range: {
      start_date: String(args["start_date"]),
      end_date: String(args["end_date"]),
    },
    exercise: {
      exercise_id: args["exercise_id"] ?? null,
      exercise_name: "杠铃卧推",
    },
    totals: {
      workout_count: 1,
      set_count: 4,
      total_reps: 20,
      total_volume: 1000,
      max_weight_kg: 60,
      estimated_1rm_kg: 66,
    },
    summary: {
      workout_count: 1,
      set_count: 4,
      by_exercise: [{ exercise_name: "杠铃卧推", total_volume: 1000 }],
    },
    by_exercise: [{ exercise_name: "杠铃卧推", total_volume: 1000 }],
    sessions: [],
    recent_workouts: [],
    evidence: {
      workout_ids: ["11111111-1111-1111-1111-111111111111"],
      set_ids: ["22222222-2222-2222-2222-222222222222"],
      calculation_rules: ["training_summary_aggregation"],
    },
  };
}

/**
 * Run one golden case as a real turn and report only machine-checkable facts.
 *
 * @param testCase - Golden case to execute
 * @returns Tool calls and clarification state observed on the turn
 */
async function probeTurn(
  testCase: AssistantEntityEvalCase,
): Promise<AssistantEntityTurnObservation> {
  const toolCalls: Array<{
    toolName: string;
    args: Record<string, unknown>;
  }> = [];

  mockedExecuteAiTool.mockImplementation(
    async (_context: unknown, toolName: string, toolArgs: unknown) => {
      const args = (toolArgs ?? {}) as Record<string, unknown>;
      toolCalls.push({ toolName, args });

      return buildCannedToolResult(args);
    },
  );

  // No explicit start_date/end_date: an explicit window outranks time language
  // and would skip the resolution these goldens exist to check.
  const { response } = await runMockAssistantTurn("user-1", {
    mode: testCase.mode,
    message: testCase.message,
    timezone: testCase.timeZone,
  });

  const clarification = response.clarification ?? null;

  return {
    toolCalls,
    clarification:
      clarification === null
        ? null
        : {
            kind: clarification.kind,
            reason: clarification.reason,
            optionCount: clarification.options.length,
          },
  };
}

describe("ER-EVAL — entity and range goldens on real turns", () => {
  beforeAll(() => {
    // Only Date is faked: relative terms need a pinned "today", and faking the
    // timer queue as well would stall the turn's own awaits.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(ASSISTANT_ENTITY_EVAL_REFERENCE_ISO));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    mockedExecuteAiTool.mockReset();
  });

  it("resolves every golden case to the exact expected tool arguments", async () => {
    const result = await evaluateEntityResolution(
      assistantEntityEvalCases,
      probeTurn,
    );

    expect(result.failures).toEqual([]);
    expect(result.score).toBe(1);
    expect(result.total).toBe(assistantEntityEvalCases.length);
  });

  it("reports the entity check inside the full eval run when a probe is supplied", async () => {
    const report = await runAssistantEval({ entityTurnProbe: probeTurn });
    const entityCheck = report.checks.find(
      (check) => check.name === "entity_resolution",
    );

    expect(entityCheck?.score).toBe(1);
    expect(report.passed).toBe(true);
  });

  it("omits the entity check when no probe is supplied", async () => {
    const report = await runAssistantEval();

    expect(
      report.checks.some((check) => check.name === "entity_resolution"),
    ).toBe(false);
  });

  // The discipline itself, pinned: a golden must fail when the arguments are
  // wrong even though the turn produced a perfectly well-formed answer.
  it("fails a case whose resolved range does not match the golden", async () => {
    const result = await evaluateEntityResolution(
      [
        {
          id: "entity-deliberately-wrong",
          message: "本周练得怎么样",
          mode: "auto",
          timeZone: "Asia/Shanghai",
          expected: {
            kind: "tool",
            toolName: "get_training_summary",
            args: { start_date: "2026-07-03", end_date: "2026-08-01" },
          },
        },
      ],
      probeTurn,
    );

    expect(result.score).toBe(0);
    expect(result.failures[0]).toContain("expected start_date 2026-07-03");
  });

  // A single-field comparison would pass every one of these: the first tool
  // call is exactly right in all four, and the turn still did something the
  // golden never described.
  describe("the checker has no blind spot beyond the first tool call", () => {
    const goldenCase: AssistantEntityEvalCase = {
      id: "entity-blind-spot-probe",
      message: "本周练得怎么样",
      mode: "auto",
      timeZone: "Asia/Shanghai",
      expected: {
        kind: "tool",
        toolName: "get_training_summary",
        args: { start_date: "2026-07-26", end_date: "2026-08-01" },
      },
    };
    const correctCall = {
      toolName: "get_training_summary",
      args: { start_date: "2026-07-26", end_date: "2026-08-01" },
    };

    /**
     * Feed the checker a fixed observation instead of running a turn.
     *
     * @param observation - Observation to evaluate
     * @returns The check result for the single golden case
     */
    async function evaluateObservation(
      observation: AssistantEntityTurnObservation,
    ) {
      return evaluateEntityResolution([goldenCase], async () => observation);
    }

    it("accepts the exact observation the golden describes", async () => {
      const result = await evaluateObservation({
        toolCalls: [correctCall],
        clarification: null,
      });

      expect(result.failures).toEqual([]);
    });

    it("rejects an extra tool argument", async () => {
      const result = await evaluateObservation({
        toolCalls: [
          {
            toolName: "get_training_summary",
            args: { ...correctCall.args, exercise_id: "leaked-id" },
          },
        ],
        clarification: null,
      });

      expect(result.failures[0]).toContain("unexpected tool argument(s)");
    });

    it("rejects a second tool call", async () => {
      const result = await evaluateObservation({
        toolCalls: [
          correctCall,
          {
            toolName: "get_exercise_progress",
            args: { start_date: "2026-07-26", end_date: "2026-08-01" },
          },
        ],
        clarification: null,
      });

      expect(result.failures[0]).toContain("expected exactly 1 tool call");
    });

    it("rejects a clarification riding alongside a correct tool call", async () => {
      const result = await evaluateObservation({
        toolCalls: [correctCall],
        clarification: { kind: "exercise", reason: "missing", optionCount: 0 },
      });

      expect(result.failures[0]).toContain("also got a exercise clarification");
    });
  });
});
