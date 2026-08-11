import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as providerConfig from "./openai-compatible-provider-config.js";

const {
  GROQ_DEFAULT_MODEL,
  GROQ_OPENAI_COMPATIBLE_BASE_URL,
  getGroqAssistantProviderConfig,
  getOpenAiCompatibleProviderConfig,
} = providerConfig;
const serviceDirectory = dirname(fileURLToPath(import.meta.url));
const managedEnvironmentKeys = [
  "ASSISTANT_PROVIDER",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "OPENAI_COMPAT_BASE_URL",
  "OPENAI_COMPAT_MODEL",
  "OPENAI_COMPAT_API_KEY",
] as const;
const originalEnvironment = new Map(
  managedEnvironmentKeys.map((key) => [key, process.env[key]]),
);

beforeEach(() => {
  process.env.ASSISTANT_PROVIDER = "groq";
  process.env.GROQ_API_KEY = "test-groq-key";
  delete process.env.GROQ_MODEL;
  delete process.env.OPENAI_COMPAT_BASE_URL;
  delete process.env.OPENAI_COMPAT_MODEL;
  delete process.env.OPENAI_COMPAT_API_KEY;
});

afterEach(() => {
  for (const [key, value] of originalEnvironment) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("neutral OpenAI-compatible provider config characterization", () => {
  it("keeps the runtime export surface exact", () => {
    expect(Object.keys(providerConfig).sort()).toEqual([
      "GROQ_DEFAULT_MODEL",
      "GROQ_OPENAI_COMPATIBLE_BASE_URL",
      "getGroqAssistantProviderConfig",
      "getOpenAiCompatibleProviderConfig",
    ]);
  });

  it("builds the Groq preset with its default or configured model", () => {
    expect(getGroqAssistantProviderConfig()).toEqual({
      provider: "groq",
      baseUrl: GROQ_OPENAI_COMPATIBLE_BASE_URL,
      apiKey: "test-groq-key",
      model: GROQ_DEFAULT_MODEL,
    });

    process.env.GROQ_MODEL = "custom-groq-model";
    expect(getGroqAssistantProviderConfig().model).toBe("custom-groq-model");
  });

  it("rejects a missing Groq key with the existing message", () => {
    delete process.env.GROQ_API_KEY;

    expect(() => getGroqAssistantProviderConfig()).toThrow(
      "GROQ_API_KEY is required when ASSISTANT_PROVIDER=groq.",
    );
  });

  it("builds the BYO OpenAI-compatible config", () => {
    process.env.OPENAI_COMPAT_BASE_URL = "https://api.deepseek.com";
    process.env.OPENAI_COMPAT_MODEL = "deepseek-chat";
    process.env.OPENAI_COMPAT_API_KEY = "test-openai-key";

    expect(getOpenAiCompatibleProviderConfig()).toEqual({
      provider: "openai_compatible",
      baseUrl: "https://api.deepseek.com",
      apiKey: "test-openai-key",
      model: "deepseek-chat",
    });
  });

  it.each([
    {
      present: {
        OPENAI_COMPAT_MODEL: "deepseek-chat",
        OPENAI_COMPAT_API_KEY: "test-openai-key",
      },
      message: "OPENAI_COMPAT_BASE_URL must be a valid https URL",
    },
    {
      present: {
        OPENAI_COMPAT_BASE_URL: "https://api.deepseek.com",
        OPENAI_COMPAT_API_KEY: "test-openai-key",
      },
      message: "OPENAI_COMPAT_MODEL is required",
    },
    {
      present: {
        OPENAI_COMPAT_BASE_URL: "https://api.deepseek.com",
        OPENAI_COMPAT_MODEL: "deepseek-chat",
      },
      message: "OPENAI_COMPAT_API_KEY is required",
    },
  ])("rejects an incomplete BYO config: $message", ({ present, message }) => {
    Object.assign(process.env, present);

    expect(() => getOpenAiCompatibleProviderConfig()).toThrow(message);
  });

  it("keeps one definition owner and a one-way module dependency", () => {
    const neutralSource = readFileSync(
      join(serviceDirectory, "openai-compatible-provider-config.ts"),
      "utf8",
    );
    const assistantSource = readFileSync(
      join(serviceDirectory, "../assistant/provider-config.ts"),
      "utf8",
    );
    const definitions = [
      /export const GROQ_OPENAI_COMPATIBLE_BASE_URL\b/g,
      /export const GROQ_DEFAULT_MODEL\b/g,
      /export function getGroqAssistantProviderConfig\b/g,
      /export function getOpenAiCompatibleProviderConfig\b/g,
    ];

    for (const definition of definitions) {
      expect(
        (neutralSource.match(definition) ?? []).length +
          (assistantSource.match(definition) ?? []).length,
      ).toBe(1);
    }

    const neutralDependsOnAssistant = neutralSource.includes(
      'from "../assistant/provider-config.js"',
    );
    const assistantDependsOnNeutral = assistantSource.includes(
      'from "../ai/openai-compatible-provider-config.js"',
    );
    expect(
      Number(neutralDependsOnAssistant) + Number(assistantDependsOnNeutral),
    ).toBe(1);
    expect(neutralSource).not.toContain("as unknown as");
    expect(neutralSource).not.toMatch(/\bany\b/u);
    expect(neutralSource).not.toContain("@ts-ignore");
  });
});
