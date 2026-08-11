import { describe, expect, it } from "vitest";

import { loadServerEnv } from "./env.js";

describe("loadServerEnv", () => {
  it("treats empty secret env vars as not set instead of throwing", () => {
    const env = loadServerEnv({
      DATABASE_URL: "",
      JWT_SECRET: "   ",
      ANTHROPIC_API_KEY: "",
      GEMINI_API_KEY: "",
      OPENAI_COMPAT_API_KEY: "",
      OPENAI_COMPAT_MODEL: "",
      VOYAGE_API_KEY: "",
    } as NodeJS.ProcessEnv);

    expect(env.databaseUrl).toBeUndefined();
    expect(env.jwtSecret).toBeUndefined();
    expect(env.anthropicApiKey).toBeUndefined();
    expect(env.geminiApiKey).toBeUndefined();
    expect(env.openAiCompatApiKey).toBeUndefined();
    expect(env.openAiCompatModel).toBeUndefined();
    expect(env.voyageApiKey).toBeUndefined();
  });

  it("keeps non-empty secret env vars", () => {
    const env = loadServerEnv({
      ANTHROPIC_API_KEY: "sk-ant-123",
      GEMINI_API_KEY: "gem-123",
      OPENAI_COMPAT_API_KEY: "compat-123",
      OPENAI_COMPAT_MODEL: "deepseek-chat",
    } as NodeJS.ProcessEnv);

    expect(env.anthropicApiKey).toBe("sk-ant-123");
    expect(env.geminiApiKey).toBe("gem-123");
    expect(env.openAiCompatApiKey).toBe("compat-123");
    expect(env.openAiCompatModel).toBe("deepseek-chat");
  });

  it("degrades an unknown provider value to mock", () => {
    const env = loadServerEnv({
      WORKOUT_INTAKE_LLM_PROVIDER: "totally-unknown",
      ASSISTANT_PROVIDER: "nope",
    } as NodeJS.ProcessEnv);

    expect(env.workoutIntakeLlmProvider).toBe("mock");
    expect(env.assistantProvider).toBe("mock");
  });

  // Node's --env-file trims, but a hosting dashboard, `docker -e` or a shell
  // export does not. Untrimmed values fail these enums silently, because the
  // schema catches its own default instead of throwing.
  it("survives whitespace around provider values instead of degrading to mock", () => {
    const env = loadServerEnv({
      ASSISTANT_PROVIDER: "openai_compatible\t",
      WORKOUT_INTAKE_LLM_PROVIDER: " openai_compatible ",
    } as NodeJS.ProcessEnv);

    expect(env.assistantProvider).toBe("openai_compatible");
    expect(env.workoutIntakeLlmProvider).toBe("openai_compatible");
  });

  // This one was already safe: safetyFlagDefaultOn trims inside its own
  // preprocess, so it passes with or without the load-time trim. Pinned anyway
  // — a fail-safe flag that misreads "off " stays closed and locks the operator
  // out of their own registration endpoint, and now two layers have to agree
  // before that can happen.
  it("recognizes a disable token that carries whitespace", () => {
    const env = loadServerEnv({
      REGISTRATION_INVITE_ONLY: "off\n",
    } as NodeJS.ProcessEnv);

    expect(env.registrationInviteOnly).toBe(false);
  });

  it("trims whitespace off model identifiers rather than sending it upstream", () => {
    const env = loadServerEnv({
      GEMINI_MODEL: " gemini-2.0-flash\n",
      GROQ_MODEL: "llama-3.3-70b\t",
      OPENAI_COMPAT_MODEL: "deepseek-chat\r",
    } as NodeJS.ProcessEnv);

    expect(env.geminiModel).toBe("gemini-2.0-flash");
    expect(env.groqModel).toBe("llama-3.3-70b");
    expect(env.openAiCompatModel).toBe("deepseek-chat");
  });

  // The counterpart to the trimming above, and the reason it is an allowlist.
  // Whitespace is not valid in a model name, so removing it can only help; a
  // credential is opaque, so removing it is a guess about someone else's
  // format. Guessing wrong on JWT_SECRET signs tokens with a key that does not
  // match the live cookies and logs every user out at deploy, silently — a far
  // worse outcome than the connection error an untrimmed value would have
  // raised. Any secret added to the schema later must stay out of the list too.
  it("leaves opaque secrets byte-for-byte, whitespace included", () => {
    const env = loadServerEnv({
      DATABASE_URL: "postgres://u:p@host/db ",
      JWT_SECRET: " jwt-secret-value\n",
      WEEKLY_REPORT_CRON_SECRET: "cron-secret\t",
      ANTHROPIC_API_KEY: "  sk-ant-123  ",
      GEMINI_API_KEY: "gem-123\r",
      GROQ_API_KEY: " gsk-123",
      OPENAI_COMPAT_API_KEY: "  sk-compat-123  ",
      VOYAGE_API_KEY: "pa-123 ",
    } as NodeJS.ProcessEnv);

    expect(env.databaseUrl).toBe("postgres://u:p@host/db ");
    expect(env.jwtSecret).toBe(" jwt-secret-value\n");
    expect(env.weeklyReportCronSecret).toBe("cron-secret\t");
    expect(env.anthropicApiKey).toBe("  sk-ant-123  ");
    expect(env.geminiApiKey).toBe("gem-123\r");
    expect(env.groqApiKey).toBe(" gsk-123");
    expect(env.openAiCompatApiKey).toBe("  sk-compat-123  ");
    expect(env.voyageApiKey).toBe("pa-123 ");
  });

  it("accepts the gemini intake provider", () => {
    const env = loadServerEnv({
      WORKOUT_INTAKE_LLM_PROVIDER: "gemini",
    } as NodeJS.ProcessEnv);

    expect(env.workoutIntakeLlmProvider).toBe("gemini");
  });

  it("accepts OpenAI-compatible assistant and intake providers", () => {
    const env = loadServerEnv({
      ASSISTANT_PROVIDER: "openai_compatible",
      WORKOUT_INTAKE_LLM_PROVIDER: "openai_compatible",
    } as NodeJS.ProcessEnv);

    expect(env.assistantProvider).toBe("openai_compatible");
    expect(env.workoutIntakeLlmProvider).toBe("openai_compatible");
  });

  it("keeps only valid https OpenAI-compatible base URLs", () => {
    const validEnv = loadServerEnv({
      OPENAI_COMPAT_BASE_URL: " https://api.deepseek.com ",
    } as NodeJS.ProcessEnv);
    const invalidEnv = loadServerEnv({
      OPENAI_COMPAT_BASE_URL: "http://api.deepseek.com",
    } as NodeJS.ProcessEnv);
    const blankEnv = loadServerEnv({
      OPENAI_COMPAT_BASE_URL: "   ",
    } as NodeJS.ProcessEnv);

    expect(validEnv.openAiCompatBaseUrl).toBe("https://api.deepseek.com");
    expect(invalidEnv.openAiCompatBaseUrl).toBeUndefined();
    expect(blankEnv.openAiCompatBaseUrl).toBeUndefined();
  });

  it.each(["deepseek-chat", "deepseek-reasoner"])(
    "rejects retired model %s on the official DeepSeek endpoint",
    (model) => {
      expect(() =>
        loadServerEnv({
          NODE_ENV: "production",
          OPENAI_COMPAT_BASE_URL: "https://api.deepseek.com",
          OPENAI_COMPAT_MODEL: model,
        } as NodeJS.ProcessEnv),
      ).toThrow(/retired.*deepseek-v4-flash.*deepseek-v4-pro/i);
    },
  );

  it("accepts the current DeepSeek V4 Flash model", () => {
    const env = loadServerEnv({
      NODE_ENV: "production",
      OPENAI_COMPAT_BASE_URL: "https://api.deepseek.com",
      OPENAI_COMPAT_MODEL: "deepseek-v4-flash",
    } as NodeJS.ProcessEnv);

    expect(env.openAiCompatModel).toBe("deepseek-v4-flash");
  });

  it("does not apply DeepSeek retirement rules to another compatible endpoint", () => {
    const env = loadServerEnv({
      NODE_ENV: "production",
      OPENAI_COMPAT_BASE_URL: "https://compatible.example.com/v1",
      OPENAI_COMPAT_MODEL: "deepseek-chat",
    } as NodeJS.ProcessEnv);

    expect(env.openAiCompatModel).toBe("deepseek-chat");
  });

  it("keeps plan-adherence context opt-in by default", () => {
    const defaultEnv = loadServerEnv({} as NodeJS.ProcessEnv);
    const enabledEnv = loadServerEnv({
      ASSISTANT_PLAN_ADHERENCE_CONTEXT: "on",
    } as NodeJS.ProcessEnv);

    expect(defaultEnv.assistantPlanAdherenceContext).toBe(false);
    expect(enabledEnv.assistantPlanAdherenceContext).toBe(true);
  });

  it("keeps weekly report delivery opt-in and secret server-only", () => {
    const defaultEnv = loadServerEnv({} as NodeJS.ProcessEnv);
    const enabledEnv = loadServerEnv({
      WEEKLY_REPORT_DELIVERY_ENABLED: "yes",
      WEEKLY_REPORT_CRON_SECRET: "cron-secret",
    } as NodeJS.ProcessEnv);

    expect(defaultEnv.weeklyReportDeliveryEnabled).toBe(false);
    expect(defaultEnv.weeklyReportCronSecret).toBeUndefined();
    expect(enabledEnv.weeklyReportDeliveryEnabled).toBe(true);
    expect(enabledEnv.weeklyReportCronSecret).toBe("cron-secret");
  });

  it("keeps RAG reranking opt-in by default", () => {
    const defaultEnv = loadServerEnv({} as NodeJS.ProcessEnv);
    const enabledEnv = loadServerEnv({
      RAG_RERANKING_ENABLED: "true",
    } as NodeJS.ProcessEnv);

    expect(defaultEnv.ragRerankingEnabled).toBe(false);
    expect(enabledEnv.ragRerankingEnabled).toBe(true);
  });
});
