import { access, readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

interface TrainingSummaryData {
  range: {
    start_date: string;
    end_date: string;
  };
  totals: {
    workout_count: number;
    set_count: number;
    total_reps: number;
    total_volume: number;
  };
  by_exercise: Array<{
    exercise_id: string;
    exercise_name: string;
    set_count: number;
    total_reps: number;
    total_volume: number;
  }>;
  evidence: {
    workout_ids: string[];
    calculation_rules: string[];
  };
}

const SMOKE_JWT_SECRET = "fitmind-smoke-secret";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
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

function expectError(
  response: { status: number; body: ApiResponse<unknown> },
  expectedStatus: number,
  expectedCode: string,
  label: string,
): ApiErrorResponse["error"] {
  assert(
    response.status === expectedStatus,
    `${label} expected HTTP ${expectedStatus}, got ${response.status}. body=${JSON.stringify(response.body)}`,
  );
  assert(!response.body.ok, `${label} expected error response.`);
  assert(
    response.body.error.code === expectedCode,
    `${label} expected error code ${expectedCode}, got ${response.body.error.code}.`,
  );

  return response.body.error;
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
    await requestJson<DeleteResponseData>(
      baseUrl,
      `/api/workouts/${workoutId}`,
      {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
  } catch {
    // Best-effort cleanup keeps the main smoke result actionable.
  }
}

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(scriptDir, "..", ".env.local");
  await loadEnvFile(envPath);

  assert(
    typeof process.env.DATABASE_URL === "string" &&
      process.env.DATABASE_URL.length > 0,
    "DATABASE_URL is required for training summary smoke.",
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

  const { server, baseUrl } = await startServer();
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const primaryEmail = `training-summary-smoke-${uniqueSuffix}@example.com`;
  const secondaryEmail = `training-summary-smoke-other-${uniqueSuffix}@example.com`;
  let primaryToken: string | null = null;
  let primaryWorkoutId: string | null = null;
  let secondaryToken: string | null = null;
  let secondaryWorkoutId: string | null = null;

  try {
    console.log(`Smoke base URL: ${baseUrl}`);

    const unauthorizedSummary = await requestJson<unknown>(
      baseUrl,
      "/api/training/summary?start_date=2026-04-29&end_date=2026-04-29",
    );
    expectError(
      unauthorizedSummary,
      401,
      "UNAUTHORIZED",
      "GET /api/training/summary without token",
    );
    console.log("OK 401 GET /api/training/summary without token");

    const primaryAuth = await registerUser(
      baseUrl,
      primaryEmail,
      "Training Summary Smoke",
    );
    primaryToken = primaryAuth.token;
    console.log("OK 201 POST /api/auth/register primary user");

    const invalidStartDate = await requestJson<unknown>(
      baseUrl,
      "/api/training/summary?start_date=2026-04-99&end_date=2026-04-29",
      {
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    const invalidStartError = expectError(
      invalidStartDate,
      400,
      "VALIDATION_ERROR",
      "GET /api/training/summary invalid start_date",
    );
    assert(
      invalidStartError.details?.issues?.some(
        (issue) => issue.path === "start_date",
      ) ?? false,
      "Invalid start_date response should include a start_date issue.",
    );
    console.log("OK 400 invalid start_date validation");

    const invalidRange = await requestJson<unknown>(
      baseUrl,
      "/api/training/summary?start_date=2026-04-30&end_date=2026-04-29",
      {
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    const invalidRangeError = expectError(
      invalidRange,
      400,
      "VALIDATION_ERROR",
      "GET /api/training/summary end_date before start_date",
    );
    assert(
      invalidRangeError.details?.issues?.some(
        (issue) => issue.path === "end_date",
      ) ?? false,
      "Invalid range response should include an end_date issue.",
    );
    console.log("OK 400 end_date before start_date validation");

    const emptySummaryResponse = await requestJson<TrainingSummaryData>(
      baseUrl,
      "/api/training/summary?start_date=2026-04-28&end_date=2026-04-28",
      {
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    const emptySummary = expectSuccess(
      emptySummaryResponse,
      200,
      "GET /api/training/summary empty range",
    );
    assert(
      emptySummary.totals.workout_count === 0 &&
        emptySummary.totals.set_count === 0 &&
        emptySummary.totals.total_reps === 0 &&
        emptySummary.totals.total_volume === 0,
      "Empty range summary should return zero totals.",
    );
    assert(
      emptySummary.by_exercise.length === 0,
      "Empty range summary should return an empty by_exercise array.",
    );
    assert(
      emptySummary.evidence.workout_ids.length === 0,
      "Empty range summary should return no workout ids.",
    );
    console.log("OK 200 empty range summary");

    const exerciseSearchResponse = await requestJson<ExerciseSearchData>(
      baseUrl,
      "/api/exercises?q=bench",
    );
    const exerciseSearchData = expectSuccess(
      exerciseSearchResponse,
      200,
      "GET /api/exercises?q=bench",
    );
    const exerciseId = exerciseSearchData.items[0]?.id;

    assert(
      typeof exerciseId === "string" && exerciseId.length > 0,
      "Exercise search did not return a usable exercise id.",
    );
    console.log("OK 200 GET /api/exercises?q=bench");

    const createdWorkoutResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      "/api/workouts",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          performed_at: "2026-04-29T23:59:59Z",
          duration_minutes: 50,
          notes: "Training summary regression smoke",
          sets: [
            {
              exercise_id: exerciseId,
              set_index: 1,
              reps: 8,
              weight_kg: 80,
              rpe: 8,
              is_warmup: false,
              notes: "set 1",
            },
            {
              exercise_id: exerciseId,
              set_index: 2,
              reps: 6,
              weight_kg: 85,
              rpe: 9,
              is_warmup: false,
              notes: "set 2",
            },
          ],
        }),
      },
    );
    const createdWorkout = expectSuccess(
      createdWorkoutResponse,
      201,
      "POST /api/workouts primary summary workout",
    ).workout;
    primaryWorkoutId = createdWorkout.id;
    assert(
      createdWorkout.sets.length === 2,
      "Primary summary smoke workout should contain two sets.",
    );
    console.log("OK 201 POST /api/workouts primary summary workout");

    const secondaryAuth = await registerUser(
      baseUrl,
      secondaryEmail,
      "Training Summary Smoke Other User",
    );
    secondaryToken = secondaryAuth.token;
    console.log("OK 201 POST /api/auth/register secondary user");

    const secondaryWorkoutResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      "/api/workouts",
      {
        method: "POST",
        headers: createAuthHeaders(secondaryToken),
        body: JSON.stringify({
          performed_at: "2026-04-29T12:00:00Z",
          duration_minutes: 35,
          notes: "Other user summary workout",
          sets: [
            {
              exercise_id: exerciseId,
              set_index: 1,
              reps: 12,
              weight_kg: 40,
              rpe: 7,
              is_warmup: false,
              notes: "other user set",
            },
          ],
        }),
      },
    );
    const secondaryWorkout = expectSuccess(
      secondaryWorkoutResponse,
      201,
      "POST /api/workouts secondary summary workout",
    ).workout;
    secondaryWorkoutId = secondaryWorkout.id;
    console.log("OK 201 POST /api/workouts secondary summary workout");

    const summaryResponse = await requestJson<TrainingSummaryData>(
      baseUrl,
      "/api/training/summary?start_date=2026-04-29&end_date=2026-04-29",
      {
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    const summary = expectSuccess(
      summaryResponse,
      200,
      "GET /api/training/summary populated range",
    );
    assert(
      summary.totals.workout_count === 1,
      "Primary user summary should count exactly one workout.",
    );
    assert(
      summary.totals.set_count === 2,
      "Primary user summary should count exactly two sets.",
    );
    assert(
      summary.totals.total_reps === 14,
      "Primary user summary should sum total_reps to 14.",
    );
    assert(
      summary.totals.total_volume === 1150,
      "Primary user summary should sum total_volume to 1150.",
    );
    assert(
      summary.evidence.workout_ids.includes(primaryWorkoutId),
      "Primary user summary should include the created workout id in evidence.",
    );
    assert(
      !summary.evidence.workout_ids.includes(secondaryWorkoutId),
      "Primary user summary must not include another user's workout id.",
    );
    assert(
      summary.by_exercise.length === 1,
      "Primary user summary should group both sets into one exercise row.",
    );
    assert(
      summary.by_exercise[0]?.exercise_id === exerciseId &&
        summary.by_exercise[0].set_count === 2 &&
        summary.by_exercise[0].total_reps === 14 &&
        summary.by_exercise[0].total_volume === 1150,
      "Primary user by_exercise row should match the created sets.",
    );
    assert(
      summary.evidence.calculation_rules.length > 0,
      "Summary evidence should include calculation rules.",
    );
    console.log("OK 200 populated range summary with totals and evidence");

    const secondarySummaryResponse = await requestJson<TrainingSummaryData>(
      baseUrl,
      "/api/training/summary?start_date=2026-04-29&end_date=2026-04-29",
      {
        headers: {
          authorization: `Bearer ${secondaryToken}`,
        },
      },
    );
    const secondarySummary = expectSuccess(
      secondarySummaryResponse,
      200,
      "GET /api/training/summary secondary user isolation",
    );
    assert(
      secondarySummary.totals.workout_count === 1 &&
        secondarySummary.totals.set_count === 1 &&
        secondarySummary.totals.total_reps === 12 &&
        secondarySummary.totals.total_volume === 480,
      "Secondary user summary should only include that user's workout data.",
    );
    assert(
      secondarySummary.evidence.workout_ids.length === 1 &&
        secondarySummary.evidence.workout_ids[0] === secondaryWorkoutId,
      "Secondary user evidence should only include the secondary workout id.",
    );
    console.log("OK 200 user isolation summary");

    const deletedWorkoutResponse = await requestJson<DeleteResponseData>(
      baseUrl,
      `/api/workouts/${primaryWorkoutId}`,
      {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    expectSuccess(
      deletedWorkoutResponse,
      200,
      "DELETE /api/workouts/:id primary summary workout",
    );
    primaryWorkoutId = null;
    console.log("OK 200 DELETE /api/workouts/:id primary summary workout");

    const summaryAfterDeleteResponse = await requestJson<TrainingSummaryData>(
      baseUrl,
      "/api/training/summary?start_date=2026-04-29&end_date=2026-04-29",
      {
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    const summaryAfterDelete = expectSuccess(
      summaryAfterDeleteResponse,
      200,
      "GET /api/training/summary after delete",
    );
    assert(
      summaryAfterDelete.totals.workout_count === 0 &&
        summaryAfterDelete.totals.set_count === 0 &&
        summaryAfterDelete.totals.total_reps === 0 &&
        summaryAfterDelete.totals.total_volume === 0,
      "Summary after delete should no longer include the deleted workout.",
    );
    assert(
      summaryAfterDelete.by_exercise.length === 0,
      "Summary after delete should return an empty by_exercise array.",
    );
    assert(
      !summaryAfterDelete.evidence.workout_ids.includes(createdWorkout.id),
      "Summary after delete must not include the deleted workout id.",
    );
    console.log("OK 200 summary no longer includes deleted workout");

    console.log("Training summary API smoke passed.");
  } finally {
    await deleteWorkoutIfNeeded(baseUrl, primaryToken ?? "", primaryWorkoutId);
    await deleteWorkoutIfNeeded(
      baseUrl,
      secondaryToken ?? "",
      secondaryWorkoutId,
    );
    await stopServer(server);
  }
}

void main().catch((error: unknown) => {
  console.error("Training summary API smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
