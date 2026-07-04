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

interface RecommendationContextData {
  range: {
    start_date: string;
    end_date: string;
  };
  summary: {
    workout_count: number;
    set_count: number;
    total_reps: number;
    total_volume: number;
    by_exercise: Array<{
      exercise_id: string;
      exercise_name: string;
      set_count: number;
      total_reps: number;
      total_volume: number;
    }>;
  };
  focus_exercises: Array<{
    exercise_id: string;
    exercise_name: string;
    workout_count: number;
    set_count: number;
    total_reps: number;
    total_volume: number;
    max_weight_kg: number | null;
    estimated_1rm_kg: number | null;
  }>;
  recent_workouts: Array<{
    workout_id: string;
    performed_at: string;
    notes: string | null;
    set_count: number;
    total_volume: number;
  }>;
  evidence: {
    source: "deterministic_calculation_layer";
    workout_ids: string[];
    set_ids: string[];
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

function buildRecommendationContextPath(
  startDate: string,
  endDate: string,
): string {
  const searchParams = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });

  return `/api/training/recommendation-context?${searchParams.toString()}`;
}

function expectApproxEqual(
  actual: number | null,
  expected: number,
  label: string,
): void {
  assert(actual !== null, `${label} should not be null.`);
  assert(
    Math.abs(actual - expected) < 0.000001,
    `${label} expected ${expected}, got ${actual}.`,
  );
}

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(scriptDir, "..", ".env.local");
  await loadEnvFile(envPath);

  assert(
    typeof process.env.DATABASE_URL === "string" &&
      process.env.DATABASE_URL.length > 0,
    "DATABASE_URL is required for recommendation context smoke.",
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
  const primaryEmail = `recommendation-context-smoke-${uniqueSuffix}@example.com`;
  const secondaryEmail = `recommendation-context-smoke-other-${uniqueSuffix}@example.com`;
  let primaryToken: string | null = null;
  let secondaryToken: string | null = null;
  let primaryWorkoutIdOne: string | null = null;
  let primaryWorkoutIdTwo: string | null = null;
  let secondaryWorkoutId: string | null = null;

  try {
    console.log(`Smoke base URL: ${baseUrl}`);

    const unauthorizedResponse = await requestJson<unknown>(
      baseUrl,
      buildRecommendationContextPath("2026-04-29", "2026-04-30"),
    );
    expectError(
      unauthorizedResponse,
      401,
      "UNAUTHORIZED",
      "GET /api/training/recommendation-context without token",
    );
    console.log(
      "OK 401 GET /api/training/recommendation-context without token",
    );

    const primaryAuth = await registerUser(
      baseUrl,
      primaryEmail,
      "Recommendation Context Smoke",
    );
    primaryToken = primaryAuth.token;
    console.log("OK 201 POST /api/auth/register primary user");

    const invalidStartDate = await requestJson<unknown>(
      baseUrl,
      buildRecommendationContextPath("2026-04-99", "2026-04-30"),
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
      "GET /api/training/recommendation-context invalid start_date",
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
      buildRecommendationContextPath("2026-04-30", "2026-04-29"),
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
      "GET /api/training/recommendation-context end_date before start_date",
    );
    assert(
      invalidRangeError.details?.issues?.some(
        (issue) => issue.path === "end_date",
      ) ?? false,
      "Invalid range response should include an end_date issue.",
    );
    console.log("OK 400 end_date before start_date validation");

    const emptyContextResponse = await requestJson<RecommendationContextData>(
      baseUrl,
      buildRecommendationContextPath("2026-04-28", "2026-04-28"),
      {
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    const emptyContext = expectSuccess(
      emptyContextResponse,
      200,
      "GET /api/training/recommendation-context empty range",
    );
    assert(
      emptyContext.summary.workout_count === 0 &&
        emptyContext.summary.set_count === 0 &&
        emptyContext.summary.total_reps === 0 &&
        emptyContext.summary.total_volume === 0,
      "Empty context should return zero summary totals.",
    );
    assert(
      emptyContext.focus_exercises.length === 0,
      "Empty context should return no focus exercises.",
    );
    assert(
      emptyContext.recent_workouts.length === 0,
      "Empty context should return no recent workouts.",
    );
    assert(
      emptyContext.evidence.workout_ids.length === 0 &&
        emptyContext.evidence.set_ids.length === 0,
      "Empty context should return no evidence ids.",
    );
    console.log("OK 200 empty recommendation context");

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
    assert(
      benchExercise !== undefined,
      "Bench search should return one exercise.",
    );

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
    assert(
      squatExercise !== undefined,
      "Squat search should return one exercise.",
    );
    console.log("OK 200 exercise searches");

    const primaryWorkoutOneResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      "/api/workouts",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          performed_at: "2026-04-29T09:00:00Z",
          duration_minutes: 45,
          notes: "Primary recommendation context workout one",
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
      "POST /api/workouts primary recommendation context workout one",
    ).workout;
    primaryWorkoutIdOne = primaryWorkoutOne.id;
    const workoutOneBenchSets = primaryWorkoutOne.sets.filter(
      (setItem) => setItem.exercise_id === benchExercise.id,
    );
    const workoutOneSquatSets = primaryWorkoutOne.sets.filter(
      (setItem) => setItem.exercise_id === squatExercise.id,
    );
    console.log(
      "OK 201 POST /api/workouts primary recommendation context workout one",
    );

    const primaryWorkoutTwoResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      "/api/workouts",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          performed_at: "2026-04-30T09:00:00Z",
          duration_minutes: 40,
          notes: "Primary recommendation context workout two",
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
      "POST /api/workouts primary recommendation context workout two",
    ).workout;
    primaryWorkoutIdTwo = primaryWorkoutTwo.id;
    const workoutTwoBenchSet = primaryWorkoutTwo.sets[0];
    assert(
      workoutTwoBenchSet !== undefined,
      "Primary workout two should contain one bench set.",
    );
    console.log(
      "OK 201 POST /api/workouts primary recommendation context workout two",
    );

    const secondaryAuth = await registerUser(
      baseUrl,
      secondaryEmail,
      "Recommendation Context Smoke Other User",
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
          performed_at: "2026-04-29T11:00:00Z",
          duration_minutes: 30,
          notes: "Secondary recommendation context workout",
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
      "POST /api/workouts secondary recommendation context workout",
    ).workout;
    secondaryWorkoutId = secondaryWorkout.id;
    console.log(
      "OK 201 POST /api/workouts secondary recommendation context workout",
    );

    const contextResponse = await requestJson<RecommendationContextData>(
      baseUrl,
      buildRecommendationContextPath("2026-04-29", "2026-04-30"),
      {
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    const context = expectSuccess(
      contextResponse,
      200,
      "GET /api/training/recommendation-context populated range",
    );
    assert(
      context.summary.workout_count === 2 &&
        context.summary.set_count === 4 &&
        context.summary.total_reps === 24 &&
        context.summary.total_volume === 2200,
      "Context summary totals should match the created primary workouts.",
    );
    assert(
      context.summary.by_exercise.length === 2,
      "Context summary should include two exercise rows.",
    );
    assert(
      context.summary.by_exercise[0]?.exercise_id === benchExercise.id &&
        context.summary.by_exercise[0].total_volume === 1600,
      "Bench should be the top summary exercise by total_volume.",
    );
    assert(
      context.summary.by_exercise[1]?.exercise_id === squatExercise.id &&
        context.summary.by_exercise[1].total_volume === 600,
      "Squat should be the second summary exercise.",
    );
    assert(
      context.focus_exercises.length === 2,
      "Focus exercises should reflect the top summary exercises only.",
    );
    assert(
      context.focus_exercises[0]?.exercise_id === benchExercise.id &&
        context.focus_exercises[0].total_volume === 1600 &&
        context.focus_exercises[0].max_weight_kg === 90,
      "Bench focus exercise should reuse progress totals and max weight.",
    );
    expectApproxEqual(
      context.focus_exercises[0]?.estimated_1rm_kg ?? null,
      105,
      "Bench focus exercise estimated_1rm_kg",
    );
    assert(
      context.focus_exercises[1]?.exercise_id === squatExercise.id &&
        context.focus_exercises[1].total_volume === 600 &&
        context.focus_exercises[1].max_weight_kg === 120,
      "Squat focus exercise should reuse progress totals and max weight.",
    );
    expectApproxEqual(
      context.focus_exercises[1]?.estimated_1rm_kg ?? null,
      140,
      "Squat focus exercise estimated_1rm_kg",
    );
    assert(
      context.recent_workouts.length === 2,
      "Recent workouts should include the latest workouts in range.",
    );
    assert(
      context.recent_workouts[0]?.workout_id === primaryWorkoutIdTwo &&
        context.recent_workouts[1]?.workout_id === primaryWorkoutIdOne,
      "Recent workouts should be ordered latest-first.",
    );
    assert(
      context.recent_workouts[0]?.set_count === 1 &&
        context.recent_workouts[0].total_volume === 450 &&
        context.recent_workouts[1]?.set_count === 3 &&
        context.recent_workouts[1].total_volume === 1750,
      "Recent workouts should expose set_count and total_volume rollups.",
    );
    assert(
      context.evidence.source === "deterministic_calculation_layer",
      "Evidence source should match the deterministic calculation layer contract.",
    );
    assert(
      context.evidence.workout_ids.includes(primaryWorkoutIdOne) &&
        context.evidence.workout_ids.includes(primaryWorkoutIdTwo),
      "Evidence workout_ids should include the created primary workout ids.",
    );
    assert(
      !context.evidence.workout_ids.includes(secondaryWorkoutId),
      "Evidence workout_ids must exclude another user's workout id.",
    );
    assert(
      context.evidence.set_ids.length === 4,
      "Evidence set_ids should include progress set ids for both focus exercises.",
    );
    assert(
      workoutOneBenchSets.every((setItem) =>
        context.evidence.set_ids.includes(setItem.id),
      ) &&
        workoutOneSquatSets.every((setItem) =>
          context.evidence.set_ids.includes(setItem.id),
        ) &&
        context.evidence.set_ids.includes(workoutTwoBenchSet.id),
      "Evidence set_ids should include all focus exercise set ids from created primary workouts.",
    );
    assert(
      context.evidence.calculation_rules.length > 0,
      "Evidence calculation_rules should be non-empty.",
    );
    console.log(
      "OK 200 populated recommendation context with expected sections",
    );

    const secondaryContextResponse =
      await requestJson<RecommendationContextData>(
        baseUrl,
        buildRecommendationContextPath("2026-04-29", "2026-04-30"),
        {
          headers: {
            authorization: `Bearer ${secondaryToken}`,
          },
        },
      );
    const secondaryContext = expectSuccess(
      secondaryContextResponse,
      200,
      "GET /api/training/recommendation-context secondary user isolation",
    );
    assert(
      secondaryContext.summary.workout_count === 1 &&
        secondaryContext.summary.set_count === 1 &&
        secondaryContext.summary.total_reps === 12 &&
        secondaryContext.summary.total_volume === 480,
      "Secondary context should only include the secondary user's workout data.",
    );
    assert(
      secondaryContext.focus_exercises.length === 1 &&
        secondaryContext.focus_exercises[0]?.exercise_id === benchExercise.id,
      "Secondary context should only include the secondary user's top exercise.",
    );
    assert(
      secondaryContext.evidence.workout_ids.length === 1 &&
        secondaryContext.evidence.workout_ids[0] === secondaryWorkoutId,
      "Secondary evidence should only expose the secondary workout id.",
    );
    console.log("OK 200 recommendation context user isolation");

    const deleteWorkoutOneResponse = await requestJson<DeleteResponseData>(
      baseUrl,
      `/api/workouts/${primaryWorkoutIdOne}`,
      {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    expectSuccess(
      deleteWorkoutOneResponse,
      200,
      "DELETE /api/workouts/:id primary recommendation context workout one",
    );
    primaryWorkoutIdOne = null;
    console.log(
      "OK 200 DELETE /api/workouts/:id primary recommendation context workout one",
    );

    const deleteWorkoutTwoResponse = await requestJson<DeleteResponseData>(
      baseUrl,
      `/api/workouts/${primaryWorkoutIdTwo}`,
      {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    expectSuccess(
      deleteWorkoutTwoResponse,
      200,
      "DELETE /api/workouts/:id primary recommendation context workout two",
    );
    primaryWorkoutIdTwo = null;
    console.log(
      "OK 200 DELETE /api/workouts/:id primary recommendation context workout two",
    );

    const contextAfterDeleteResponse =
      await requestJson<RecommendationContextData>(
        baseUrl,
        buildRecommendationContextPath("2026-04-29", "2026-04-30"),
        {
          headers: {
            authorization: `Bearer ${primaryToken}`,
          },
        },
      );
    const contextAfterDelete = expectSuccess(
      contextAfterDeleteResponse,
      200,
      "GET /api/training/recommendation-context after delete",
    );
    assert(
      contextAfterDelete.summary.workout_count === 0 &&
        contextAfterDelete.summary.set_count === 0 &&
        contextAfterDelete.summary.total_reps === 0 &&
        contextAfterDelete.summary.total_volume === 0,
      "Context after delete should return zero summary totals.",
    );
    assert(
      contextAfterDelete.focus_exercises.length === 0 &&
        contextAfterDelete.recent_workouts.length === 0,
      "Context after delete should no longer include focus exercises or recent workouts.",
    );
    assert(
      contextAfterDelete.evidence.workout_ids.length === 0 &&
        contextAfterDelete.evidence.set_ids.length === 0,
      "Context after delete should no longer expose evidence ids.",
    );
    console.log("OK 200 recommendation context after cleanup");

    console.log("Recommendation context API smoke passed.");
  } finally {
    await deleteWorkoutIfNeeded(
      baseUrl,
      primaryToken ?? "",
      primaryWorkoutIdOne,
    );
    await deleteWorkoutIfNeeded(
      baseUrl,
      primaryToken ?? "",
      primaryWorkoutIdTwo,
    );
    await deleteWorkoutIfNeeded(
      baseUrl,
      secondaryToken ?? "",
      secondaryWorkoutId,
    );
    await stopServer(server);
  }
}

void main().catch((error: unknown) => {
  console.error("Recommendation context API smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
