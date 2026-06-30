import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createOpenAiCompatibleIntentRouter } from "./llm-intent-router.js";

function mockFetchOnce(
  status: number,
  body: unknown,
): ReturnType<typeof vi.fn> {
  const fetchSpy = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

function completion(content: string): unknown {
  return { choices: [{ message: { content } }] };
}

describe("createOpenAiCompatibleIntentRouter", () => {
  const originalAssistantProvider = process.env.ASSISTANT_PROVIDER;
  const originalKey = process.env.GROQ_API_KEY;
  const originalCompatBaseUrl = process.env.OPENAI_COMPAT_BASE_URL;
  const originalCompatModel = process.env.OPENAI_COMPAT_MODEL;
  const originalCompatApiKey = process.env.OPENAI_COMPAT_API_KEY;

  beforeEach(() => {
    process.env.ASSISTANT_PROVIDER = "groq";
    process.env.GROQ_API_KEY = "test-groq-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreEnv("ASSISTANT_PROVIDER", originalAssistantProvider);
    if (originalKey === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = originalKey;
    }
    restoreEnv("OPENAI_COMPAT_BASE_URL", originalCompatBaseUrl);
    restoreEnv("OPENAI_COMPAT_MODEL", originalCompatModel);
    restoreEnv("OPENAI_COMPAT_API_KEY", originalCompatApiKey);
  });

  it("returns the routed intent (attempted, not errored) for a valid label, with usage", async () => {
    mockFetchOnce(200, {
      choices: [{ message: { content: "recommendation" } }],
      usage: { prompt_tokens: 30, completion_tokens: 2, total_tokens: 32 },
    });

    const result =
      await createOpenAiCompatibleIntentRouter().classify("明天练啥");

    expect(result.intent).toBe("recommendation");
    expect(result.call).toEqual({
      attempted: true,
      errored: false,
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      usage: { prompt_tokens: 30, completion_tokens: 2, total_tokens: 32 },
    });
  });

  it("tolerates surrounding whitespace/punctuation in the label", async () => {
    mockFetchOnce(200, completion("  Unsupported.\n"));

    const result =
      await createOpenAiCompatibleIntentRouter().classify("1+1等于几");

    expect(result.intent).toBe("unsupported");
  });

  it("returns null intent (attempted, not errored) for an unrecognized label", async () => {
    mockFetchOnce(200, completion("definitely_not_an_intent"));

    const result = await createOpenAiCompatibleIntentRouter().classify("...");

    expect(result.intent).toBeNull();
    expect(result.call.attempted).toBe(true);
    expect(result.call.errored).toBe(false);
  });

  it("returns null intent and marks errored on an HTTP error", async () => {
    mockFetchOnce(429, { error: { message: "rate limited" } });

    const result =
      await createOpenAiCompatibleIntentRouter().classify("明天练啥");

    expect(result.intent).toBeNull();
    expect(result.call.attempted).toBe(true);
    expect(result.call.errored).toBe(true);
  });

  it("does not mark errored (or attempted) when GROQ_API_KEY is missing", async () => {
    delete process.env.GROQ_API_KEY;
    mockFetchOnce(200, completion("recommendation"));

    const result =
      await createOpenAiCompatibleIntentRouter().classify("明天练啥");

    expect(result.intent).toBeNull();
    expect(result.call.attempted).toBe(false);
    expect(result.call.errored).toBe(false);
    expect(result.call.model).toBeNull();
  });

  it("uses BYO config when the assistant provider is openai_compatible", async () => {
    process.env.ASSISTANT_PROVIDER = "openai_compatible";
    process.env.OPENAI_COMPAT_BASE_URL = "https://api.deepseek.com";
    process.env.OPENAI_COMPAT_MODEL = "deepseek-chat";
    process.env.OPENAI_COMPAT_API_KEY = "test-openai-key";
    const fetchSpy = mockFetchOnce(200, completion("recommendation"));

    const result =
      await createOpenAiCompatibleIntentRouter().classify("明天练啥");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        headers: {
          authorization: "Bearer test-openai-key",
          "content-type": "application/json",
        },
      }),
    );
    expect(result.intent).toBe("recommendation");
    expect(result.call.provider).toBe("openai_compatible");
    expect(result.call.model).toBe("deepseek-chat");
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
