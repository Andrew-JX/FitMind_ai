import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runGroqChatCompletion } from "./groq-chat-client.js";

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

function mockFetchThrows(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("network down");
    }),
  );
}

const baseRequest = {
  messages: [{ role: "user" as const, content: "hi" }],
  maxTokens: 64,
  temperature: 0,
};

describe("runGroqChatCompletion", () => {
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

  it("parses content, tool call, usage, and the actual provider/model on success", async () => {
    mockFetchOnce(200, {
      choices: [
        {
          message: {
            content: "hello",
            tool_calls: [{ function: { name: "t", arguments: "{}" } }],
          },
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
    });

    const result = await runGroqChatCompletion(baseRequest);

    expect(result.ok).toBe(true);
    expect(result.attempted).toBe(true);
    expect(result.provider).toBe("groq");
    expect(result.model).toBe("llama-3.3-70b-versatile");
    expect(result.content).toBe("hello");
    expect(result.toolCall).toEqual({ name: "t", arguments: "{}" });
    expect(result.usage).toEqual({
      prompt_tokens: 5,
      completion_tokens: 2,
      total_tokens: 7,
    });
  });

  it("keeps ok with usage undefined when the usage shape is invalid (lenient usage)", async () => {
    mockFetchOnce(200, {
      choices: [{ message: { content: "hello" } }],
      usage: { prompt_tokens: "bad" },
    });

    const result = await runGroqChatCompletion(baseRequest);

    expect(result.ok).toBe(true);
    expect(result.content).toBe("hello");
    expect(result.usage).toBeUndefined();
  });

  it("drops usage that is non-integer or negative (int().nonnegative())", async () => {
    mockFetchOnce(200, {
      choices: [{ message: { content: "hello" } }],
      usage: { prompt_tokens: 1.5, completion_tokens: -2, total_tokens: 3 },
    });

    const result = await runGroqChatCompletion(baseRequest);

    expect(result.ok).toBe(true);
    expect(result.usage).toBeUndefined();
  });

  it("returns ok=false with a message on an HTTP error", async () => {
    mockFetchOnce(429, { error: { message: "rate limited" } });

    const result = await runGroqChatCompletion(baseRequest);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(429);
    expect(result.errorMessage).toContain("rate limited");
  });

  it("returns ok=false when the core response shape is unexpected", async () => {
    mockFetchOnce(200, { choices: [] });

    const result = await runGroqChatCompletion(baseRequest);

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/unexpected response shape/u);
  });

  it("returns ok=false with status 0 when fetch throws", async () => {
    mockFetchThrows();

    const result = await runGroqChatCompletion(baseRequest);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.attempted).toBe(true);
  });

  it("returns attempted=false and never calls fetch when GROQ_API_KEY is missing", async () => {
    delete process.env.GROQ_API_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await runGroqChatCompletion(baseRequest);

    expect(result.ok).toBe(false);
    expect(result.attempted).toBe(false);
    expect(result.model).toBeNull();
    expect(result.errorMessage).toMatch(/GROQ_API_KEY/u);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
