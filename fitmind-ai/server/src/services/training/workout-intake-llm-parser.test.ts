import { afterEach, describe, expect, it, vi } from "vitest";

import { createWorkoutIntakeLlmParser } from "./workout-intake-llm-parser.js";

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

describe("createWorkoutIntakeLlmParser OpenAI-compatible providers", () => {
  const originalGroqKey = process.env.GROQ_API_KEY;
  const originalCompatBaseUrl = process.env.OPENAI_COMPAT_BASE_URL;
  const originalCompatModel = process.env.OPENAI_COMPAT_MODEL;
  const originalCompatApiKey = process.env.OPENAI_COMPAT_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreEnv("GROQ_API_KEY", originalGroqKey);
    restoreEnv("OPENAI_COMPAT_BASE_URL", originalCompatBaseUrl);
    restoreEnv("OPENAI_COMPAT_MODEL", originalCompatModel);
    restoreEnv("OPENAI_COMPAT_API_KEY", originalCompatApiKey);
  });

  it("selects BYO parser and posts to the configured OpenAI-compatible endpoint", async () => {
    process.env.OPENAI_COMPAT_BASE_URL = "https://api.deepseek.com";
    process.env.OPENAI_COMPAT_MODEL = "deepseek-chat";
    process.env.OPENAI_COMPAT_API_KEY = "test-openai-key";
    const fetchSpy = mockFetchOnce(200, {
      choices: [{ message: { content: '{"exercises":[],"warnings":[]}' } }],
    });
    const parser = createWorkoutIntakeLlmParser("openai_compatible");

    await expect(parser?.({ text: "今天深蹲三组" })).resolves.toBe(
      '{"exercises":[],"warnings":[]}',
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        headers: {
          authorization: "Bearer test-openai-key",
          "content-type": "application/json",
        },
      }),
    );
    expect(extractRequestBody(fetchSpy)).toMatchObject({
      model: "deepseek-chat",
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });
  });

  it("keeps the Groq intake parser on the shared OpenAI-compatible client", async () => {
    process.env.GROQ_API_KEY = "test-groq-key";
    const fetchSpy = mockFetchOnce(200, {
      choices: [{ message: { content: '{"exercises":[],"warnings":[]}' } }],
    });
    const parser = createWorkoutIntakeLlmParser("groq");

    await expect(parser?.({ text: "今天深蹲三组" })).resolves.toBe(
      '{"exercises":[],"warnings":[]}',
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/chat/completions",
      expect.objectContaining({
        headers: {
          authorization: "Bearer test-groq-key",
          "content-type": "application/json",
        },
      }),
    );
  });

  it("fails before fetch when BYO config is missing", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const parser = createWorkoutIntakeLlmParser("openai_compatible");

    await expect(parser?.({ text: "今天深蹲三组" })).rejects.toThrow(
      /OPENAI_COMPAT_BASE_URL/u,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

function extractRequestBody(fetchSpy: ReturnType<typeof vi.fn>): unknown {
  const init = fetchSpy.mock.calls[0]?.[1];
  const body = Object.getOwnPropertyDescriptor(
    typeof init === "object" && init !== null ? init : {},
    "body",
  )?.value;

  return typeof body === "string" ? JSON.parse(body) : null;
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
