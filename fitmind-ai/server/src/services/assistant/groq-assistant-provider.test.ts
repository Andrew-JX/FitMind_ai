import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  runGroqAnswerPhrasing,
  runGroqAssistantProvider,
} from "./groq-assistant-provider.js";
import type { AssistantProviderRequest } from "./provider-types.js";

const request: AssistantProviderRequest = {
  conversation: { user_message: "帮我做本周训练报告" },
  assistant_context: {
    mode: "auto",
    start_date: "2026-05-19",
    end_date: "2026-06-17",
    exercise_id: null,
  },
  allowed_tools: [
    {
      name: "get_weekly_training_report",
      description: "Weekly training report.",
      input_fields: ["start_date", "end_date"],
    },
  ],
  simulation: { scenario: "default", normalized_message: "帮我做本周训练报告" },
};

function mockFetchOnce(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })),
  );
}

describe("runGroqAssistantProvider", () => {
  const originalKey = process.env.GROQ_API_KEY;

  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-groq-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = originalKey;
    }
  });

  it("maps an OpenAI-style tool call to a provider tool_call with parsed args and usage", async () => {
    mockFetchOnce(200, {
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                function: {
                  name: "get_weekly_training_report",
                  arguments:
                    '{"start_date":"2026-05-19","end_date":"2026-06-17"}',
                },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 120, completion_tokens: 18, total_tokens: 138 },
    });

    const result = await runGroqAssistantProvider(request);

    expect(result).toEqual({
      kind: "tool_call",
      tool_name: "get_weekly_training_report",
      tool_args: { start_date: "2026-05-19", end_date: "2026-06-17" },
      usage: { prompt_tokens: 120, completion_tokens: 18, total_tokens: 138 },
    });
  });

  it("carries usage on a plain text message and leaves it undefined when absent", async () => {
    mockFetchOnce(200, {
      choices: [{ message: { content: "渐进超负荷指逐步加量。" } }],
      usage: { prompt_tokens: 60, completion_tokens: 12, total_tokens: 72 },
    });

    const withUsage = await runGroqAssistantProvider(request);
    expect(withUsage).toEqual({
      kind: "message",
      message: "渐进超负荷指逐步加量。",
      usage: { prompt_tokens: 60, completion_tokens: 12, total_tokens: 72 },
    });

    mockFetchOnce(200, {
      choices: [{ message: { content: "渐进超负荷指逐步加量。" } }],
    });

    const withoutUsage = await runGroqAssistantProvider(request);
    expect(withoutUsage).toEqual({
      kind: "message",
      message: "渐进超负荷指逐步加量。",
      usage: undefined,
    });
  });

  it("maps a plain text completion to a message", async () => {
    mockFetchOnce(200, {
      choices: [{ message: { content: "  渐进超负荷指逐步加量。  " } }],
    });

    const result = await runGroqAssistantProvider(request);

    expect(result).toEqual({
      kind: "message",
      message: "渐进超负荷指逐步加量。",
    });
  });

  it("normalizes an HTTP error into a provider error", async () => {
    mockFetchOnce(429, {
      error: { message: "rate limited", type: "rate_limit" },
    });

    const result = await runGroqAssistantProvider(request);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.error_code).toBe("GROQ_PROVIDER_ERROR");
      expect(result.message).toContain("rate limited");
    }
  });

  it("errors when the response has neither text nor a tool call", async () => {
    mockFetchOnce(200, { choices: [{ message: { content: "" } }] });

    const result = await runGroqAssistantProvider(request);

    expect(result.kind).toBe("error");
  });

  it("keeps a valid tool_call even when the usage shape is invalid (P2b: usage never breaks business)", async () => {
    mockFetchOnce(200, {
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  name: "get_weekly_training_report",
                  arguments:
                    '{"start_date":"2026-05-19","end_date":"2026-06-17"}',
                },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: "oops" },
    });

    const result = await runGroqAssistantProvider(request);

    expect(result).toEqual({
      kind: "tool_call",
      tool_name: "get_weekly_training_report",
      tool_args: { start_date: "2026-05-19", end_date: "2026-06-17" },
      usage: undefined,
    });
  });

  it("returns a provider error (not a throw) when GROQ_API_KEY is missing", async () => {
    delete process.env.GROQ_API_KEY;

    const result = await runGroqAssistantProvider(request);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toMatch(/GROQ_API_KEY/u);
    }
  });
});

describe("runGroqAnswerPhrasing (Slice 11.3b)", () => {
  const originalKey = process.env.GROQ_API_KEY;
  const phrasingInput = {
    draftSummary: "本周共记录 4 次训练，20 组。",
    supportingFacts: ["本周训练频率：4 次。"],
  };

  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-groq-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = originalKey;
    }
  });

  it("returns the re-phrased summary, usage, and call telemetry on success", async () => {
    mockFetchOnce(200, {
      choices: [{ message: { content: "  这周你练了 4 次，一共 20 组。  " } }],
      usage: { prompt_tokens: 80, completion_tokens: 20, total_tokens: 100 },
    });

    const result = await runGroqAnswerPhrasing(phrasingInput);

    expect(result).toEqual({
      summary: "这周你练了 4 次，一共 20 组。",
      usage: { prompt_tokens: 80, completion_tokens: 20, total_tokens: 100 },
      attempted: true,
      errored: false,
    });
  });

  it("falls back to the draft and marks attempted+errored on an HTTP error", async () => {
    mockFetchOnce(429, { error: { message: "rate limited" } });

    const result = await runGroqAnswerPhrasing(phrasingInput);

    expect(result.summary).toBe(phrasingInput.draftSummary);
    expect(result.attempted).toBe(true);
    expect(result.errored).toBe(true);
  });

  it("falls back to the draft (attempted, not errored) on an empty completion", async () => {
    mockFetchOnce(200, { choices: [{ message: { content: "   " } }] });

    const result = await runGroqAnswerPhrasing(phrasingInput);

    expect(result.summary).toBe(phrasingInput.draftSummary);
    expect(result.attempted).toBe(true);
    expect(result.errored).toBe(false);
  });

  it("falls back to the draft (not attempted) when GROQ_API_KEY is missing", async () => {
    delete process.env.GROQ_API_KEY;

    const result = await runGroqAnswerPhrasing(phrasingInput);

    expect(result.summary).toBe(phrasingInput.draftSummary);
    expect(result.attempted).toBe(false);
    expect(result.errored).toBe(false);
  });
});
