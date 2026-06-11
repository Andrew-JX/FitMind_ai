import { describe, expect, it } from "vitest";

import { loadServerEnv } from "./env.js";

describe("loadServerEnv", () => {
  it("treats empty secret env vars as not set instead of throwing", () => {
    const env = loadServerEnv({
      DATABASE_URL: "",
      JWT_SECRET: "   ",
      ANTHROPIC_API_KEY: "",
      GEMINI_API_KEY: "",
      VOYAGE_API_KEY: "",
    } as NodeJS.ProcessEnv);

    expect(env.databaseUrl).toBeUndefined();
    expect(env.jwtSecret).toBeUndefined();
    expect(env.anthropicApiKey).toBeUndefined();
    expect(env.geminiApiKey).toBeUndefined();
    expect(env.voyageApiKey).toBeUndefined();
  });

  it("keeps non-empty secret env vars", () => {
    const env = loadServerEnv({
      ANTHROPIC_API_KEY: "sk-ant-123",
      GEMINI_API_KEY: "gem-123",
    } as NodeJS.ProcessEnv);

    expect(env.anthropicApiKey).toBe("sk-ant-123");
    expect(env.geminiApiKey).toBe("gem-123");
  });

  it("degrades an unknown provider value to mock", () => {
    const env = loadServerEnv({
      WORKOUT_INTAKE_LLM_PROVIDER: "totally-unknown",
      ASSISTANT_PROVIDER: "nope",
    } as NodeJS.ProcessEnv);

    expect(env.workoutIntakeLlmProvider).toBe("mock");
    expect(env.assistantProvider).toBe("mock");
  });

  it("accepts the gemini intake provider", () => {
    const env = loadServerEnv({
      WORKOUT_INTAKE_LLM_PROVIDER: "gemini",
    } as NodeJS.ProcessEnv);

    expect(env.workoutIntakeLlmProvider).toBe("gemini");
  });
});
