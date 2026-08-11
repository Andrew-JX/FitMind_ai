import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import * as chatClient from "./openai-compatible-chat-client.js";
import type { OpenAiCompatibleProviderConfig } from "./openai-compatible-provider-config.js";

const {
  CHAT_COMPLETION_TIMEOUT_MS,
  OPENAI_COMPATIBLE_CHAT_COMPLETIONS_PATH,
  runOpenAiCompatibleChatCompletion,
} = chatClient;
const serviceDirectory = dirname(fileURLToPath(import.meta.url));
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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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

describe("neutral OpenAI-compatible chat client characterization", () => {
  it("keeps the runtime export surface exact", () => {
    expect(Object.keys(chatClient).sort()).toEqual([
      "CHAT_COMPLETION_TIMEOUT_MS",
      "OPENAI_COMPATIBLE_CHAT_COMPLETIONS_PATH",
      "runOpenAiCompatibleChatCompletion",
    ]);
    expect(CHAT_COMPLETION_TIMEOUT_MS).toBe(20_000);
    expect(OPENAI_COMPATIBLE_CHAT_COMPLETIONS_PATH).toBe("/chat/completions");
  });

  it("posts the exact request and parses content, tool call, and usage", async () => {
    const fetchSpy = mockFetchOnce(200, {
      choices: [
        {
          message: {
            content: "hello",
            tool_calls: [{ function: { name: "lookup", arguments: "{}" } }],
          },
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
    });

    const result = await runOpenAiCompatibleChatCompletion(
      {
        ...baseRequest,
        responseFormat: { type: "json_object" },
        toolChoice: "auto",
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
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      model: "deepseek-chat",
      max_tokens: 64,
      temperature: 0,
      tool_choice: "auto",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result).toEqual({
      attempted: true,
      provider: "openai_compatible",
      model: "deepseek-chat",
      ok: true,
      status: 200,
      content: "hello",
      toolCall: { name: "lookup", arguments: "{}" },
      usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
    });
  });

  it("drops invalid usage without invalidating a successful response", async () => {
    mockFetchOnce(200, {
      choices: [{ message: { content: "hello" } }],
      usage: { prompt_tokens: 1.5, completion_tokens: -2, total_tokens: 3 },
    });

    const result = await runOpenAiCompatibleChatCompletion(
      baseRequest,
      byoConfig,
    );

    expect(result.ok).toBe(true);
    expect(result.content).toBe("hello");
    expect(result.usage).toBeUndefined();
  });

  it("normalizes an HTTP failure without exposing the API key", async () => {
    mockFetchOnce(429, { error: { message: "rate limited" } });

    const result = await runOpenAiCompatibleChatCompletion(
      baseRequest,
      byoConfig,
    );

    expect(result).toMatchObject({
      attempted: true,
      provider: "openai_compatible",
      model: "deepseek-chat",
      ok: false,
      status: 429,
      content: null,
      toolCall: null,
      errorMessage: "OpenAI-compatible request failed (429): rate limited",
    });
    expect(result.errorMessage).not.toContain("test-openai-key");
  });

  it("normalizes a network throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const result = await runOpenAiCompatibleChatCompletion(
      baseRequest,
      byoConfig,
    );

    expect(result).toMatchObject({
      attempted: true,
      ok: false,
      status: 0,
      errorMessage: "network down",
    });
  });

  it("aborts on timeout and clears the timer", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("operation aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const resultPromise = runOpenAiCompatibleChatCompletion(
      baseRequest,
      byoConfig,
      { timeoutMs: 25 },
    );
    await vi.advanceTimersByTimeAsync(25);
    const result = await resultPromise;

    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(result).toMatchObject({
      attempted: true,
      ok: false,
      status: 0,
      errorMessage: "OpenAI-compatible request timed out after 25ms.",
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps one definition owner and a one-way module dependency", () => {
    const neutralSource = readFileSync(
      join(serviceDirectory, "openai-compatible-chat-client.ts"),
      "utf8",
    );
    const assistantSource = readFileSync(
      join(serviceDirectory, "../assistant/openai-compatible-chat-client.ts"),
      "utf8",
    );
    const definitions = [
      /export const OPENAI_COMPATIBLE_CHAT_COMPLETIONS_PATH\b/g,
      /export const CHAT_COMPLETION_TIMEOUT_MS\b/g,
      /export async function runOpenAiCompatibleChatCompletion\b/g,
    ];

    for (const definition of definitions) {
      expect(
        (neutralSource.match(definition) ?? []).length +
          (assistantSource.match(definition) ?? []).length,
      ).toBe(1);
    }

    const neutralDependsOnAssistant = neutralSource.includes(
      'from "../assistant/openai-compatible-chat-client.js"',
    );
    const assistantDependsOnNeutral = assistantSource.includes(
      'from "../ai/openai-compatible-chat-client.js"',
    );
    expect(
      Number(neutralDependsOnAssistant) + Number(assistantDependsOnNeutral),
    ).toBe(1);
    expect(neutralSource).not.toContain("as unknown as");
    expect(neutralSource).not.toMatch(/\bany\b/u);
    expect(neutralSource).not.toContain("@ts-ignore");
  });
});
