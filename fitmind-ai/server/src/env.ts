import { z } from "zod";

const DEFAULT_PORT = 3000;

/**
 * Optional secret/string env var that treats an empty or whitespace-only value
 * as "not set".
 *
 * @remarks
 * A blank env var (common on hosting dashboards, e.g. an empty
 * `ANTHROPIC_API_KEY`) would otherwise fail `.min(1)` and throw on every
 * request that loads env, surfacing as a confusing "Request validation failed".
 */
const optionalSecret = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().min(1).optional(),
);

const optionalHttpsUrl = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  },
  z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === "https:", {
      message: "URL must use https.",
    })
    .optional()
    .catch(undefined),
);

/**
 * Boolean feature flag: `"1"/"true"/"on"/"yes"` (case-insensitive) → `true`;
 * anything else, blank, or unset → `false`. Keeps a typo/blank from throwing.
 */
const booleanFlag = z.preprocess(
  (value) =>
    typeof value === "string" &&
    ["1", "true", "on", "yes"].includes(value.trim().toLowerCase()),
  z.boolean().default(false),
);

/**
 * Fail-safe boolean flag for safety gates: only an explicit disable token turns
 * it off. Unset, blank, typo, and normal enable tokens all keep protection on.
 */
const safetyFlagDefaultOn = z.preprocess((value) => {
  if (typeof value !== "string") {
    return true;
  }

  return !["0", "false", "no", "off"].includes(value.trim().toLowerCase());
}, z.boolean().default(true));

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  DATABASE_URL: optionalSecret,
  JWT_SECRET: optionalSecret,
  // `.catch("mock")` keeps an unknown/typo provider value from throwing and
  // taking down every request that loads env (e.g. auth); it degrades to mock.
  ASSISTANT_PROVIDER: z
    .enum(["mock", "anthropic", "groq", "openai_compatible"])
    .default("mock")
    .catch("mock"),
  // Slice 11.3b: opt-in LLM re-phrasing of the answer summary (still gated by
  // ASSISTANT_PROVIDER=groq + runtime faithfulness fallback). Default off.
  ASSISTANT_PHRASING: booleanFlag,
  // Learning-loop opt-in: previous accepted plan adherence can adjust the next
  // deterministic plan. Default off for dogfood/A-B comparison.
  ASSISTANT_PLAN_ADHERENCE_CONTEXT: booleanFlag,
  // Slice 8 Tier 1: scheduled weekly digest generation. Default off so merely
  // deploying the code does not create proactive app content.
  WEEKLY_REPORT_DELIVERY_ENABLED: booleanFlag,
  WEEKLY_REPORT_CRON_SECRET: optionalSecret,
  // C2 RAG reranking: opt-in only; default off keeps existing retrieval behavior.
  RAG_RERANKING_ENABLED: booleanFlag,
  // Slice 10: fail-safe medical boundary gate. Default on; only explicit
  // disable tokens turn it off for rollback.
  ASSISTANT_SAFETY_GATE: safetyFlagDefaultOn,
  // China launch: self-service registration gate. Fail-safe closed, so a
  // deployment that forgets to configure it stays invite-only rather than
  // silently opening public sign-up (see docs/china-launch-plan.md §3.2a).
  REGISTRATION_INVITE_ONLY: safetyFlagDefaultOn,
  // Where this instance stores personal information. Drives whether the art.
  // 39 cross-border consent is demanded before an account can be created.
  //
  // Defaults to `overseas`, and `.catch()`es to it, because the two ways of
  // being wrong are not symmetric: demanding a consent a mainland instance
  // does not need costs one checkbox, while skipping it on an instance that
  // does export data is the violation this whole seam exists to prevent. An
  // unset or misspelled value therefore lands on the cautious side.
  DATA_RESIDENCY: z
    .enum(["overseas", "mainland"])
    .default("overseas")
    .catch("overseas"),
  WORKOUT_INTAKE_LLM_PROVIDER: z
    .enum(["off", "mock", "anthropic", "gemini", "groq", "openai_compatible"])
    .default("mock")
    .catch("mock"),
  ANTHROPIC_API_KEY: optionalSecret,
  GEMINI_API_KEY: optionalSecret,
  GEMINI_MODEL: optionalSecret,
  GROQ_API_KEY: optionalSecret,
  GROQ_MODEL: optionalSecret,
  OPENAI_COMPAT_BASE_URL: optionalHttpsUrl,
  OPENAI_COMPAT_MODEL: optionalSecret,
  OPENAI_COMPAT_API_KEY: optionalSecret,
  VOYAGE_API_KEY: optionalSecret,
});

export interface ServerEnv {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl?: string | undefined;
  jwtSecret?: string | undefined;
  assistantProvider: "mock" | "anthropic" | "groq" | "openai_compatible";
  assistantPhrasing: boolean;
  assistantPlanAdherenceContext: boolean;
  weeklyReportDeliveryEnabled: boolean;
  weeklyReportCronSecret?: string | undefined;
  ragRerankingEnabled: boolean;
  assistantSafetyGate: boolean;
  registrationInviteOnly: boolean;
  dataResidency: "overseas" | "mainland";
  workoutIntakeLlmProvider:
    | "off"
    | "mock"
    | "anthropic"
    | "gemini"
    | "groq"
    | "openai_compatible";
  anthropicApiKey?: string | undefined;
  geminiApiKey?: string | undefined;
  geminiModel?: string | undefined;
  groqApiKey?: string | undefined;
  groqModel?: string | undefined;
  openAiCompatBaseUrl?: string | undefined;
  openAiCompatModel?: string | undefined;
  openAiCompatApiKey?: string | undefined;
  voyageApiKey?: string | undefined;
}

/**
 * Env vars whose surrounding whitespace is safe to discard at load time.
 *
 * @remarks
 * Deliberately an allowlist, not "every schema key minus the secrets": a
 * variable added later defaults to being left alone, which is the harmless
 * direction to be wrong in.
 *
 * Members are values drawn from a fixed vocabulary — enum flags and the model
 * identifiers sent upstream. None of them can meaningfully contain whitespace,
 * and for the two provider enums a stray space is actively dangerous, because
 * they `.catch()` their defaults: `"openai_compatible "` fails the enum and
 * silently degrades the assistant to mock with no error to notice.
 *
 * Everything omitted is either an opaque credential or already normalized
 * inside its own schema preprocess (`booleanFlag`, `safetyFlagDefaultOn` and
 * `optionalHttpsUrl` all trim before comparing).
 */
const TRIMMED_ENV_KEYS = [
  "NODE_ENV",
  "ASSISTANT_PROVIDER",
  "WORKOUT_INTAKE_LLM_PROVIDER",
  "DATA_RESIDENCY",
  "GEMINI_MODEL",
  "GROQ_MODEL",
  "OPENAI_COMPAT_MODEL",
] as const;

/**
 * Trim surrounding whitespace from the env vars listed in
 * {@link TRIMMED_ENV_KEYS}, leaving every other value byte-for-byte.
 *
 * @param source - Raw environment
 * @returns A copy whose vocabulary-valued keys have been trimmed
 *
 * @remarks
 * Node's `--env-file` parser already trims, but nothing else does: a value
 * pasted into a hosting dashboard, passed with `docker -e`, or exported from a
 * shell keeps whatever whitespace came with it.
 *
 * Secrets are excluded on purpose. Rewriting a credential's bytes trades a
 * loud failure for a silent one — a `DATABASE_URL` with a trailing newline
 * fails to connect and says so, whereas a trimmed `JWT_SECRET` signs with a
 * different key than the one that issued the live cookies, logging every user
 * out at deploy with nothing in the logs to explain it.
 */
function trimKnownEnvValues(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const trimmed: NodeJS.ProcessEnv = { ...source };

  for (const key of TRIMMED_ENV_KEYS) {
    const value = source[key];

    if (typeof value === "string") {
      trimmed[key] = value.trim();
    }
  }

  return trimmed;
}

const RETIRED_DEEPSEEK_MODELS = new Set(["deepseek-chat", "deepseek-reasoner"]);

function rejectRetiredOfficialDeepSeekModel(
  baseUrl: string | undefined,
  model: string | undefined,
): void {
  if (baseUrl === undefined || model === undefined) {
    return;
  }

  if (new URL(baseUrl).hostname.toLowerCase() !== "api.deepseek.com") {
    return;
  }

  if (RETIRED_DEEPSEEK_MODELS.has(model)) {
    throw new Error(
      `OPENAI_COMPAT_MODEL=${model} was retired by DeepSeek on 2026-07-24. Use deepseek-v4-flash or deepseek-v4-pro.`,
    );
  }
}

export function loadServerEnv(
  source: NodeJS.ProcessEnv = process.env,
): ServerEnv {
  const parsed = serverEnvSchema.parse(trimKnownEnvValues(source));

  // Provider unit fixtures may use retired identifiers as inert model strings;
  // development and production configuration must still fail before a call.
  if (parsed.NODE_ENV !== "test") {
    rejectRetiredOfficialDeepSeekModel(
      parsed.OPENAI_COMPAT_BASE_URL,
      parsed.OPENAI_COMPAT_MODEL,
    );
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    jwtSecret: parsed.JWT_SECRET,
    assistantProvider: parsed.ASSISTANT_PROVIDER,
    assistantPhrasing: parsed.ASSISTANT_PHRASING,
    assistantPlanAdherenceContext: parsed.ASSISTANT_PLAN_ADHERENCE_CONTEXT,
    weeklyReportDeliveryEnabled: parsed.WEEKLY_REPORT_DELIVERY_ENABLED,
    weeklyReportCronSecret: parsed.WEEKLY_REPORT_CRON_SECRET,
    ragRerankingEnabled: parsed.RAG_RERANKING_ENABLED,
    assistantSafetyGate: parsed.ASSISTANT_SAFETY_GATE,
    registrationInviteOnly: parsed.REGISTRATION_INVITE_ONLY,
    dataResidency: parsed.DATA_RESIDENCY,
    workoutIntakeLlmProvider: parsed.WORKOUT_INTAKE_LLM_PROVIDER,
    anthropicApiKey: parsed.ANTHROPIC_API_KEY,
    geminiApiKey: parsed.GEMINI_API_KEY,
    geminiModel: parsed.GEMINI_MODEL,
    groqApiKey: parsed.GROQ_API_KEY,
    groqModel: parsed.GROQ_MODEL,
    openAiCompatBaseUrl: parsed.OPENAI_COMPAT_BASE_URL,
    openAiCompatModel: parsed.OPENAI_COMPAT_MODEL,
    openAiCompatApiKey: parsed.OPENAI_COMPAT_API_KEY,
    voyageApiKey: parsed.VOYAGE_API_KEY,
  };
}

/**
 * Read the configured DATABASE_URL or throw a descriptive error.
 *
 * @param source - Environment variable source, defaults to process.env.
 * @returns Non-empty database connection string.
 */
export function requireDatabaseUrl(
  source: NodeJS.ProcessEnv = process.env,
): string {
  const env = loadServerEnv(source);

  if (env.databaseUrl === undefined) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  return env.databaseUrl;
}

/**
 * Read the configured JWT_SECRET or throw a descriptive error.
 *
 * @param source - Environment variable source, defaults to process.env.
 * @returns Non-empty JWT signing secret.
 */
export function requireJwtSecret(
  source: NodeJS.ProcessEnv = process.env,
): string {
  const env = loadServerEnv(source);

  if (env.jwtSecret === undefined) {
    throw new Error("JWT_SECRET is required for authentication.");
  }

  return env.jwtSecret;
}
