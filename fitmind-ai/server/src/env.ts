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
    .enum(["mock", "anthropic", "groq"])
    .default("mock")
    .catch("mock"),
  // Slice 11.3b: opt-in LLM re-phrasing of the answer summary (still gated by
  // ASSISTANT_PROVIDER=groq + runtime faithfulness fallback). Default off.
  ASSISTANT_PHRASING: booleanFlag,
  WORKOUT_INTAKE_LLM_PROVIDER: z
    .enum(["off", "mock", "anthropic", "gemini", "groq"])
    .default("mock")
    .catch("mock"),
  ANTHROPIC_API_KEY: optionalSecret,
  GEMINI_API_KEY: optionalSecret,
  GEMINI_MODEL: optionalSecret,
  GROQ_API_KEY: optionalSecret,
  GROQ_MODEL: optionalSecret,
  VOYAGE_API_KEY: optionalSecret,
});

export interface ServerEnv {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl?: string | undefined;
  jwtSecret?: string | undefined;
  assistantProvider: "mock" | "anthropic" | "groq";
  assistantPhrasing: boolean;
  workoutIntakeLlmProvider: "off" | "mock" | "anthropic" | "gemini" | "groq";
  anthropicApiKey?: string | undefined;
  geminiApiKey?: string | undefined;
  geminiModel?: string | undefined;
  groqApiKey?: string | undefined;
  groqModel?: string | undefined;
  voyageApiKey?: string | undefined;
}

export function loadServerEnv(
  source: NodeJS.ProcessEnv = process.env,
): ServerEnv {
  const parsed = serverEnvSchema.parse(source);

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    jwtSecret: parsed.JWT_SECRET,
    assistantProvider: parsed.ASSISTANT_PROVIDER,
    assistantPhrasing: parsed.ASSISTANT_PHRASING,
    workoutIntakeLlmProvider: parsed.WORKOUT_INTAKE_LLM_PROVIDER,
    anthropicApiKey: parsed.ANTHROPIC_API_KEY,
    geminiApiKey: parsed.GEMINI_API_KEY,
    geminiModel: parsed.GEMINI_MODEL,
    groqApiKey: parsed.GROQ_API_KEY,
    groqModel: parsed.GROQ_MODEL,
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
