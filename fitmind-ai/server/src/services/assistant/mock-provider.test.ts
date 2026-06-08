import { describe, expect, it } from "vitest";

import { runMockProvider } from "./mock-provider.js";
import type { AssistantProviderRequest } from "./provider-types.js";

function createRequest(message: string): AssistantProviderRequest {
  return {
    conversation: {
      user_message: message,
    },
    assistant_context: {
      mode: "next_week_plan",
      start_date: "2026-05-01",
      end_date: "2026-05-15",
      exercise_id: "exercise-1",
    },
    allowed_tools: [
      {
        name: "get_weekly_training_report",
        description: "Return one deterministic weekly training coach report.",
        input_fields: ["start_date", "end_date", "exercise_id"],
      },
    ],
    simulation: {
      scenario: "default",
      normalized_message: "",
    },
  };
}

describe("mock assistant provider", () => {
  it("calls the weekly report tool for next-week plan synonyms", async () => {
    const response = await runMockProvider(
      createRequest("给我一个下周训练的草程"),
    );

    expect(response).toMatchObject({
      kind: "tool_call",
      tool_name: "get_weekly_training_report",
    });
  });
});
