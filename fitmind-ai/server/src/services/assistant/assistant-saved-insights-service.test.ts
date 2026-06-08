import { describe, expect, it, vi } from "vitest";

import { HttpError } from "../../utils/http-error.js";
import {
  buildAssistantInsightShareText,
  deleteAssistantSavedInsight,
  getAssistantSavedInsight,
  listAssistantSavedInsights,
  saveAssistantInsightFromMessage,
  type AssistantSavedInsightSnapshot,
} from "./assistant-saved-insights-service.js";

const baseMessage = {
  id: "message-1",
  session_id: "session-1",
  role: "assistant" as const,
  content: [{ type: "text", text: "Assistant response text." }],
  structured_output: {
    intent: "weekly_report",
    answer: {
      summary: "This week has useful training evidence.",
      bullets: ["Three workouts were recorded."],
      evidence: {
        workout_ids: ["workout-1", "workout-2"],
        set_ids: ["set-1", "set-2", "set-3"],
        tool_names: ["get_weekly_training_report"],
        calculation_rules: ["weekly report rule"],
      },
      sources: [
        {
          title: "Progressive Overload",
          category: "training_principles",
        },
      ],
      limitations: ["Draft only, not a professional prescription."],
    },
  },
  usage: null,
  metadata: null,
  token_input: null,
  token_output: null,
  created_at: "2026-06-08T00:00:00.000Z",
};

function createDependencies(overrides: Record<string, unknown> = {}) {
  const row = {
    id: "insight-1",
    user_id: "user-1",
    message_id: "message-1",
    insight_type: "weekly_report" as const,
    title: "Weekly Training Report",
    summary: "This week has useful training evidence.",
    structured_snapshot: {
      message_text: "Assistant response text.",
      intent: "weekly_report",
      evidence: {
        workout_count: 2,
        set_count: 3,
        tool_names: ["get_weekly_training_report"],
        calculation_rule_count: 1,
      },
      sources: [
        {
          title: "Progressive Overload",
          category: "training_principles",
        },
      ],
      limitations: ["Draft only, not a professional prescription."],
      structured_output: {
        intent: "weekly_report",
        answer_summary: "This week has useful training evidence.",
        answer_bullets: ["Three workouts were recorded."],
      },
    },
    share_text: "FitMind Insight: Weekly Training Report",
    created_at: "2026-06-08T00:00:00.000Z",
    updated_at: "2026-06-08T00:00:00.000Z",
  };

  return {
    createInsight: vi.fn().mockResolvedValue(row),
    deleteInsight: vi.fn().mockResolvedValue(true),
    findInsight: vi.fn().mockResolvedValue(row),
    findMessage: vi.fn().mockResolvedValue(baseMessage),
    hasMessage: vi.fn().mockResolvedValue(false),
    listInsights: vi.fn().mockResolvedValue([row]),
    ...overrides,
  };
}

describe("assistant saved insights service", () => {
  it("saves an eligible assistant reply for the authenticated owner", async () => {
    const dependencies = createDependencies();

    const result = await saveAssistantInsightFromMessage(
      {
        messageId: "message-1",
        userId: "user-1",
      },
      dependencies,
    );

    expect(dependencies.createInsight).toHaveBeenCalledWith(
      expect.objectContaining({
        insightType: "weekly_report",
        messageId: "message-1",
        userId: "user-1",
      }),
    );
    expect(result.insight_type).toBe("weekly_report");
    expect(result.structured_snapshot.evidence.workout_count).toBe(2);
  });

  it("rejects unsupported assistant replies", async () => {
    const dependencies = createDependencies({
      findMessage: vi.fn().mockResolvedValue({
        ...baseMessage,
        structured_output: {
          intent: "unsupported",
          answer: {
            summary: "Nope.",
          },
        },
      }),
    });

    await expect(
      saveAssistantInsightFromMessage(
        {
          messageId: "message-1",
          userId: "user-1",
        },
        dependencies,
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    } satisfies Partial<HttpError>);
  });

  it("rejects user messages", async () => {
    const dependencies = createDependencies({
      findMessage: vi.fn().mockResolvedValue({
        ...baseMessage,
        role: "user",
      }),
    });

    await expect(
      saveAssistantInsightFromMessage(
        {
          messageId: "message-1",
          userId: "user-1",
        },
        dependencies,
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    } satisfies Partial<HttpError>);
  });

  it("distinguishes missing and cross-user message ids", async () => {
    const missingDependencies = createDependencies({
      findMessage: vi.fn().mockResolvedValue(null),
      hasMessage: vi.fn().mockResolvedValue(false),
    });
    const crossUserDependencies = createDependencies({
      findMessage: vi.fn().mockResolvedValue(null),
      hasMessage: vi.fn().mockResolvedValue(true),
    });

    await expect(
      saveAssistantInsightFromMessage(
        {
          messageId: "missing",
          userId: "user-1",
        },
        missingDependencies,
      ),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    } satisfies Partial<HttpError>);
    await expect(
      saveAssistantInsightFromMessage(
        {
          messageId: "other-user-message",
          userId: "user-1",
        },
        crossUserDependencies,
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    } satisfies Partial<HttpError>);
  });

  it("lists and returns only user-scoped saved insights", async () => {
    const dependencies = createDependencies();

    const list = await listAssistantSavedInsights("user-1", dependencies);
    const detail = await getAssistantSavedInsight(
      {
        id: "insight-1",
        userId: "user-1",
      },
      dependencies,
    );

    expect(dependencies.listInsights).toHaveBeenCalledWith("user-1");
    expect(dependencies.findInsight).toHaveBeenCalledWith("insight-1", "user-1");
    expect(list).toHaveLength(1);
    expect(detail.id).toBe("insight-1");
  });

  it("deletes saved insights with user scope", async () => {
    const dependencies = createDependencies();

    const result = await deleteAssistantSavedInsight(
      {
        id: "insight-1",
        userId: "user-1",
      },
      dependencies,
    );

    expect(dependencies.deleteInsight).toHaveBeenCalledWith(
      "insight-1",
      "user-1",
    );
    expect(result).toEqual({
      deleted: true,
      id: "insight-1",
    });
  });

  it("builds copy text with type, summary, evidence counts, sources, and limitations", () => {
    const snapshot: AssistantSavedInsightSnapshot = {
      message_text: "Assistant response text.",
      intent: "next_week_plan",
      evidence: {
        workout_count: 4,
        set_count: 16,
        tool_names: ["get_weekly_training_report"],
        calculation_rule_count: 2,
      },
      sources: [
        {
          title: "Volume Landmarks",
          category: "programming",
        },
      ],
      limitations: ["Draft only, not medical advice."],
      structured_output: {
        intent: "next_week_plan",
        answer_summary: "Keep next week conservative.",
        answer_bullets: [],
      },
    };

    const text = buildAssistantInsightShareText({
      snapshot,
      summary: "Keep next week conservative.",
      title: "Next-week Plan Draft",
    });

    expect(text).toContain("Type: next_week_plan");
    expect(text).toContain("Keep next week conservative.");
    expect(text).toContain("Workouts: 4");
    expect(text).toContain("Sets: 16");
    expect(text).toContain("Sources:");
    expect(text).toContain("Volume Landmarks");
    expect(text).toContain("Limitations:");
    expect(text).toContain("Draft only, not medical advice.");
  });
});
