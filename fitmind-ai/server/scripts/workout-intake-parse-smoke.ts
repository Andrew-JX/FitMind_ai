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

interface WorkoutListData {
  items: Array<{
    id: string;
  }>;
  next_cursor: string | null;
}

interface WorkoutIntakeParseData {
  draft: {
    performed_at: string;
    date_source?: string;
    date_label?: string | null;
    duration_min: number | null;
    note: string | null;
    exercises: Array<{
      input_name: string;
      matched_exercise_id: string | null;
      matched_exercise_name: string | null;
      match_confidence: number;
      match_status: "matched" | "ambiguous" | "unresolved";
      candidate_exercises: Array<{
        exercise_id: string;
        exercise_name: string;
        confidence: number;
      }>;
      sets: Array<{
        weight_kg: number;
        reps: number;
        rpe: number | null;
        intensity_label: string | null;
      }>;
      incomplete_sets: Array<{
        group_count: number | null;
        weight_kg: number | null;
        reps: number | null;
        missing_fields: Array<"weight_kg" | "reps">;
        message: string;
      }>;
    }>;
  };
  unresolved_items: Array<{
    text: string;
    reason: string;
  }>;
  warnings: string[];
  evidence: {
    fallback_warnings: string[];
    parser_version: string;
    rules: string[];
    source:
      | "llm_structured_fallback"
      | "rule_parser"
      | "rule_parser_llm_unavailable";
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
        display_name: "Workout Intake Smoke",
      }),
    },
  );

  return expectSuccess(response, 201, "POST /api/auth/register");
}

async function listWorkoutCount(
  baseUrl: string,
  token: string,
): Promise<number> {
  const response = await requestJson<WorkoutListData>(baseUrl, "/api/workouts", {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  const data = expectSuccess(response, 200, "GET /api/workouts");

  return data.items.length;
}

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(scriptDir, "..", ".env.local");
  await loadEnvFile(envPath);

  assert(
    typeof process.env.DATABASE_URL === "string" &&
      process.env.DATABASE_URL.length > 0,
    "DATABASE_URL is required for workout-intake smoke.",
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
  process.env.WORKOUT_INTAKE_LLM_PROVIDER = "mock";

  const { server, baseUrl } = await startServer();
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `workout-intake-smoke-${uniqueSuffix}@example.com`;

  try {
    console.log(`Smoke base URL: ${baseUrl}`);

    const unauthorized = await requestJson<unknown>(
      baseUrl,
      "/api/training/workout-intake/parse",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text: "bench press 60x10 65x8 70x6",
        }),
      },
    );
    expectError(
      unauthorized,
      401,
      "UNAUTHORIZED",
      "POST /api/training/workout-intake/parse without token",
    );
    console.log("OK 401 POST /api/training/workout-intake/parse without token");

    const auth = await registerUser(baseUrl, email);
    console.log("OK 201 POST /api/auth/register workout intake user");

    const beforeWorkoutCount = await listWorkoutCount(baseUrl, auth.token);
    const benchParseResponse = await requestJson<WorkoutIntakeParseData>(
      baseUrl,
      `/api/training/workout-intake/parse?user_id=${auth.user.id}`,
      {
        method: "POST",
        headers: createAuthHeaders(auth.token),
        body: JSON.stringify({
          text: "\u6760\u94c3\u5367\u63a8\u4e09\u7ec4 60x10 65x8 70x6",
          performed_at: "2026-05-29T10:00:00.000Z",
          duration_min: 45,
          note: "Smoke parse only",
          user_id: "00000000-0000-4000-8000-000000000000",
        }),
      },
    );
    const benchParsed = expectSuccess(
      benchParseResponse,
      200,
      "POST /api/training/workout-intake/parse bench",
    );

    assert(
      benchParsed.draft.exercises.length > 0,
      "Bench draft should include exercises.",
    );
    assert(
      benchParsed.draft.exercises[0]?.match_status === "matched" &&
        benchParsed.draft.exercises[0]?.matched_exercise_name ===
          "\u6760\u94c3\u5367\u63a8",
      "Bench alias should match the Chinese-first Barbell Bench Press display.",
    );
    assert(
      benchParsed.draft.exercises[0]?.sets.length === 3,
      "Draft should parse three bench sets.",
    );
    assert(
      benchParsed.draft.exercises[0]?.sets[0]?.weight_kg === 60 &&
        benchParsed.draft.exercises[0]?.sets[0]?.reps === 10,
      "First parsed set should be 60kg x 10.",
    );
    assert(
      benchParsed.evidence.parser_version === "natural-language-intake-v1",
      "Response should include parser version evidence.",
    );

    const pulldownParseResponse = await requestJson<WorkoutIntakeParseData>(
      baseUrl,
      "/api/training/workout-intake/parse",
      {
        method: "POST",
        headers: createAuthHeaders(auth.token),
        body: JSON.stringify({
          text: "\u9ad8\u4f4d\u4e0b\u62c9\u4e24\u7ec4 45x12",
        }),
      },
    );
    const pulldownParsed = expectSuccess(
      pulldownParseResponse,
      200,
      "POST /api/training/workout-intake/parse pulldown",
    );

    assert(
      pulldownParsed.draft.exercises[0]?.match_status === "matched" &&
        pulldownParsed.draft.exercises[0]?.matched_exercise_name ===
          "\u9ad8\u4f4d\u4e0b\u62c9",
      "Pulldown alias should match the Chinese-first Lat Pulldown display.",
    );
    assert(
      pulldownParsed.draft.exercises[0]?.sets.length === 2,
      "Pulldown repeated set should expand to two sets.",
    );

    const oralParseResponse = await requestJson<WorkoutIntakeParseData>(
      baseUrl,
      "/api/training/workout-intake/parse",
      {
        method: "POST",
        headers: createAuthHeaders(auth.token),
        body: JSON.stringify({
          text: "\u6211\u4eca\u5929\u505a\u4e86\u4e0a\u659c\u54d1\u94c3\u5367\u63a8\u505a\u4e86\u4e09\u7ec4\u6bcf\u7ec4\u662f27.5\u516c\u65a4 \u6bcf\u7ec4\u7684\u6b21\u6570\u662f8",
        }),
      },
    );
    const oralParsed = expectSuccess(
      oralParseResponse,
      200,
      "POST /api/training/workout-intake/parse oral LLM fallback",
    );

    assert(
      oralParsed.evidence.source === "llm_structured_fallback",
      "Oral decimal input should use mock LLM structured fallback.",
    );
    assert(
      oralParsed.draft.exercises[0]?.sets.length === 3 &&
        oralParsed.draft.exercises[0]?.sets.every(
          (set) => set.weight_kg === 27.5 && set.reps === 8,
        ),
      "Oral decimal fallback should parse three 27.5kg x 8 sets.",
    );

    const oralPulldownParseResponse = await requestJson<WorkoutIntakeParseData>(
      baseUrl,
      "/api/training/workout-intake/parse",
      {
        method: "POST",
        headers: createAuthHeaders(auth.token),
        body: JSON.stringify({
          text: "\u6211\u4eca\u5929\u8bad\u7ec3\u4e86\u80cc\u90e8\u505a\u4e86\u9ad8\u4f4d\u4e0b\u62c9\u505a\u4e863\u7ec4\u6bcf\u7ec4\u505a\u7684\u662f70\u516c\u65a4\u7136\u540e\u6bcf\u7ec4\u505a\u4e8610\u6b21",
        }),
      },
    );
    const oralPulldownParsed = expectSuccess(
      oralPulldownParseResponse,
      200,
      "POST /api/training/workout-intake/parse oral pulldown",
    );

    assert(
      oralPulldownParsed.evidence.source === "rule_parser" ||
        oralPulldownParsed.evidence.source === "llm_structured_fallback",
      "Oral pulldown input should expose parser source evidence.",
    );
    assert(
      oralPulldownParsed.draft.exercises[0]?.matched_exercise_name ===
        "\u9ad8\u4f4d\u4e0b\u62c9" &&
        oralPulldownParsed.draft.exercises[0]?.sets.length === 3 &&
        oralPulldownParsed.draft.exercises[0]?.sets.every(
          (set) => set.weight_kg === 70 && set.reps === 10,
        ),
      "Oral pulldown should parse three 70kg x 10 sets.",
    );

    const yesterdayPulldownParseResponse =
      await requestJson<WorkoutIntakeParseData>(
        baseUrl,
        "/api/training/workout-intake/parse",
        {
          method: "POST",
          headers: createAuthHeaders(auth.token),
          body: JSON.stringify({
            performed_at: "2026-05-30T10:00:00.000+10:00",
            text: "\u6628\u5929\u7ec3\u4e86\u9ad8\u4f4d\u4e0b\u62c9\u4e09\u7ec4\u6bcf\u7ec4\u662f70\u516c\u65a410\u6b21",
          }),
        },
      );
    const yesterdayPulldownParsed = expectSuccess(
      yesterdayPulldownParseResponse,
      200,
      "POST /api/training/workout-intake/parse yesterday pulldown",
    );

    assert(
      yesterdayPulldownParsed.draft.performed_at.startsWith("2026-05-29"),
      "Yesterday oral input should set draft performed_at to 2026-05-29.",
    );

    const shoulderPressParseResponse = await requestJson<WorkoutIntakeParseData>(
      baseUrl,
      "/api/training/workout-intake/parse",
      {
        method: "POST",
        headers: createAuthHeaders(auth.token),
        body: JSON.stringify({
          text: "\u54d1\u94c3\u63a8\u80a9\u4e09\u7ec420\u516c\u65a410\u6b21",
        }),
      },
    );
    const shoulderPressParsed = expectSuccess(
      shoulderPressParseResponse,
      200,
      "POST /api/training/workout-intake/parse dumbbell shoulder press",
    );

    assert(
      shoulderPressParsed.draft.exercises[0]?.match_status === "matched" &&
        shoulderPressParsed.draft.exercises[0]?.matched_exercise_name ===
          "\u54d1\u94c3\u63a8\u80a9" &&
        shoulderPressParsed.draft.exercises[0]?.sets.length === 3,
      "Dumbbell shoulder press should match and parse three sets.",
    );

    const pullUpParseResponse = await requestJson<WorkoutIntakeParseData>(
      baseUrl,
      "/api/training/workout-intake/parse",
      {
        method: "POST",
        headers: createAuthHeaders(auth.token),
        body: JSON.stringify({
          text: "\u5f15\u4f53\u5411\u4e0a\u4e09\u7ec410\u6b21",
        }),
      },
    );
    const pullUpParsed = expectSuccess(
      pullUpParseResponse,
      200,
      "POST /api/training/workout-intake/parse pull-up",
    );

    assert(
      pullUpParsed.draft.exercises[0]?.match_status === "matched" &&
        pullUpParsed.draft.exercises[0]?.matched_exercise_name ===
          "\u5f15\u4f53\u5411\u4e0a" &&
        pullUpParsed.draft.exercises[0]?.incomplete_sets.length === 0 &&
        pullUpParsed.draft.exercises[0]?.sets.length === 3 &&
        pullUpParsed.draft.exercises[0]?.sets.every(
          (set) => set.weight_kg === 0 && set.reps === 10,
        ),
      "Pull-up should match as bodyweight zero-load sets.",
    );

    const rowParseResponse = await requestJson<WorkoutIntakeParseData>(
      baseUrl,
      "/api/training/workout-intake/parse",
      {
        method: "POST",
        headers: createAuthHeaders(auth.token),
        body: JSON.stringify({
          text: "\u5212\u8239\u4e24\u7ec4 50x10",
        }),
      },
    );
    const rowParsed = expectSuccess(
      rowParseResponse,
      200,
      "POST /api/training/workout-intake/parse broad row",
    );

    assert(
      rowParsed.draft.exercises[0]?.match_status === "ambiguous" &&
        rowParsed.draft.exercises[0]?.matched_exercise_id === null &&
        rowParsed.draft.exercises[0]?.candidate_exercises.length >= 2,
      "Broad row alias should return ambiguous candidates.",
    );

    const afterWorkoutCount = await listWorkoutCount(baseUrl, auth.token);
    assert(
      afterWorkoutCount === beforeWorkoutCount,
      "Workout intake parse must not create workouts.",
    );

    const serializedResponse = JSON.stringify([
      benchParsed,
      pulldownParsed,
      oralParsed,
      oralPulldownParsed,
      yesterdayPulldownParsed,
      shoulderPressParsed,
      pullUpParsed,
      rowParsed,
    ]);
    assert(
      !serializedResponse.includes(auth.token) &&
        !/authorization|bearer|jwt_secret|database_url/iu.test(
          serializedResponse,
        ),
      "Parse response should not expose auth tokens or secrets.",
    );

    console.log(
      "OK 200 workout intake draft, parsed sets, no persistence, and no secret leakage",
    );
    console.log("Workout intake API smoke passed.");
  } finally {
    await stopServer(server);
  }
}

void main().catch((error: unknown) => {
  console.error("Workout intake API smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
