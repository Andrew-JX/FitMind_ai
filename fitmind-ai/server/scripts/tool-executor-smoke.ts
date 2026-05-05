import { access, readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createDbPool } from "../src/db/pool.js";
import {
  listRecentToolCallLogs,
  type ToolCallLogRow,
} from "../src/db/tool-call-log-repository.js";
import {
  executeAiTool,
  getAiToolRegistry,
} from "../src/services/ai/tools/tool-executor.js";
import {
  AiToolValidationError,
  UnknownAiToolError,
} from "../src/services/ai/tools/tool-types.js";

interface ApiSuccess<TData> {
  ok: true;
  data: TData;
}

interface ApiErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: {
      issues?: Array<{
        path: string;
        message: string;
      }>;
    };
  };
}

type ApiResponse<TData> = ApiSuccess<TData> | ApiErrorResponse;

interface AuthSuccessData {
  user: {
    id: string;
    email: string;
    display_name: string | null;
  };
  token: string;
}

interface ExerciseSearchData {
  items: Array<{
    id: string;
    code: string;
    name_en: string;
  }>;
}

interface WorkoutSetData {
  id: string;
  exercise_id: string;
  set_index: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
  is_warmup: boolean;
  notes: string | null;
  created_at: string;
}

interface WorkoutDetailData {
  workout: {
    id: string;
    performed_at: string;
    duration_minutes: number | null;
    notes: string | null;
    sets: WorkoutSetData[];
  };
}

interface DeleteResponseData {
  deleted: true;
  id: string;
}

const SMOKE_JWT_SECRET = "fitmind-smoke-secret";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function loadEnvFile(filePath: string): Promise<void> {
  await access(filePath);

  const source = await readFile(filePath, "utf8");

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  const { createApp } = await import("../src/app.js");
  const app = createApp();
  const server = createServer(app);

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectPromise);
      resolvePromise();
    });
  });

  const address = server.address();

  assert(
    address !== null && typeof address !== "string",
    "Smoke server did not expose an ephemeral port.",
  );

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.close((error) => {
      if (error) {
        rejectPromise(error);
        return;
      }

      resolvePromise();
    });
  });
}

async function requestJson<TData>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: ApiResponse<TData> }> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = (await response.json()) as ApiResponse<TData>;

  return {
    status: response.status,
    body,
  };
}

function expectSuccess<TData>(
  response: { status: number; body: ApiResponse<TData> },
  expectedStatus: number,
  label: string,
): TData {
  assert(
    response.status === expectedStatus,
    `${label} expected HTTP ${expectedStatus}, got ${response.status}. body=${JSON.stringify(response.body)}`,
  );
  assert(response.body.ok, `${label} expected success response.`);

  return response.body.data;
}

function createAuthHeaders(token: string): HeadersInit {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

async function registerUser(
  baseUrl: string,
  email: string,
  displayName: string,
): Promise<AuthSuccessData> {
  const registerResponse = await requestJson<AuthSuccessData>(
    baseUrl,
    "/api/auth/register",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email,
        password: "Passw0rd!",
        display_name: displayName,
      }),
    },
  );

  return expectSuccess(registerResponse, 201, "POST /api/auth/register");
}

async function deleteWorkoutIfNeeded(
  baseUrl: string,
  token: string,
  workoutId: string | null,
): Promise<void> {
  if (workoutId === null) {
    return;
  }

  try {
    await requestJson<DeleteResponseData>(baseUrl, `/api/workouts/${workoutId}`, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
  } catch {
    // Best-effort cleanup keeps the main smoke result actionable.
  }
}

function assertNoSecretsInLog(
  log: ToolCallLogRow,
  token: string,
  databaseUrl: string,
): void {
  const serializedLog = JSON.stringify({
    tool_input: log.tool_input,
    tool_output: log.tool_output,
    error_message: log.error_message,
  }).toLowerCase();

  assert(
    !serializedLog.includes(token.toLowerCase()),
    "Persisted tool log should not contain the auth token.",
  );
  assert(
    !serializedLog.includes(databaseUrl.toLowerCase()),
    "Persisted tool log should not contain DATABASE_URL.",
  );
  assert(
    !serializedLog.includes("bearer "),
    "Persisted tool log should not contain bearer strings.",
  );
  assert(
    !serializedLog.includes("authorization"),
    "Persisted tool log should not contain authorization fields.",
  );
  assert(
    !serializedLog.includes("password"),
    "Persisted tool log should not contain password fields.",
  );
}

async function loadRecentLogsForUser(userId: string): Promise<ToolCallLogRow[]> {
  const pool = createDbPool();

  try {
    return await listRecentToolCallLogs(
      {
        userId,
        limit: 10,
      },
      pool,
    );
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(scriptDir, "..", ".env.local");
  await loadEnvFile(envPath);
  const databaseUrl = process.env.DATABASE_URL;

  assert(
    typeof databaseUrl === "string" && databaseUrl.length > 0,
    "DATABASE_URL is required for tool executor smoke.",
  );

  if (
    typeof process.env.JWT_SECRET !== "string" ||
    process.env.JWT_SECRET.length === 0
  ) {
    process.env.JWT_SECRET = SMOKE_JWT_SECRET;
    console.log(
      "JWT_SECRET missing in .env.local, using smoke fallback secret.",
    );
  }

  const registry = getAiToolRegistry();
  assert(registry.size === 3, "Tool registry should expose exactly three tools.");
  assert(
    registry.has("get_training_summary") &&
      registry.has("get_exercise_progress") &&
      registry.has("get_recommendation_context"),
    "Tool registry should include all deterministic training tools.",
  );
  console.log("OK registry exposes 3 deterministic training tools");

  const { server, baseUrl } = await startServer();
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const primaryEmail = `tool-executor-smoke-${uniqueSuffix}@example.com`;
  const secondaryEmail = `tool-executor-smoke-other-${uniqueSuffix}@example.com`;
  let primaryToken: string | null = null;
  let secondaryToken: string | null = null;
  let primaryWorkoutIdOne: string | null = null;
  let primaryWorkoutIdTwo: string | null = null;
  let secondaryWorkoutId: string | null = null;

  try {
    console.log(`Smoke base URL: ${baseUrl}`);

    const primaryAuth = await registerUser(
      baseUrl,
      primaryEmail,
      "Tool Executor Smoke",
    );
    primaryToken = primaryAuth.token;
    console.log("OK 201 POST /api/auth/register primary user");

    const secondaryAuth = await registerUser(
      baseUrl,
      secondaryEmail,
      "Tool Executor Smoke Other User",
    );
    secondaryToken = secondaryAuth.token;
    console.log("OK 201 POST /api/auth/register secondary user");

    const benchSearchResponse = await requestJson<ExerciseSearchData>(
      baseUrl,
      "/api/exercises?q=bench",
    );
    const benchSearchData = expectSuccess(
      benchSearchResponse,
      200,
      "GET /api/exercises?q=bench",
    );
    const benchExercise = benchSearchData.items[0];
    assert(benchExercise !== undefined, "Bench search should return one exercise.");
    console.log("OK 200 GET /api/exercises?q=bench");

    const squatSearchResponse = await requestJson<ExerciseSearchData>(
      baseUrl,
      "/api/exercises?q=squat",
    );
    const squatSearchData = expectSuccess(
      squatSearchResponse,
      200,
      "GET /api/exercises?q=squat",
    );
    const squatExercise = squatSearchData.items[0];
    assert(squatExercise !== undefined, "Squat search should return one exercise.");
    console.log("OK 200 GET /api/exercises?q=squat");

    const primaryWorkoutOneResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      "/api/workouts",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          performed_at: "2026-04-29T09:00:00Z",
          duration_minutes: 45,
          notes: "Tool executor smoke workout one",
          sets: [
            {
              exercise_id: benchExercise.id,
              set_index: 1,
              reps: 8,
              weight_kg: 80,
              rpe: 8,
              is_warmup: false,
              notes: "bench set 1",
            },
            {
              exercise_id: benchExercise.id,
              set_index: 2,
              reps: 6,
              weight_kg: 85,
              rpe: 9,
              is_warmup: false,
              notes: "bench set 2",
            },
            {
              exercise_id: squatExercise.id,
              set_index: 1,
              reps: 5,
              weight_kg: 120,
              rpe: 8,
              is_warmup: false,
              notes: "squat set 1",
            },
          ],
        }),
      },
    );
    const primaryWorkoutOne = expectSuccess(
      primaryWorkoutOneResponse,
      201,
      "POST /api/workouts primary tool executor workout one",
    ).workout;
    primaryWorkoutIdOne = primaryWorkoutOne.id;
    console.log("OK 201 POST /api/workouts primary tool executor workout one");

    const primaryWorkoutTwoResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      "/api/workouts",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          performed_at: "2026-04-30T09:00:00Z",
          duration_minutes: 40,
          notes: "Tool executor smoke workout two",
          sets: [
            {
              exercise_id: benchExercise.id,
              set_index: 1,
              reps: 5,
              weight_kg: 90,
              rpe: 9,
              is_warmup: false,
              notes: "bench set 3",
            },
          ],
        }),
      },
    );
    const primaryWorkoutTwo = expectSuccess(
      primaryWorkoutTwoResponse,
      201,
      "POST /api/workouts primary tool executor workout two",
    ).workout;
    primaryWorkoutIdTwo = primaryWorkoutTwo.id;
    console.log("OK 201 POST /api/workouts primary tool executor workout two");

    const secondaryWorkoutResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      "/api/workouts",
      {
        method: "POST",
        headers: createAuthHeaders(secondaryToken),
        body: JSON.stringify({
          performed_at: "2026-04-29T11:00:00Z",
          duration_minutes: 30,
          notes: "Other user workout for isolation",
          sets: [
            {
              exercise_id: benchExercise.id,
              set_index: 1,
              reps: 12,
              weight_kg: 40,
              rpe: 7,
              is_warmup: false,
              notes: "other user bench set",
            },
          ],
        }),
      },
    );
    const secondaryWorkout = expectSuccess(
      secondaryWorkoutResponse,
      201,
      "POST /api/workouts secondary tool executor workout",
    ).workout;
    secondaryWorkoutId = secondaryWorkout.id;
    console.log("OK 201 POST /api/workouts secondary tool executor workout");

    const trainingSummaryResult = await executeAiTool(
      { userId: primaryAuth.user.id },
      "get_training_summary",
      {
        start_date: "2026-04-29",
        end_date: "2026-04-30",
      },
    );
    assert(
      typeof trainingSummaryResult === "object" && trainingSummaryResult !== null,
      "Training summary tool should return structured data.",
    );
    const summary = trainingSummaryResult as {
      totals: {
        workout_count: number;
        set_count: number;
        total_reps: number;
        total_volume: number;
      };
      by_exercise: Array<{
        exercise_id: string;
      }>;
      evidence: {
        workout_ids: string[];
      };
    };
    assert(
      summary.totals.workout_count === 2 &&
        summary.totals.set_count === 4 &&
        summary.totals.total_reps === 24 &&
        summary.totals.total_volume === 2200,
      "Training summary tool should return deterministic totals for the authenticated user.",
    );
    assert(
      summary.evidence.workout_ids.includes(primaryWorkoutIdOne) &&
        summary.evidence.workout_ids.includes(primaryWorkoutIdTwo) &&
        !summary.evidence.workout_ids.includes(secondaryWorkoutId),
      "Training summary tool should preserve user isolation in evidence.",
    );
    const successfulLogs = await loadRecentLogsForUser(primaryAuth.user.id);
    const successfulTrainingSummaryLog = successfulLogs.find(
      (log) =>
        log.tool_name === "get_training_summary" && log.status === "success",
    );

    assert(
      successfulTrainingSummaryLog !== undefined,
      "Successful training summary execution should persist a success log row.",
    );
    assert(
      successfulTrainingSummaryLog.user_id === primaryAuth.user.id,
      "Successful tool log should belong to the authenticated user.",
    );
    assert(
      successfulTrainingSummaryLog.message_id === null,
      "Internal executor logs should persist a null message_id.",
    );
    assert(
      typeof successfulTrainingSummaryLog.duration_ms === "number" &&
        successfulTrainingSummaryLog.duration_ms >= 0,
      "Successful tool log should persist a non-negative duration_ms.",
    );
    assert(
      isRecord(successfulTrainingSummaryLog.tool_input) &&
        successfulTrainingSummaryLog.tool_input.start_date === "2026-04-29" &&
        successfulTrainingSummaryLog.tool_input.end_date === "2026-04-30" &&
        !("user_id" in successfulTrainingSummaryLog.tool_input),
      "Successful tool log should persist only the expected training summary args.",
    );
    assert(
      isRecord(successfulTrainingSummaryLog.tool_output) &&
        successfulTrainingSummaryLog.tool_output.by_exercise_count === 2 &&
        successfulTrainingSummaryLog.tool_output.evidence_workout_count === 2 &&
        isRecord(successfulTrainingSummaryLog.tool_output.totals) &&
        successfulTrainingSummaryLog.tool_output.totals.total_volume === 2200 &&
        !("by_exercise" in successfulTrainingSummaryLog.tool_output),
      "Successful tool log should persist a compact output summary instead of the full payload.",
    );
    assertNoSecretsInLog(successfulTrainingSummaryLog, primaryAuth.token, databaseUrl);
    console.log("OK executeAiTool get_training_summary");
    console.log("OK successful tool execution persists a sanitized success log");

    const exerciseProgressResult = await executeAiTool(
      { userId: primaryAuth.user.id },
      "get_exercise_progress",
      {
        exercise_id: benchExercise.id,
        start_date: "2026-04-29",
        end_date: "2026-04-30",
      },
    );
    assert(
      typeof exerciseProgressResult === "object" &&
        exerciseProgressResult !== null,
      "Exercise progress tool should return structured data.",
    );
    const progress = exerciseProgressResult as {
      totals: {
        workout_count: number;
        set_count: number;
        total_reps: number;
        total_volume: number;
        max_weight_kg: number | null;
        estimated_1rm_kg: number | null;
      };
      sessions: Array<{
        workout_id: string;
      }>;
      evidence: {
        workout_ids: string[];
        set_ids: string[];
      };
    };
    assert(
      progress.totals.workout_count === 2 &&
        progress.totals.set_count === 3 &&
        progress.totals.total_reps === 19 &&
        progress.totals.total_volume === 1600 &&
        progress.totals.max_weight_kg === 90 &&
        progress.totals.estimated_1rm_kg === 105,
      "Exercise progress tool should return deterministic totals for the requested exercise.",
    );
    assert(
      progress.sessions.length === 2 &&
        progress.evidence.workout_ids.includes(primaryWorkoutIdOne) &&
        progress.evidence.workout_ids.includes(primaryWorkoutIdTwo) &&
        !progress.evidence.workout_ids.includes(secondaryWorkoutId),
      "Exercise progress tool should preserve user isolation and session structure.",
    );
    console.log("OK executeAiTool get_exercise_progress");

    const recommendationContextResult = await executeAiTool(
      { userId: primaryAuth.user.id },
      "get_recommendation_context",
      {
        start_date: "2026-04-29",
        end_date: "2026-04-30",
      },
    );
    assert(
      typeof recommendationContextResult === "object" &&
        recommendationContextResult !== null,
      "Recommendation context tool should return structured data.",
    );
    const context = recommendationContextResult as {
      summary: {
        workout_count: number;
        set_count: number;
        total_reps: number;
        total_volume: number;
      };
      focus_exercises: Array<{
        exercise_id: string;
      }>;
      recent_workouts: Array<{
        workout_id: string;
      }>;
      evidence: {
        source: string;
        workout_ids: string[];
      };
    };
    assert(
      context.summary.workout_count === 2 &&
        context.summary.set_count === 4 &&
        context.summary.total_reps === 24 &&
        context.summary.total_volume === 2200,
      "Recommendation context tool should return deterministic summary data.",
    );
    assert(
      context.focus_exercises.length === 2 &&
        context.recent_workouts.length === 2 &&
        context.evidence.source === "deterministic_calculation_layer" &&
        !context.evidence.workout_ids.includes(secondaryWorkoutId),
      "Recommendation context tool should return structured sections and preserve isolation.",
    );
    console.log("OK executeAiTool get_recommendation_context");

    try {
      await executeAiTool(
        { userId: primaryAuth.user.id },
        "does_not_exist",
        {},
      );
      throw new Error("Unknown tool scenario should have thrown.");
    } catch (error) {
      assert(
        error instanceof UnknownAiToolError,
        "Unknown tool scenario should throw UnknownAiToolError.",
      );
      assert(
        error.code === "UNKNOWN_TOOL",
        "Unknown tool error should expose UNKNOWN_TOOL code.",
      );
    }
    const logsAfterUnknownTool = await loadRecentLogsForUser(primaryAuth.user.id);
    const unknownToolLog = logsAfterUnknownTool.find(
      (log) => log.tool_name === "does_not_exist" && log.status === "error",
    );

    assert(
      unknownToolLog !== undefined,
      "Unknown tool execution should persist an error log row.",
    );
    assert(
      unknownToolLog.error_message === "Unknown tool: does_not_exist",
      "Unknown tool log should persist the unknown tool error message.",
    );
    assert(
      isRecord(unknownToolLog.tool_output) &&
        unknownToolLog.tool_output.error_code === "UNKNOWN_TOOL",
      "Unknown tool log should persist compact unknown-tool metadata.",
    );
    assertNoSecretsInLog(unknownToolLog, primaryAuth.token, databaseUrl);
    console.log("OK unknown tool returns typed error");
    console.log("OK unknown tool execution persists an error log");

    try {
      await executeAiTool(
        { userId: primaryAuth.user.id },
        "get_training_summary",
        {
          start_date: "2026-04-30",
          end_date: "2026-04-29",
        },
      );
      throw new Error("Invalid args scenario should have thrown.");
    } catch (error) {
      assert(
        error instanceof AiToolValidationError,
        "Invalid args scenario should throw AiToolValidationError.",
      );
      assert(
        error.code === "VALIDATION_ERROR",
        "Validation error should expose VALIDATION_ERROR code.",
      );
      assert(
        error.issues.some((issue) => issue.path === "end_date"),
        "Invalid range validation should report end_date.",
      );
    }
    const logsAfterValidationFailure = await loadRecentLogsForUser(
      primaryAuth.user.id,
    );
    const validationFailureLog = logsAfterValidationFailure.find(
      (log) =>
        log.tool_name === "get_training_summary" &&
        log.status === "error" &&
        log.error_message === "Tool argument validation failed.",
    );

    assert(
      validationFailureLog !== undefined,
      "Validation failure should persist an error log row.",
    );
    assert(
      isRecord(validationFailureLog.tool_output) &&
        validationFailureLog.tool_output.error_code === "VALIDATION_ERROR" &&
        validationFailureLog.tool_output.issue_count === 1 &&
        Array.isArray(validationFailureLog.tool_output.issue_paths) &&
        validationFailureLog.tool_output.issue_paths.includes("end_date"),
      "Validation failure log should persist compact validation metadata.",
    );
    assertNoSecretsInLog(validationFailureLog, primaryAuth.token, databaseUrl);
    console.log("OK invalid args return typed validation error");
    console.log("OK validation failure persists an error log");

    try {
      await executeAiTool(
        { userId: primaryAuth.user.id },
        "get_training_summary",
        {
          start_date: "2026-04-29",
          end_date: "2026-04-30",
          user_id: secondaryAuth.user.id,
        },
      );
      throw new Error("Injected user_id scenario should have thrown.");
    } catch (error) {
      assert(
        error instanceof AiToolValidationError,
        "Injected user_id should be rejected as a validation error.",
      );
      assert(
        error.issues.some((issue) => issue.path === ""),
        "Injected user_id should fail strict object validation.",
      );
    }
    const logsAfterInjectedUserId = await loadRecentLogsForUser(primaryAuth.user.id);
    const injectedUserIdLog = logsAfterInjectedUserId.find(
      (log) =>
        log.tool_name === "get_training_summary" &&
        log.status === "error" &&
        isRecord(log.tool_input) &&
        log.tool_input.user_id === secondaryAuth.user.id,
    );

    assert(
      injectedUserIdLog !== undefined,
      "Injected user_id validation should persist a log row for review.",
    );
    assert(
      injectedUserIdLog.user_id === primaryAuth.user.id,
      "Persisted tool logs must remain scoped to the authenticated user.",
    );
    assertNoSecretsInLog(injectedUserIdLog, primaryAuth.token, databaseUrl);
    console.log("OK injected user_id is rejected and cannot override context");

    console.log("Tool executor smoke passed.");
  } finally {
    await deleteWorkoutIfNeeded(baseUrl, primaryToken ?? "", primaryWorkoutIdOne);
    await deleteWorkoutIfNeeded(baseUrl, primaryToken ?? "", primaryWorkoutIdTwo);
    await deleteWorkoutIfNeeded(baseUrl, secondaryToken ?? "", secondaryWorkoutId);
    await stopServer(server);
  }
}

void main().catch((error: unknown) => {
  console.error("Tool executor smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
