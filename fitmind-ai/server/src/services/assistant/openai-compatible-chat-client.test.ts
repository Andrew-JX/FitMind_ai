import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  runConfiguredAssistantOpenAiCompatibleChatCompletion,
  runOpenAiCompatibleChatCompletion,
} from "./openai-compatible-chat-client.js";
import {
  GROQ_DEFAULT_MODEL,
  GROQ_OPENAI_COMPATIBLE_BASE_URL,
} from "./provider-config.js";
import type { OpenAiCompatibleProviderConfig } from "./provider-config.js";

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

const byoConfig: OpenAiCompatibleProviderConfig = {
  provider: "openai_compatible",
  baseUrl: "https://api.deepseek.com/",
  apiKey: "test-openai-key",
  model: "deepseek-chat",
};

describe("runOpenAiCompatibleChatCompletion", () => {
  it("posts to baseUrl/chat/completions with bearer auth and returns provider/model", async () => {
    const fetchSpy = mockFetchOnce(200, {
      choices: [{ message: { content: "hello" } }],
      usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
    });

    const result = await runOpenAiCompatibleChatCompletion(
      {
        ...baseRequest,
        responseFormat: { type: "json_object" },
      },
      byoConfig,
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: "Bearer test-openai-key",
          "content-type": "application/json",
        },
      }),
    );
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toMatchObject(
      {
        model: "deepseek-chat",
        response_format: { type: "json_object" },
      },
    );
    expect(result).toMatchObject({
      attempted: true,
      ok: true,
      provider: "openai_compatible",
      model: "deepseek-chat",
      content: "hello",
    });
    expect(result.usage).toEqual({
      prompt_tokens: 5,
      completion_tokens: 2,
      total_tokens: 7,
    });
  });

  it("keeps ok with usage undefined when the usage shape is invalid", async () => {
    mockFetchOnce(200, {
      choices: [{ message: { content: "hello" } }],
      usage: { prompt_tokens: "bad" },
    });

    const result = await runOpenAiCompatibleChatCompletion(
      baseRequest,
      byoConfig,
    );

    expect(result.ok).toBe(true);
    expect(result.content).toBe("hello");
    expect(result.usage).toBeUndefined();
  });

  it("drops usage that is non-integer or negative", async () => {
    mockFetchOnce(200, {
      choices: [{ message: { content: "hello" } }],
      usage: { prompt_tokens: 1.5, completion_tokens: -2, total_tokens: 3 },
    });

    const result = await runOpenAiCompatibleChatCompletion(
      baseRequest,
      byoConfig,
    );

    expect(result.ok).toBe(true);
    expect(result.usage).toBeUndefined();
  });

  it("returns ok=false with a sanitized message on an HTTP error", async () => {
    mockFetchOnce(429, { error: { message: "rate limited" } });

    const result = await runOpenAiCompatibleChatCompletion(
      baseRequest,
      byoConfig,
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(429);
    expect(result.errorMessage).toContain("rate limited");
    expect(result.errorMessage).not.toContain("test-openai-key");
  });

  it("returns ok=false when the core response shape is unexpected", async () => {
    mockFetchOnce(200, { choices: [] });

    const result = await runOpenAiCompatibleChatCompletion(
      baseRequest,
      byoConfig,
    );

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/unexpected response shape/u);
  });

  it("returns ok=false with status 0 when fetch throws", async () => {
    mockFetchThrows();

    const result = await runOpenAiCompatibleChatCompletion(
      baseRequest,
      byoConfig,
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.attempted).toBe(true);
  });
});

describe("runConfiguredAssistantOpenAiCompatibleChatCompletion", () => {
  const originalAssistantProvider = process.env.ASSISTANT_PROVIDER;
  const originalGroqKey = process.env.GROQ_API_KEY;
  const originalGroqModel = process.env.GROQ_MODEL;
  const originalCompatBaseUrl = process.env.OPENAI_COMPAT_BASE_URL;
  const originalCompatModel = process.env.OPENAI_COMPAT_MODEL;
  const originalCompatApiKey = process.env.OPENAI_COMPAT_API_KEY;

  beforeEach(() => {
    process.env.ASSISTANT_PROVIDER = "groq";
    process.env.GROQ_API_KEY = "test-groq-key";
    delete process.env.GROQ_MODEL;
    delete process.env.OPENAI_COMPAT_BASE_URL;
    delete process.env.OPENAI_COMPAT_MODEL;
    delete process.env.OPENAI_COMPAT_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreEnv("ASSISTANT_PROVIDER", originalAssistantProvider);
    restoreEnv("GROQ_API_KEY", originalGroqKey);
    restoreEnv("GROQ_MODEL", originalGroqModel);
    restoreEnv("OPENAI_COMPAT_BASE_URL", originalCompatBaseUrl);
    restoreEnv("OPENAI_COMPAT_MODEL", originalCompatModel);
    restoreEnv("OPENAI_COMPAT_API_KEY", originalCompatApiKey);
  });

  it("keeps the Groq preset behavior-compatible", async () => {
    const fetchSpy = mockFetchOnce(200, {
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

    const result =
      await runConfiguredAssistantOpenAiCompatibleChatCompletion(baseRequest);

    expect(fetchSpy).toHaveBeenCalledWith(
      `${GROQ_OPENAI_COMPATIBLE_BASE_URL}/chat/completions`,
      expect.objectContaining({
        headers: {
          authorization: "Bearer test-groq-key",
          "content-type": "application/json",
        },
      }),
    );
    expect(result.provider).toBe("groq");
    expect(result.model).toBe(GROQ_DEFAULT_MODEL);
    expect(result.toolCall).toEqual({ name: "t", arguments: "{}" });
  });

  it("uses the shared OpenAI-compatible env when selected", async () => {
    process.env.ASSISTANT_PROVIDER = "openai_compatible";
    process.env.OPENAI_COMPAT_BASE_URL = "https://api.deepseek.com";
    process.env.OPENAI_COMPAT_MODEL = "deepseek-chat";
    process.env.OPENAI_COMPAT_API_KEY = "test-openai-key";
    const fetchSpy = mockFetchOnce(200, {
      choices: [{ message: { content: "hello" } }],
    });

    const result =
      await runConfiguredAssistantOpenAiCompatibleChatCompletion(baseRequest);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        headers: {
          authorization: "Bearer test-openai-key",
          "content-type": "application/json",
        },
      }),
    );
    expect(result.provider).toBe("openai_compatible");
    expect(result.model).toBe("deepseek-chat");
  });

  it("returns attempted=false and never calls fetch when BYO config is missing", async () => {
    process.env.ASSISTANT_PROVIDER = "openai_compatible";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result =
      await runConfiguredAssistantOpenAiCompatibleChatCompletion(baseRequest);

    expect(result.ok).toBe(false);
    expect(result.attempted).toBe(false);
    expect(result.provider).toBe("openai_compatible");
    expect(result.model).toBeNull();
    expect(result.errorMessage).toMatch(/OPENAI_COMPAT_BASE_URL/u);
    expect(result.errorMessage).not.toContain("test-openai-key");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
