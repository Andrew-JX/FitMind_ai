import { describe, expect, it } from "vitest";

import { runMockProvider } from "./mock-provider.js";
import type {
  AssistantIntentMode,
  AssistantProviderRequest,
} from "./provider-types.js";

function createRequest(
  mode: AssistantIntentMode,
  overrides: {
    message?: string;
    exercise_id?: string | null;
  } = {},
): AssistantProviderRequest {
  return {
    conversation: {
      user_message: overrides.message ?? "任意消息文本",
    },
    assistant_context: {
      mode,
      start_date: "2026-05-01",
      end_date: "2026-05-15",
      exercise_id:
        overrides.exercise_id === undefined
          ? "exercise-1"
          : overrides.exercise_id,
    },
    allowed_tools: [],
    simulation: {
      scenario: "default",
      normalized_message: "",
    },
  };
}

describe("mock assistant provider (Slice 11.3a — single-track, mode-driven)", () => {
  it("selects the tool from the resolved mode, not the message text", async () => {
    const cases: Array<[AssistantIntentMode, string]> = [
      ["weekly_report", "get_weekly_training_report"],
      ["next_week_plan", "get_weekly_training_report"],
      ["training_overview", "get_training_summary"],
      ["exercise_progress", "get_exercise_progress"],
      ["plateau_diagnosis", "get_exercise_progress"],
      ["next_training_focus", "get_recommendation_context"],
      ["muscle_balance", "get_recommendation_context"],
      ["training_imbalance", "get_recommendation_context"],
      ["recovery_check", "get_recommendation_context"],
      ["evidence_explain", "get_recommendation_context"],
    ];

    for (const [mode, expectedTool] of cases) {
      const response = await runMockProvider(createRequest(mode));

      expect(response).toMatchObject({
        kind: "tool_call",
        tool_name: expectedTool,
      });
    }
  });

  it("ignores the message text entirely: same message, different mode → different tool", async () => {
    const message = "帮我看看本周训练报告"; // would have routed to weekly_report under the old shadow classifier

    const asOverview = await runMockProvider(
      createRequest("training_overview", { message }),
    );
    const asWeekly = await runMockProvider(
      createRequest("weekly_report", { message }),
    );

    expect(asOverview).toMatchObject({
      kind: "tool_call",
      tool_name: "get_training_summary",
    });
    expect(asWeekly).toMatchObject({
      kind: "tool_call",
      tool_name: "get_weekly_training_report",
    });
  });

  it("asks the user to pick an exercise for exercise-scoped modes without an exercise_id", async () => {
    const response = await runMockProvider(
      createRequest("exercise_progress", { exercise_id: null }),
    );

    expect(response.kind).toBe("message");
  });

  it("returns a guidance message for the unsupported mode", async () => {
    const response = await runMockProvider(
      createRequest("unsupported", { exercise_id: null }),
    );

    expect(response.kind).toBe("message");
  });

  it("still honors the deterministic simulation hooks (message / error)", async () => {
    const messageResponse = await runMockProvider({
      ...createRequest("training_overview"),
      simulation: { scenario: "message", normalized_message: "自定义说明" },
    });
    const errorResponse = await runMockProvider({
      ...createRequest("training_overview"),
      simulation: { scenario: "error", normalized_message: "模拟错误" },
    });

    expect(messageResponse).toEqual({ kind: "message", message: "自定义说明" });
    expect(errorResponse).toMatchObject({
      kind: "error",
      error_code: "MOCK_PROVIDER_ERROR",
    });
  });
});
