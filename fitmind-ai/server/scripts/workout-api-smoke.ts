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
    details?: Record<string, unknown> | undefined;
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

interface WorkoutListData {
  items: Array<{
    id: string;
  }>;
  next_cursor: string | null;
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
): void {
  assert(
    response.status === expectedStatus,
    `${label} expected HTTP ${expectedStatus}, got ${response.status}. body=${JSON.stringify(response.body)}`,
  );
  assert(!response.body.ok, `${label} expected error response.`);
  assert(
    response.body.error.code === expectedCode,
    `${label} expected error code ${expectedCode}, got ${response.body.error.code}.`,
  );
}

function createAuthHeaders(token: string): HeadersInit {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(scriptDir, "..", ".env.local");
  await loadEnvFile(envPath);

  assert(
    typeof process.env.DATABASE_URL === "string" &&
      process.env.DATABASE_URL.length > 0,
    "DATABASE_URL is required for workout smoke.",
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
  const email = `workout-smoke-${uniqueSuffix}@example.com`;
  const password = "Passw0rd!";
  let token: string | null = null;
  let workoutId: string | null = null;

  try {
    console.log(`Smoke base URL: ${baseUrl}`);

    const unauthorizedList = await requestJson<unknown>(
      baseUrl,
      "/api/workouts",
    );
    expectError(
      unauthorizedList,
      401,
      "UNAUTHORIZED",
      "GET /api/workouts without token",
    );
    console.log("OK 401 GET /api/workouts without token");

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
          password,
          display_name: "Workout Smoke",
        }),
      },
    );
    const registerData = expectSuccess(
      registerResponse,
      201,
      "POST /api/auth/register",
    );
    token = registerData.token;
    console.log("OK 201 POST /api/auth/register");

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

    const createWorkoutResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      "/api/workouts",
      {
        method: "POST",
        headers: createAuthHeaders(token),
        body: JSON.stringify({
          performed_at: "2026-04-29T10:00:00Z",
          duration_minutes: 55,
          notes: "Phase 1.2 smoke workout",
          sets: [
            {
              exercise_id: exerciseId,
              set_index: 1,
              reps: 8,
              weight_kg: 80,
              rpe: 8,
              is_warmup: false,
              notes: "opening set",
            },
          ],
        }),
      },
    );
    const createdWorkout = expectSuccess(
      createWorkoutResponse,
      201,
      "POST /api/workouts",
    ).workout;
    workoutId = createdWorkout.id;
    assert(
      createdWorkout.sets.length === 1,
      "Created workout should contain one set.",
    );
    console.log("OK 201 POST /api/workouts");

    const listWorkoutsResponse = await requestJson<WorkoutListData>(
      baseUrl,
      "/api/workouts",
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
    const listedWorkouts = expectSuccess(
      listWorkoutsResponse,
      200,
      "GET /api/workouts",
    );
    assert(
      listedWorkouts.items.some((item) => item.id === workoutId),
      "Workout list should include the created workout.",
    );
    console.log("OK 200 GET /api/workouts");

    const getWorkoutResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      `/api/workouts/${workoutId}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
    const workoutDetail = expectSuccess(
      getWorkoutResponse,
      200,
      "GET /api/workouts/:id",
    ).workout;
    const originalSetId = workoutDetail.sets[0]?.id;

    assert(
      typeof originalSetId === "string",
      "Workout detail should expose the created set id.",
    );
    console.log("OK 200 GET /api/workouts/:id");

    const updateWorkoutResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      `/api/workouts/${workoutId}`,
      {
        method: "PATCH",
        headers: createAuthHeaders(token),
        body: JSON.stringify({
          duration_minutes: 60,
          notes: "Phase 1.2 smoke workout updated",
        }),
      },
    );
    const updatedWorkout = expectSuccess(
      updateWorkoutResponse,
      200,
      "PATCH /api/workouts/:id",
    ).workout;
    assert(
      updatedWorkout.duration_minutes === 60,
      "Workout patch should update duration_minutes.",
    );
    console.log("OK 200 PATCH /api/workouts/:id");

    const addSetResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      `/api/workouts/${workoutId}/sets`,
      {
        method: "POST",
        headers: createAuthHeaders(token),
        body: JSON.stringify({
          exercise_id: exerciseId,
          set_index: 2,
          reps: 6,
          weight_kg: 85,
          rpe: 9,
          is_warmup: false,
          notes: "top set",
        }),
      },
    );
    const workoutAfterAddSet = expectSuccess(
      addSetResponse,
      201,
      "POST /api/workouts/:id/sets",
    ).workout;
    const addedSet = workoutAfterAddSet.sets.find((set) => set.set_index === 2);

    assert(
      addedSet !== undefined,
      "Added set should appear in workout detail.",
    );
    console.log("OK 201 POST /api/workouts/:id/sets");

    const updateSetResponse = await requestJson<{ set: WorkoutSetData }>(
      baseUrl,
      `/api/sets/${addedSet.id}`,
      {
        method: "PATCH",
        headers: createAuthHeaders(token),
        body: JSON.stringify({
          reps: 7,
          notes: "top set updated",
        }),
      },
    );
    const updatedSet = expectSuccess(
      updateSetResponse,
      200,
      "PATCH /api/sets/:id",
    ).set;
    assert(updatedSet.reps === 7, "Set patch should update reps.");
    console.log("OK 200 PATCH /api/sets/:id");

    const deleteSetResponse = await requestJson<DeleteResponseData>(
      baseUrl,
      `/api/sets/${addedSet.id}`,
      {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
    const deletedSet = expectSuccess(
      deleteSetResponse,
      200,
      "DELETE /api/sets/:id",
    );
    assert(
      deletedSet.deleted === true,
      "Set delete should return deleted=true.",
    );
    console.log("OK 200 DELETE /api/sets/:id");

    const deleteWorkoutResponse = await requestJson<DeleteResponseData>(
      baseUrl,
      `/api/workouts/${workoutId}`,
      {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
    const deletedWorkout = expectSuccess(
      deleteWorkoutResponse,
      200,
      "DELETE /api/workouts/:id",
    );
    assert(
      deletedWorkout.deleted === true,
      "Workout delete should return deleted=true.",
    );
    console.log("OK 200 DELETE /api/workouts/:id");
    workoutId = null;

    const deletedWorkoutFetch = await requestJson<unknown>(
      baseUrl,
      `/api/workouts/${deletedWorkout.id}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
    expectError(
      deletedWorkoutFetch,
      404,
      "NOT_FOUND",
      "GET /api/workouts/:id after delete",
    );
    console.log("OK 404 GET /api/workouts/:id after delete");

    console.log("Workout API smoke passed.");
  } finally {
    if (workoutId !== null && token !== null) {
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
        // Cleanup is best-effort because the main smoke error is the actionable signal.
      }
    }

    await stopServer(server);
  }
}

void main().catch((error: unknown) => {
  console.error("Workout API smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
