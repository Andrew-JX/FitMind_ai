import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ER-3 integration pin.
 *
 * The pure classifier is not enough evidence: the orchestrator decides what
 * counts as a training signal before calling it, and it originally passed any
 * non-absent entity status. Since the entity resolver labels *any* leftover
 * unknown phrase as `unresolved`, off-topic messages arrived carrying a fake
 * training signal and the spec's reference case (生酮饮食) came back as
 * "unrecognized" while every unit test stayed green. These cases run the real
 * turn.
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

vi.mock("../ai/tools/tool-executor.js", () => ({
  executeAiTool: vi.fn(async () => null),
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

vi.mock("../athlete-profile-service.js", () => ({
  getAthleteProfile: vi.fn(async () => null),
}));

vi.mock("../planned-workout-service.js", () => ({
  getPlanAdherenceContextForPlanner: vi.fn(async () => null),
}));

import { runMockAssistantTurn } from "./assistant-orchestrator-service.js";
import { createChatMessage } from "../../db/chat-repository.js";

const mockedCreateChatMessage = vi.mocked(createChatMessage);

async function runTurn(message: string) {
  const { response } = await runMockAssistantTurn("user-1", {
    mode: "auto",
    message,
    start_date: "2026-07-26",
    end_date: "2026-08-01",
  });

  return response;
}

describe("runMockAssistantTurn — layered refusals (ER-3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses 生酮饮食 as outside the product, not as misunderstood", async () => {
    const response = await runTurn("生酮饮食有用吗");

    expect(response.intent).toBe("unsupported");
    expect(response.answer.summary).toContain("不在 FitMind 的范围内");
    expect(response.answer.summary).not.toContain("没识别");
  });

  it.each(["我女朋友生气了怎么办", "帮我推荐一部电影"])(
    "refuses %s as outside the product",
    async (message) => {
      const response = await runTurn(message);

      expect(response.answer.summary).toContain("不在 FitMind 的范围内");
    },
  );

  it("tells an unparsed training question that it was not understood", async () => {
    const response = await runTurn("帮我看看训练");

    expect(response.intent).toBe("unsupported");
    expect(response.answer.summary).toContain("和训练有关");
    expect(response.answer.bullets.join(" ")).toContain("本周训练报告");
  });

  // Cross-version contract: a rollback must still be able to read contexts this
  // build persisted, so the stored reason stays inside the pre-ER-3 value set
  // even though the response carries the layered one.
  it("persists a legacy clarification reason while answering with the new one", async () => {
    const response = await runTurn("这个动作最近有进步吗");

    expect(response.clarification).toMatchObject({
      kind: "exercise",
      reason: "missing",
    });

    const persistedAssistantMessage = mockedCreateChatMessage.mock.calls
      .map(([call]) => call)
      .find((call) => call.role === "assistant");
    const persistedReason = (
      persistedAssistantMessage?.metadata as
        | { clarification_context?: { clarification?: { reason?: string } } }
        | undefined
    )?.clarification_context?.clarification?.reason;

    expect(persistedReason).toBe("unresolved");
  });
});
