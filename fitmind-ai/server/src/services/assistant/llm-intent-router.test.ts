import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGroqIntentRouter } from "./llm-intent-router.js";

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

function completion(content: string): unknown {
  return { choices: [{ message: { content } }] };
}

describe("createGroqIntentRouter", () => {
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

  it("returns the routed intent (attempted, not errored) for a valid label, with usage", async () => {
    mockFetchOnce(200, {
      choices: [{ message: { content: "recommendation" } }],
      usage: { prompt_tokens: 30, completion_tokens: 2, total_tokens: 32 },
    });

    const result = await createGroqIntentRouter().classify("明天练啥");

    expect(result.intent).toBe("recommendation");
    expect(result.attempted).toBe(true);
    expect(result.errored).toBe(false);
    expect(result.usage).toEqual({
      prompt_tokens: 30,
      completion_tokens: 2,
      total_tokens: 32,
    });
  });

  it("tolerates surrounding whitespace/punctuation in the label", async () => {
    mockFetchOnce(200, completion("  Unsupported.\n"));

    const result = await createGroqIntentRouter().classify("1+1等于几");

    expect(result.intent).toBe("unsupported");
  });

  it("returns null intent (attempted, not errored) for an unrecognized label", async () => {
    mockFetchOnce(200, completion("definitely_not_an_intent"));

    const result = await createGroqIntentRouter().classify("...");

    expect(result.intent).toBeNull();
    expect(result.attempted).toBe(true);
    expect(result.errored).toBe(false);
  });

  it("returns null intent and marks errored on an HTTP error", async () => {
    mockFetchOnce(429, { error: { message: "rate limited" } });

    const result = await createGroqIntentRouter().classify("明天练啥");

    expect(result.intent).toBeNull();
    expect(result.attempted).toBe(true);
    expect(result.errored).toBe(true);
  });

  it("does not mark errored (or attempted) when GROQ_API_KEY is missing", async () => {
    delete process.env.GROQ_API_KEY;
    mockFetchOnce(200, completion("recommendation"));

    const result = await createGroqIntentRouter().classify("明天练啥");

    expect(result.intent).toBeNull();
    expect(result.attempted).toBe(false);
    expect(result.errored).toBe(false);
  });
});
