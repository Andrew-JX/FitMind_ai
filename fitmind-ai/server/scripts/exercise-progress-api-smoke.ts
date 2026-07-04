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

interface ExerciseProgressData {
  range: {
    start_date: string;
    end_date: string;
  };
  exercise: {
    exercise_id: string;
    exercise_name: string | null;
  };
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
    performed_at: string;
    set_count: number;
    total_reps: number;
    total_volume: number;
    max_weight_kg: number | null;
    estimated_1rm_kg: number | null;
    set_ids: string[];
  }>;
  evidence: {
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

function buildExerciseProgressPath(
  exerciseId: string,
  startDate: string,
  endDate: string,
): string {
  const searchParams = new URLSearchParams({
    exercise_id: exerciseId,
    start_date: startDate,
    end_date: endDate,
  });

  return `/api/training/exercise-progress?${searchParams.toString()}`;
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
    "DATABASE_URL is required for exercise progress smoke.",
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
  const primaryEmail = `exercise-progress-smoke-${uniqueSuffix}@example.com`;
  const secondaryEmail = `exercise-progress-smoke-other-${uniqueSuffix}@example.com`;
  let primaryToken: string | null = null;
  let secondaryToken: string | null = null;
  let primaryWorkoutIdOne: string | null = null;
  let primaryWorkoutIdTwo: string | null = null;
  let secondaryWorkoutId: string | null = null;

  try {
    console.log(`Smoke base URL: ${baseUrl}`);

    const unauthorizedProgress = await requestJson<unknown>(
      baseUrl,
      "/api/training/exercise-progress?exercise_id=00000000-0000-0000-0000-000000000000&start_date=2026-04-29&end_date=2026-04-30",
    );
    expectError(
      unauthorizedProgress,
      401,
      "UNAUTHORIZED",
      "GET /api/training/exercise-progress without token",
    );
    console.log("OK 401 GET /api/training/exercise-progress without token");

    const primaryAuth = await registerUser(
      baseUrl,
      primaryEmail,
      "Exercise Progress Smoke",
    );
    primaryToken = primaryAuth.token;
    console.log("OK 201 POST /api/auth/register primary user");

    const missingExerciseId = await requestJson<unknown>(
      baseUrl,
      "/api/training/exercise-progress?start_date=2026-04-29&end_date=2026-04-30",
      {
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    const missingExerciseError = expectError(
      missingExerciseId,
      400,
      "VALIDATION_ERROR",
      "GET /api/training/exercise-progress missing exercise_id",
    );
    assert(
      missingExerciseError.details?.issues?.some(
        (issue) => issue.path === "exercise_id",
      ) ?? false,
      "Missing exercise_id response should include an exercise_id issue.",
    );
    console.log("OK 400 missing exercise_id validation");

    const invalidStartDate = await requestJson<unknown>(
      baseUrl,
      "/api/training/exercise-progress?exercise_id=00000000-0000-0000-0000-000000000000&start_date=2026-04-99&end_date=2026-04-30",
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
      "GET /api/training/exercise-progress invalid start_date",
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
      "/api/training/exercise-progress?exercise_id=00000000-0000-0000-0000-000000000000&start_date=2026-04-30&end_date=2026-04-29",
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
      "GET /api/training/exercise-progress end_date before start_date",
    );
    assert(
      invalidRangeError.details?.issues?.some(
        (issue) => issue.path === "end_date",
      ) ?? false,
      "Invalid range response should include an end_date issue.",
    );
    console.log("OK 400 end_date before start_date validation");

    const exerciseSearchResponse = await requestJson<ExerciseSearchData>(
      baseUrl,
      "/api/exercises?q=bench",
    );
    const exerciseSearchData = expectSuccess(
      exerciseSearchResponse,
      200,
      "GET /api/exercises?q=bench",
    );
    const benchExercise = exerciseSearchData.items[0];

    assert(
      benchExercise !== undefined,
      "Exercise search did not return a usable bench exercise.",
    );

    const otherExerciseSearchResponse = await requestJson<ExerciseSearchData>(
      baseUrl,
      "/api/exercises?q=squat",
    );
    const otherExerciseSearchData = expectSuccess(
      otherExerciseSearchResponse,
      200,
      "GET /api/exercises?q=squat",
    );
    const squatExercise = otherExerciseSearchData.items[0];

    assert(
      squatExercise !== undefined,
      "Exercise search did not return a usable squat exercise.",
    );
    console.log("OK 200 exercise searches");

    const emptyProgressResponse = await requestJson<ExerciseProgressData>(
      baseUrl,
      buildExerciseProgressPath(benchExercise.id, "2026-04-28", "2026-04-28"),
      {
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    const emptyProgress = expectSuccess(
      emptyProgressResponse,
      200,
      "GET /api/training/exercise-progress empty range",
    );
    assert(
      emptyProgress.totals.workout_count === 0 &&
        emptyProgress.totals.set_count === 0 &&
        emptyProgress.totals.total_reps === 0 &&
        emptyProgress.totals.total_volume === 0,
      "Empty range progress should return zero totals.",
    );
    assert(
      emptyProgress.totals.max_weight_kg === null &&
        emptyProgress.totals.estimated_1rm_kg === null,
      "Empty range progress should return null max/1RM totals.",
    );
    assert(
      emptyProgress.sessions.length === 0,
      "Empty range progress should return an empty sessions array.",
    );
    assert(
      emptyProgress.evidence.workout_ids.length === 0 &&
        emptyProgress.evidence.set_ids.length === 0,
      "Empty range progress should return no evidence ids.",
    );
    console.log("OK 200 empty range exercise progress");

    const primaryWorkoutOneResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      "/api/workouts",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          performed_at: "2026-04-29T09:00:00Z",
          duration_minutes: 45,
          notes: "Primary exercise progress workout one",
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
              notes: "unrelated squat set",
            },
          ],
        }),
      },
    );
    const primaryWorkoutOne = expectSuccess(
      primaryWorkoutOneResponse,
      201,
      "POST /api/workouts primary exercise progress workout one",
    ).workout;
    primaryWorkoutIdOne = primaryWorkoutOne.id;
    const workoutOneBenchSets = primaryWorkoutOne.sets.filter(
      (setItem) => setItem.exercise_id === benchExercise.id,
    );
    const workoutOneSquatSets = primaryWorkoutOne.sets.filter(
      (setItem) => setItem.exercise_id === squatExercise.id,
    );
    assert(
      workoutOneBenchSets.length === 2 && workoutOneSquatSets.length === 1,
      "Primary workout one should contain two bench sets and one squat set.",
    );
    console.log(
      "OK 201 POST /api/workouts primary exercise progress workout one",
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
          notes: "Primary exercise progress workout two",
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
      "POST /api/workouts primary exercise progress workout two",
    ).workout;
    primaryWorkoutIdTwo = primaryWorkoutTwo.id;
    const workoutTwoBenchSet = primaryWorkoutTwo.sets[0];
    assert(
      workoutTwoBenchSet !== undefined,
      "Primary workout two should contain one bench set.",
    );
    console.log(
      "OK 201 POST /api/workouts primary exercise progress workout two",
    );

    const secondaryAuth = await registerUser(
      baseUrl,
      secondaryEmail,
      "Exercise Progress Smoke Other User",
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
          notes: "Secondary user bench workout",
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
      "POST /api/workouts secondary exercise progress workout",
    ).workout;
    secondaryWorkoutId = secondaryWorkout.id;
    console.log(
      "OK 201 POST /api/workouts secondary exercise progress workout",
    );

    const progressResponse = await requestJson<ExerciseProgressData>(
      baseUrl,
      buildExerciseProgressPath(benchExercise.id, "2026-04-29", "2026-04-30"),
      {
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    const progress = expectSuccess(
      progressResponse,
      200,
      "GET /api/training/exercise-progress populated range",
    );
    const expectedSetIds = [
      ...workoutOneBenchSets.map((setItem) => setItem.id),
      workoutTwoBenchSet.id,
    ].sort();
    const actualEvidenceSetIds = [...progress.evidence.set_ids].sort();
    const actualWorkoutIds = [...progress.evidence.workout_ids].sort();

    assert(
      progress.exercise.exercise_id === benchExercise.id &&
        progress.exercise.exercise_name === benchExercise.name_en,
      "Progress response should echo the requested exercise.",
    );
    assert(
      progress.totals.workout_count === 2,
      "Bench progress should count two workouts.",
    );
    assert(
      progress.totals.set_count === 3,
      "Bench progress should count exactly three matching sets.",
    );
    assert(
      progress.totals.total_reps === 19,
      "Bench progress should sum total_reps to 19.",
    );
    assert(
      progress.totals.total_volume === 1600,
      "Bench progress should sum total_volume to 1600.",
    );
    assert(
      progress.totals.max_weight_kg === 90,
      "Bench progress should report max_weight_kg as 90.",
    );
    expectApproxEqual(
      progress.totals.estimated_1rm_kg,
      105,
      "Bench progress estimated_1rm_kg",
    );
    assert(
      JSON.stringify(actualWorkoutIds) ===
        JSON.stringify([primaryWorkoutIdOne, primaryWorkoutIdTwo].sort()),
      "Bench progress evidence.workout_ids should contain both primary workout ids only.",
    );
    assert(
      JSON.stringify(actualEvidenceSetIds) === JSON.stringify(expectedSetIds),
      "Bench progress evidence.set_ids should contain only matching bench set ids.",
    );
    assert(
      !progress.evidence.set_ids.some((setId) =>
        workoutOneSquatSets.some((setItem) => setItem.id === setId),
      ),
      "Bench progress must exclude unrelated squat set ids from evidence.",
    );
    assert(
      progress.sessions.length === 2,
      "Bench progress should return two session rows.",
    );
    assert(
      progress.sessions[0]?.workout_id === primaryWorkoutIdOne &&
        progress.sessions[1]?.workout_id === primaryWorkoutIdTwo,
      "Bench progress sessions should be ordered by performed_at ASC, workout_id ASC.",
    );
    assert(
      progress.sessions[0]?.set_count === 2 &&
        progress.sessions[0].total_reps === 14 &&
        progress.sessions[0].total_volume === 1150 &&
        progress.sessions[0].max_weight_kg === 85,
      "Bench progress session one totals should match the first workout.",
    );
    expectApproxEqual(
      progress.sessions[0]?.estimated_1rm_kg ?? null,
      102,
      "Bench progress session one estimated_1rm_kg",
    );
    assert(
      JSON.stringify([...progress.sessions[0].set_ids].sort()) ===
        JSON.stringify(workoutOneBenchSets.map((setItem) => setItem.id).sort()),
      "Bench progress session one should expose only the first workout bench set ids.",
    );
    assert(
      progress.sessions[1]?.set_count === 1 &&
        progress.sessions[1].total_reps === 5 &&
        progress.sessions[1].total_volume === 450 &&
        progress.sessions[1].max_weight_kg === 90,
      "Bench progress session two totals should match the second workout.",
    );
    expectApproxEqual(
      progress.sessions[1]?.estimated_1rm_kg ?? null,
      105,
      "Bench progress session two estimated_1rm_kg",
    );
    assert(
      progress.evidence.calculation_rules.length > 0,
      "Progress response should include calculation rules.",
    );
    console.log("OK 200 populated range exercise progress");

    const secondaryProgressResponse = await requestJson<ExerciseProgressData>(
      baseUrl,
      buildExerciseProgressPath(benchExercise.id, "2026-04-29", "2026-04-30"),
      {
        headers: {
          authorization: `Bearer ${secondaryToken}`,
        },
      },
    );
    const secondaryProgress = expectSuccess(
      secondaryProgressResponse,
      200,
      "GET /api/training/exercise-progress secondary user isolation",
    );
    assert(
      secondaryProgress.totals.workout_count === 1 &&
        secondaryProgress.totals.set_count === 1 &&
        secondaryProgress.totals.total_reps === 12 &&
        secondaryProgress.totals.total_volume === 480 &&
        secondaryProgress.totals.max_weight_kg === 40,
      "Secondary user progress should only include that user's bench workout.",
    );
    expectApproxEqual(
      secondaryProgress.totals.estimated_1rm_kg,
      56,
      "Secondary user estimated_1rm_kg",
    );
    assert(
      secondaryProgress.evidence.workout_ids.length === 1 &&
        secondaryProgress.evidence.workout_ids[0] === secondaryWorkoutId,
      "Secondary user evidence should only include the secondary workout id.",
    );
    console.log("OK 200 secondary user isolation");

    const deleteWorkoutResponse = await requestJson<DeleteResponseData>(
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
      deleteWorkoutResponse,
      200,
      "DELETE /api/workouts/:id primary exercise progress workout one",
    );
    primaryWorkoutIdOne = null;
    console.log(
      "OK 200 DELETE /api/workouts/:id primary exercise progress workout one",
    );

    const progressAfterDeleteResponse = await requestJson<ExerciseProgressData>(
      baseUrl,
      buildExerciseProgressPath(benchExercise.id, "2026-04-29", "2026-04-30"),
      {
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    const progressAfterDelete = expectSuccess(
      progressAfterDeleteResponse,
      200,
      "GET /api/training/exercise-progress after delete",
    );
    assert(
      progressAfterDelete.totals.workout_count === 1 &&
        progressAfterDelete.totals.set_count === 1 &&
        progressAfterDelete.totals.total_reps === 5 &&
        progressAfterDelete.totals.total_volume === 450 &&
        progressAfterDelete.totals.max_weight_kg === 90,
      "Progress after delete should keep only the remaining bench workout.",
    );
    expectApproxEqual(
      progressAfterDelete.totals.estimated_1rm_kg,
      105,
      "Progress after delete estimated_1rm_kg",
    );
    assert(
      progressAfterDelete.sessions.length === 1 &&
        progressAfterDelete.sessions[0]?.workout_id === primaryWorkoutIdTwo,
      "Progress after delete should expose only the remaining workout session.",
    );
    assert(
      progressAfterDelete.evidence.workout_ids.length === 1 &&
        progressAfterDelete.evidence.workout_ids[0] === primaryWorkoutIdTwo,
      "Progress after delete should only expose the remaining workout id.",
    );
    assert(
      progressAfterDelete.evidence.set_ids.length === 1 &&
        progressAfterDelete.evidence.set_ids[0] === workoutTwoBenchSet.id,
      "Progress after delete should only expose the remaining bench set id.",
    );
    console.log("OK 200 progress no longer includes deleted workout");

    console.log("Exercise progress API smoke passed.");
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
  console.error("Exercise progress API smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
