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

  it("returns the routed intent for a valid label", async () => {
    mockFetchOnce(200, completion("recommendation"));

    expect(await createGroqIntentRouter().classify("明天练啥")).toBe(
      "recommendation",
    );
  });

  it("tolerates surrounding whitespace/punctuation in the label", async () => {
    mockFetchOnce(200, completion("  Unsupported.\n"));

    expect(await createGroqIntentRouter().classify("1+1等于几")).toBe(
      "unsupported",
    );
  });

  it("returns null for an unrecognized label", async () => {
    mockFetchOnce(200, completion("definitely_not_an_intent"));

    expect(await createGroqIntentRouter().classify("...")).toBeNull();
  });

  it("returns null on an HTTP error", async () => {
    mockFetchOnce(429, { error: { message: "rate limited" } });

    expect(await createGroqIntentRouter().classify("明天练啥")).toBeNull();
  });

  it("returns null when GROQ_API_KEY is missing (caller falls back)", async () => {
    delete process.env.GROQ_API_KEY;
    mockFetchOnce(200, completion("recommendation"));

    expect(await createGroqIntentRouter().classify("明天练啥")).toBeNull();
  });
});
