import { describe, expect, it, vi } from "vitest";

const hallucinatedTelemetry = {
  attempted: true,
  errored: false,
  provider: "groq" as const,
  model: "llama-3.3-70b-versatile",
  usage: { prompt_tokens: 7, completion_tokens: 1, total_tokens: 8 },
};

vi.mock("./provider-config.js", () => ({
  getConfiguredAssistantProvider: vi.fn(() => "mock"),
}));

// The underlying provider returns a tool_call for a tool NOT in allowed_tools,
// with per-call telemetry attached (as Groq would).
vi.mock("./mock-provider.js", () => ({
  mockAssistantProvider: {
    run: vi.fn(async () => ({
      kind: "tool_call",
      tool_name: "not_an_allowed_tool",
      tool_args: {},
      telemetry: hallucinatedTelemetry,
    })),
  },
}));

import { runAssistantProvider } from "./provider-adapter.js";
import type { AssistantProviderRequest } from "./provider-types.js";

const request: AssistantProviderRequest = {
  conversation: { user_message: "x" },
  assistant_context: {
    mode: "auto",
    start_date: "2026-05-19",
    end_date: "2026-06-17",
    exercise_id: null,
  },
  allowed_tools: [
    {
      name: "get_recommendation_context",
      description: "",
      input_fields: ["start_date", "end_date"],
    },
  ],
  simulation: { scenario: "default", normalized_message: "" },
};

describe("runAssistantProvider — ensureAllowedTool", () => {
  it("rejects a hallucinated tool name but preserves its call telemetry", async () => {
    const result = await runAssistantProvider(request);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.error_code).toBe("PROVIDER_ADAPTER_ERROR");
      expect(result.telemetry).toEqual(hallucinatedTelemetry);
    }
  });
});
