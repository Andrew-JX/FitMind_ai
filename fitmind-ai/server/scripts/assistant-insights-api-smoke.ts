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

interface WorkoutDetailData {
  workout: {
    id: string;
    sets: Array<{
      id: string;
      exercise_id: string;
    }>;
  };
}

interface DeleteResponseData {
  deleted: true;
  id: string;
}

interface AssistantInsightsData {
  overview: {
    workout_count: number;
    set_count: number;
    total_volume: number;
    top_muscle_group_name: string | null;
    top_exercise_name: string | null;
  };
  cards: Array<{
    type:
      | "next_training_focus"
      | "training_imbalance"
      | "recovery_check"
      | "exercise_progress"
      | "evidence_explain";
    title: string;
    summary: string;
    tone: "accent" | "analysis" | "info" | "warning";
    hint?: string;
    evidence_summary?: string;
    suggested_prompt?: {
      mode: string;
      message: string;
    };
  }>;
  limitations: string[];
  evidence: {
    workout_count: number;
    set_count: number;
    calculation_sources: string[];
    calculation_rules: string[];
    workout_ids?: string[];
    set_ids?: string[];
  };
}

const SMOKE_JWT_SECRET = "fitmind-smoke-secret";
const REQUIRED_CARD_TYPES = [
  "next_training_focus",
  "training_imbalance",
  "recovery_check",
  "exercise_progress",
  "evidence_explain",
] as const;

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

async function registerUser(
  baseUrl: string,
  email: string,
  displayName: string,
): Promise<AuthSuccessData> {
  const response = await requestJson<AuthSuccessData>(
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

  return expectSuccess(response, 201, "POST /api/auth/register");
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
    // Best-effort cleanup keeps the main smoke failure actionable.
  }
}

function assertAssistantInsights(data: AssistantInsightsData): void {
  assert(
    data.cards.length === 5,
    "Assistant insights should return five cards.",
  );

  for (const type of REQUIRED_CARD_TYPES) {
    assert(
      data.cards.some((card) => card.type === type),
      `Assistant insights should include ${type}.`,
    );
  }

  assert(
    data.evidence.calculation_sources.includes("training_summary") &&
      data.evidence.calculation_sources.includes("recommendation_context") &&
      data.evidence.calculation_sources.includes("muscle_load") &&
      data.evidence.calculation_sources.includes("exercise_progress"),
    "Assistant insights evidence should include deterministic source names.",
  );
  assert(
    data.evidence.calculation_rules.length > 0,
    "Assistant insights should include calculation rules.",
  );
  assert(
    data.evidence.workout_ids === undefined &&
      data.evidence.set_ids === undefined,
    "Assistant insights should not expose raw workout_ids or set_ids.",
  );

  const serializedCards = JSON.stringify(data.cards);
  assert(
    !/训练不足|必须|伤病风险/u.test(serializedCards),
    "Assistant insight cards should avoid strong training or medical claims.",
  );
}

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(scriptDir, "..", ".env.local");
  await loadEnvFile(envPath);

  assert(
    typeof process.env.DATABASE_URL === "string" &&
      process.env.DATABASE_URL.length > 0,
    "DATABASE_URL is required for assistant-insights smoke.",
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
  const primaryEmail = `assistant-insights-smoke-${uniqueSuffix}@example.com`;
  const secondaryEmail = `assistant-insights-smoke-other-${uniqueSuffix}@example.com`;
  let primaryToken: string | null = null;
  let primaryWorkoutId: string | null = null;
  let secondaryToken: string | null = null;
  let secondaryWorkoutId: string | null = null;

  try {
    console.log(`Smoke base URL: ${baseUrl}`);

    const unauthorized = await requestJson<unknown>(
      baseUrl,
      "/api/training/assistant-insights?start_date=2026-04-29&end_date=2026-04-29",
    );
    expectError(
      unauthorized,
      401,
      "UNAUTHORIZED",
      "GET /api/training/assistant-insights without token",
    );
    console.log("OK 401 GET /api/training/assistant-insights without token");

    const primaryAuth = await registerUser(
      baseUrl,
      primaryEmail,
      "Assistant Insights Smoke",
    );
    primaryToken = primaryAuth.token;
    console.log("OK 201 POST /api/auth/register primary user");

    const secondaryAuth = await registerUser(
      baseUrl,
      secondaryEmail,
      "Assistant Insights Smoke Other User",
    );
    secondaryToken = secondaryAuth.token;
    console.log("OK 201 POST /api/auth/register secondary user");

    const benchPressId = await findExerciseId(
      baseUrl,
      "bench",
      "bench_press_barbell",
    );
    const rowId = await findExerciseId(baseUrl, "row", "barbell_row");
    console.log("OK 200 exercise lookup for assistant insights");

    const primaryWorkoutResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      "/api/workouts",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          performed_at: "2026-04-29T12:00:00Z",
          duration_minutes: 55,
          notes: "Assistant insights smoke workout",
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
      "POST /api/workouts primary assistant insights workout",
    ).workout;
    primaryWorkoutId = primaryWorkout.id;
    console.log("OK 201 POST /api/workouts primary assistant insights workout");

    const secondaryWorkoutResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      "/api/workouts",
      {
        method: "POST",
        headers: createAuthHeaders(secondaryToken),
        body: JSON.stringify({
          performed_at: "2026-04-29T13:00:00Z",
          duration_minutes: 30,
          notes: "Other user assistant insights workout",
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
      "POST /api/workouts secondary assistant insights workout",
    ).workout;
    secondaryWorkoutId = secondaryWorkout.id;
    console.log(
      "OK 201 POST /api/workouts secondary assistant insights workout",
    );

    const insightsResponse = await requestJson<AssistantInsightsData>(
      baseUrl,
      `/api/training/assistant-insights?start_date=2026-04-29&end_date=2026-04-29&exercise_id=${benchPressId}&user_id=${secondaryAuth.user.id}`,
      {
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    const insights = expectSuccess(
      insightsResponse,
      200,
      "GET /api/training/assistant-insights populated range",
    );

    assertAssistantInsights(insights);
    assert(
      insights.overview.workout_count === 1 &&
        insights.overview.set_count === 3 &&
        insights.overview.total_volume === 2020,
      "Assistant insights should only include primary user's workout data.",
    );
    assert(
      insights.evidence.workout_count === 1 &&
        insights.evidence.set_count === 3,
      "Assistant insights evidence counts should ignore user_id query injection.",
    );
    assert(
      insights.overview.top_muscle_group_name !== null,
      "Assistant insights should include a top muscle group.",
    );
    console.log(
      "OK 200 assistant insights cards, evidence, conservative copy, and injection isolation",
    );

    await deleteWorkoutIfNeeded(baseUrl, primaryToken, primaryWorkoutId);
    primaryWorkoutId = null;
    await deleteWorkoutIfNeeded(baseUrl, secondaryToken, secondaryWorkoutId);
    secondaryWorkoutId = null;
    console.log("OK cleanup assistant insights smoke workouts");

    console.log("Assistant insights API smoke passed.");
  } finally {
    await deleteWorkoutIfNeeded(baseUrl, primaryToken, primaryWorkoutId);
    await deleteWorkoutIfNeeded(baseUrl, secondaryToken, secondaryWorkoutId);
    await stopServer(server);
  }
}

void main().catch((error: unknown) => {
  console.error("Assistant insights API smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
