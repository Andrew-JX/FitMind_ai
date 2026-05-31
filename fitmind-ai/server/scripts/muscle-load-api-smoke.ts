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

interface MuscleLoadGroupData {
  muscle_group_id: string;
  muscle_group_name: string;
  set_count: number;
  total_reps: number;
  raw_volume: number;
  weighted_volume: number;
  contribution_ratio: number;
  top_exercises: Array<{
    exercise_id: string;
    exercise_name: string;
    weighted_volume: number;
    set_count: number;
  }>;
}

interface MuscleLoadData {
  range: {
    start_date: string;
    end_date: string;
  };
  totals: {
    workout_count: number;
    set_count: number;
    total_reps: number;
    total_raw_volume: number;
    total_weighted_volume: number;
    muscle_group_count: number;
  };
  by_muscle_group: MuscleLoadGroupData[];
  top_muscle_groups: MuscleLoadGroupData[];
  low_volume_muscle_groups: MuscleLoadGroupData[];
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

async function findExerciseId(
  baseUrl: string,
  query: string,
  code: string,
): Promise<string> {
  const response = await requestJson<ExerciseSearchData>(
    baseUrl,
    `/api/exercises?q=${encodeURIComponent(query)}`,
  );
  const data = expectSuccess(response, 200, `GET /api/exercises?q=${query}`);
  const exercise = data.items.find((item) => item.code === code);

  assert(
    exercise !== undefined,
    `Exercise search for ${query} did not include ${code}.`,
  );

  return exercise.id;
}

async function deleteWorkoutIfNeeded(
  baseUrl: string,
  token: string | null,
  workoutId: string | null,
): Promise<void> {
  if (token === null || workoutId === null) {
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
    // Best-effort cleanup keeps the main smoke failure easy to read.
  }
}

function findMuscleGroup(
  muscleLoad: MuscleLoadData,
  expectedName: string,
): MuscleLoadGroupData {
  const group = muscleLoad.by_muscle_group.find(
    (item) => item.muscle_group_name.toLowerCase() === expectedName,
  );

  assert(group !== undefined, `Expected muscle group ${expectedName}.`);

  return group;
}

function assertRatioSumCloseToOne(muscleLoad: MuscleLoadData): void {
  const ratioSum = muscleLoad.by_muscle_group.reduce(
    (sum, item) => sum + item.contribution_ratio,
    0,
  );

  assert(
    Math.abs(ratioSum - 1) < 0.000001,
    `Expected contribution ratios to sum to 1, got ${ratioSum}.`,
  );
}

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(scriptDir, "..", ".env.local");
  await loadEnvFile(envPath);

  assert(
    typeof process.env.DATABASE_URL === "string" &&
      process.env.DATABASE_URL.length > 0,
    "DATABASE_URL is required for muscle-load smoke.",
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
  const primaryEmail = `muscle-load-smoke-${uniqueSuffix}@example.com`;
  const secondaryEmail = `muscle-load-smoke-other-${uniqueSuffix}@example.com`;
  let primaryToken: string | null = null;
  let primaryWorkoutId: string | null = null;
  let secondaryToken: string | null = null;
  let secondaryWorkoutId: string | null = null;

  try {
    console.log(`Smoke base URL: ${baseUrl}`);

    const unauthorized = await requestJson<unknown>(
      baseUrl,
      "/api/training/muscle-load?start_date=2026-04-29&end_date=2026-04-29",
    );
    expectError(
      unauthorized,
      401,
      "UNAUTHORIZED",
      "GET /api/training/muscle-load without token",
    );
    console.log("OK 401 GET /api/training/muscle-load without token");

    const primaryAuth = await registerUser(
      baseUrl,
      primaryEmail,
      "Muscle Load Smoke",
    );
    primaryToken = primaryAuth.token;
    console.log("OK 201 POST /api/auth/register primary user");

    const secondaryAuth = await registerUser(
      baseUrl,
      secondaryEmail,
      "Muscle Load Smoke Other User",
    );
    secondaryToken = secondaryAuth.token;
    console.log("OK 201 POST /api/auth/register secondary user");

    const benchPressId = await findExerciseId(
      baseUrl,
      "bench",
      "bench_press_barbell",
    );
    const rowId = await findExerciseId(baseUrl, "row", "barbell_row");
    console.log("OK 200 exercise lookup for bench press and row");

    const emptyResponse = await requestJson<MuscleLoadData>(
      baseUrl,
      "/api/training/muscle-load?start_date=2026-04-28&end_date=2026-04-28",
      {
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    const emptyMuscleLoad = expectSuccess(
      emptyResponse,
      200,
      "GET /api/training/muscle-load empty range",
    );
    assert(
      emptyMuscleLoad.totals.workout_count === 0 &&
        emptyMuscleLoad.totals.set_count === 0 &&
        emptyMuscleLoad.totals.total_weighted_volume === 0,
      "Empty muscle-load range should return zero totals.",
    );
    assert(
      emptyMuscleLoad.by_muscle_group.length === 0,
      "Empty muscle-load range should return no muscle groups.",
    );
    console.log("OK 200 empty range muscle-load");

    const primaryWorkoutResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      "/api/workouts",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          performed_at: "2026-04-29T12:00:00Z",
          duration_minutes: 55,
          notes: "Muscle load smoke workout",
          sets: [
            {
              exercise_id: benchPressId,
              set_index: 1,
              reps: 8,
              weight_kg: 90,
              rpe: 8,
              is_warmup: false,
              notes: "bench set 1",
            },
            {
              exercise_id: benchPressId,
              set_index: 2,
              reps: 6,
              weight_kg: 100,
              rpe: 9,
              is_warmup: false,
              notes: "bench set 2",
            },
            {
              exercise_id: rowId,
              set_index: 3,
              reps: 10,
              weight_kg: 70,
              rpe: 8,
              is_warmup: false,
              notes: "row set",
            },
          ],
        }),
      },
    );
    const primaryWorkout = expectSuccess(
      primaryWorkoutResponse,
      201,
      "POST /api/workouts primary muscle-load workout",
    ).workout;
    primaryWorkoutId = primaryWorkout.id;
    assert(
      primaryWorkout.sets.length === 3,
      "Primary muscle-load smoke workout should contain three sets.",
    );
    console.log("OK 201 POST /api/workouts primary muscle-load workout");

    const secondaryWorkoutResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      "/api/workouts",
      {
        method: "POST",
        headers: createAuthHeaders(secondaryToken),
        body: JSON.stringify({
          performed_at: "2026-04-29T13:00:00Z",
          duration_minutes: 30,
          notes: "Other user muscle-load workout",
          sets: [
            {
              exercise_id: benchPressId,
              set_index: 1,
              reps: 20,
              weight_kg: 120,
              rpe: 9,
              is_warmup: false,
              notes: "other user bench",
            },
          ],
        }),
      },
    );
    const secondaryWorkout = expectSuccess(
      secondaryWorkoutResponse,
      201,
      "POST /api/workouts secondary muscle-load workout",
    ).workout;
    secondaryWorkoutId = secondaryWorkout.id;
    console.log("OK 201 POST /api/workouts secondary muscle-load workout");

    const muscleLoadResponse = await requestJson<MuscleLoadData>(
      baseUrl,
      `/api/training/muscle-load?start_date=2026-04-29&end_date=2026-04-29&user_id=${secondaryAuth.user.id}`,
      {
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    const muscleLoad = expectSuccess(
      muscleLoadResponse,
      200,
      "GET /api/training/muscle-load populated range",
    );

    assert(
      muscleLoad.totals.workout_count === 1 &&
        muscleLoad.totals.set_count === 3 &&
        muscleLoad.totals.total_reps === 24 &&
        muscleLoad.totals.total_raw_volume === 2020,
      "Muscle-load totals should match the primary user's created workout.",
    );
    assert(
      muscleLoad.by_muscle_group.length > 0,
      "Muscle-load response should include by_muscle_group rows.",
    );
    assert(
      muscleLoad.evidence.workout_ids.includes(primaryWorkoutId),
      "Muscle-load evidence should include the primary workout id.",
    );
    assert(
      !muscleLoad.evidence.workout_ids.includes(secondaryWorkoutId),
      "Muscle-load endpoint must ignore user_id query injection.",
    );
    assert(
      primaryWorkout.sets.every((set) =>
        muscleLoad.evidence.set_ids.includes(set.id),
      ),
      "Muscle-load evidence should include the primary workout set ids.",
    );
    assert(
      muscleLoad.evidence.calculation_rules.length >= 5,
      "Muscle-load evidence should include calculation rules.",
    );

    const chest = findMuscleGroup(muscleLoad, "chest");
    const triceps = findMuscleGroup(muscleLoad, "triceps");
    const frontDelts = findMuscleGroup(muscleLoad, "front delts");

    assert(chest.weighted_volume > 0, "Chest should have weighted volume.");
    assert(triceps.weighted_volume > 0, "Triceps should have weighted volume.");
    assert(
      frontDelts.weighted_volume > 0,
      "Front delts should have weighted volume.",
    );
    assert(
      chest.top_exercises.some((item) => item.exercise_id === benchPressId),
      "Chest top exercises should include barbell bench press.",
    );
    assertRatioSumCloseToOne(muscleLoad);
    console.log(
      "OK 200 populated muscle-load with weighted groups, evidence, and injection isolation",
    );

    await deleteWorkoutIfNeeded(baseUrl, primaryToken, primaryWorkoutId);
    primaryWorkoutId = null;
    console.log("OK 200 DELETE /api/workouts/:id primary muscle-load workout");

    await deleteWorkoutIfNeeded(baseUrl, secondaryToken, secondaryWorkoutId);
    secondaryWorkoutId = null;
    console.log(
      "OK 200 DELETE /api/workouts/:id secondary muscle-load workout",
    );

    console.log("Muscle-load API smoke passed.");
  } finally {
    await deleteWorkoutIfNeeded(baseUrl, primaryToken, primaryWorkoutId);
    await deleteWorkoutIfNeeded(baseUrl, secondaryToken, secondaryWorkoutId);
    await stopServer(server);
  }
}

void main().catch((error: unknown) => {
  console.error("Muscle-load API smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
