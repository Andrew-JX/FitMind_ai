import { z } from "zod";

const DEFAULT_PORT = 3000;

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(1).optional(),
  ASSISTANT_PROVIDER: z.enum(["mock", "anthropic"]).default("mock"),
  WORKOUT_INTAKE_LLM_PROVIDER: z
    .enum(["off", "mock", "anthropic"])
    .default("mock"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});

export interface ServerEnv {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl?: string | undefined;
  jwtSecret?: string | undefined;
  assistantProvider: "mock" | "anthropic";
  workoutIntakeLlmProvider: "off" | "mock" | "anthropic";
  anthropicApiKey?: string | undefined;
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
    workoutIntakeLlmProvider: parsed.WORKOUT_INTAKE_LLM_PROVIDER,
    anthropicApiKey: parsed.ANTHROPIC_API_KEY,
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
