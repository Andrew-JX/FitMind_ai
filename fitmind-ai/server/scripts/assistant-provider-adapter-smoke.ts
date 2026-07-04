import { access, readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  listChatSessionsForUser,
  listMessagesForSession,
} from "../src/db/chat-repository.js";

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
}

interface WorkoutDetailData {
  workout: {
    id: string;
    sets: WorkoutSetData[];
  };
}

interface DeleteResponseData {
  deleted: true;
  id: string;
}

interface AssistantMockTurnData {
  session_id: string;
  mode: string;
  assistant_type: "deterministic_mock";
  tool_calls: Array<{
    tool_name: string;
    status: "success" | "error";
    duration_ms: number;
  }>;
  answer: {
    summary: string;
    bullets: string[];
    evidence: {
      source: "deterministic_tool_executor" | "deterministic_mock_provider";
      tool_names: string[];
      workout_ids: string[];
      set_ids: string[];
      calculation_rules: string[];
    };
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

async function loadChatMessages(sessionId: string, userId: string) {
  return listMessagesForSession(sessionId, userId);
}

async function loadChatSessions(userId: string) {
  return listChatSessionsForUser(userId);
}

function assertNoSecretsInPersistedMessage(
  serializedValue: string,
  token: string,
  databaseUrl: string,
  label: string,
): void {
  const normalizedValue = serializedValue.toLowerCase();

  assert(
    !normalizedValue.includes(token.toLowerCase()),
    `${label} should not contain the auth token.`,
  );
  assert(
    !normalizedValue.includes(databaseUrl.toLowerCase()),
    `${label} should not contain DATABASE_URL.`,
  );
  assert(
    !normalizedValue.includes("bearer "),
    `${label} should not contain bearer strings.`,
  );
  assert(
    !normalizedValue.includes("authorization"),
    `${label} should not contain authorization fields.`,
  );
}

async function createWorkout(
  baseUrl: string,
  token: string,
  input: {
    performed_at: string;
    duration_minutes: number;
    notes: string;
    sets: Array<{
      exercise_id: string;
      set_index: number;
      reps: number;
      weight_kg: number;
      rpe: number;
      is_warmup: boolean;
      notes: string;
    }>;
  },
  label: string,
): Promise<WorkoutDetailData["workout"]> {
  const response = await requestJson<WorkoutDetailData>(
    baseUrl,
    "/api/workouts",
    {
      method: "POST",
      headers: createAuthHeaders(token),
      body: JSON.stringify(input),
    },
  );

  return expectSuccess(response, 201, label).workout;
}

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(scriptDir, "..", ".env.local");
  await loadEnvFile(envPath);

  assert(
    typeof process.env.DATABASE_URL === "string" &&
      process.env.DATABASE_URL.length > 0,
    "DATABASE_URL is required for assistant provider adapter smoke.",
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
  const databaseUrl = process.env.DATABASE_URL;
  assert(
    typeof databaseUrl === "string" && databaseUrl.length > 0,
    "DATABASE_URL should remain available for persistence assertions.",
  );

  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const primaryEmail = `assistant-provider-adapter-smoke-${uniqueSuffix}@example.com`;
  const secondaryEmail = `assistant-provider-adapter-smoke-other-${uniqueSuffix}@example.com`;

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
      "Assistant Provider Adapter Smoke",
    );
    primaryToken = primaryAuth.token;
    console.log("OK 201 POST /api/auth/register primary user");

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

    const primaryWorkoutOne = await createWorkout(
      baseUrl,
      primaryToken,
      {
        performed_at: "2026-05-01T09:00:00Z",
        duration_minutes: 45,
        notes: "Provider adapter smoke workout one",
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
            exercise_id: squatExercise.id,
            set_index: 2,
            reps: 5,
            weight_kg: 120,
            rpe: 8,
            is_warmup: false,
            notes: "squat set 1",
          },
        ],
      },
      "POST /api/workouts primary provider workout one",
    );
    primaryWorkoutIdOne = primaryWorkoutOne.id;
    console.log("OK 201 POST /api/workouts primary provider workout one");

    const primaryWorkoutTwo = await createWorkout(
      baseUrl,
      primaryToken,
      {
        performed_at: "2026-05-02T09:00:00Z",
        duration_minutes: 40,
        notes: "Provider adapter smoke workout two",
        sets: [
          {
            exercise_id: benchExercise.id,
            set_index: 1,
            reps: 6,
            weight_kg: 85,
            rpe: 9,
            is_warmup: false,
            notes: "bench set 2",
          },
        ],
      },
      "POST /api/workouts primary provider workout two",
    );
    primaryWorkoutIdTwo = primaryWorkoutTwo.id;
    console.log("OK 201 POST /api/workouts primary provider workout two");

    const secondaryAuth = await registerUser(
      baseUrl,
      secondaryEmail,
      "Assistant Provider Adapter Smoke Other User",
    );
    secondaryToken = secondaryAuth.token;
    console.log("OK 201 POST /api/auth/register secondary user");

    const secondaryWorkout = await createWorkout(
      baseUrl,
      secondaryToken,
      {
        performed_at: "2026-05-01T11:00:00Z",
        duration_minutes: 30,
        notes: "Secondary provider adapter workout",
        sets: [
          {
            exercise_id: benchExercise.id,
            set_index: 1,
            reps: 10,
            weight_kg: 40,
            rpe: 7,
            is_warmup: false,
            notes: "other user bench set",
          },
        ],
      },
      "POST /api/workouts secondary provider workout",
    );
    secondaryWorkoutId = secondaryWorkout.id;
    console.log("OK 201 POST /api/workouts secondary provider workout");

    const normalResponse = await requestJson<AssistantMockTurnData>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          mode: "training_overview",
          message: "show me my training overview",
          start_date: "2026-05-01",
          end_date: "2026-05-02",
        }),
      },
    );
    const normalTurn = expectSuccess(
      normalResponse,
      200,
      "POST /api/assistant/mock-turn normal provider path",
    );
    assert(
      normalTurn.assistant_type === "deterministic_mock",
      "Normal provider path should keep assistant_type=deterministic_mock.",
    );
    assert(
      normalTurn.mode === "training_overview",
      "Normal provider path should preserve mode.",
    );
    assert(
      typeof normalTurn.session_id === "string" &&
        normalTurn.session_id.length > 0,
      "Normal provider path should return a session_id.",
    );
    assert(
      normalTurn.tool_calls.length === 1,
      "Normal provider path should execute exactly one tool call.",
    );
    assert(
      normalTurn.tool_calls[0]?.tool_name === "get_training_summary" &&
        normalTurn.tool_calls[0].status === "success",
      "Normal provider path should execute get_training_summary successfully.",
    );
    assert(
      normalTurn.answer.evidence.source === "deterministic_tool_executor",
      "Normal provider path should expose deterministic tool evidence.",
    );
    assert(
      normalTurn.answer.evidence.tool_names.length === 1 &&
        normalTurn.answer.evidence.tool_names[0] === "get_training_summary",
      "Normal provider path should expose the selected tool name in evidence.",
    );
    assert(
      normalTurn.answer.evidence.workout_ids.includes(primaryWorkoutIdOne) &&
        normalTurn.answer.evidence.workout_ids.includes(primaryWorkoutIdTwo) &&
        !normalTurn.answer.evidence.workout_ids.includes(secondaryWorkoutId),
      "Normal provider path should only expose primary-user workout evidence.",
    );
    assert(
      typeof normalTurn.answer.summary === "string" &&
        Array.isArray(normalTurn.answer.bullets),
      "Normal provider path should preserve the mock-turn response contract.",
    );
    console.log("OK POST /api/assistant/mock-turn normal provider path");

    const sessionsAfterNormal = await loadChatSessions(primaryAuth.user.id);
    assert(
      sessionsAfterNormal.length === 1 &&
        sessionsAfterNormal[0]?.id === normalTurn.session_id,
      "Normal provider path should create one chat session for the primary user.",
    );
    const messagesAfterNormal = await loadChatMessages(
      normalTurn.session_id,
      primaryAuth.user.id,
    );
    assert(
      messagesAfterNormal.length === 2,
      "Normal provider path should persist one user and one assistant message.",
    );
    assert(
      messagesAfterNormal[0]?.role === "user" &&
        messagesAfterNormal[1]?.role === "assistant",
      "Normal provider path should persist messages in user-then-assistant order.",
    );
    assert(
      JSON.stringify(messagesAfterNormal[1]?.structured_output).includes(
        "deterministic_tool_executor",
      ),
      "Persisted assistant message should include tool-backed structured output.",
    );
    assertNoSecretsInPersistedMessage(
      JSON.stringify(messagesAfterNormal[0]),
      primaryAuth.token,
      databaseUrl,
      "Persisted normal-path user message",
    );
    assertNoSecretsInPersistedMessage(
      JSON.stringify(messagesAfterNormal[1]),
      primaryAuth.token,
      databaseUrl,
      "Persisted normal-path assistant message",
    );
    console.log("OK normal provider path persistence");

    const textResponse = await requestJson<AssistantMockTurnData>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          mode: "training_overview",
          session_id: normalTurn.session_id,
          message: "[mock:text] explain without a tool",
          start_date: "2026-05-01",
          end_date: "2026-05-02",
        }),
      },
    );
    const textTurn = expectSuccess(
      textResponse,
      200,
      "POST /api/assistant/mock-turn [mock:text]",
    );
    assert(
      textTurn.assistant_type === "deterministic_mock",
      "Text provider path should keep assistant_type=deterministic_mock.",
    );
    assert(
      textTurn.session_id === normalTurn.session_id,
      "Text provider path should append to the existing session.",
    );
    assert(
      textTurn.tool_calls.length === 0,
      "Text provider path should not execute any tools.",
    );
    assert(
      textTurn.answer.summary.includes(
        "Deterministic mock provider message: explain without a tool",
      ),
      "Text provider path should return the deterministic provider fallback message.",
    );
    assert(
      textTurn.answer.evidence.source === "deterministic_mock_provider",
      "Text provider path should expose deterministic mock provider evidence.",
    );
    assert(
      textTurn.answer.evidence.tool_names.length === 0 &&
        textTurn.answer.evidence.workout_ids.length === 0 &&
        textTurn.answer.evidence.set_ids.length === 0 &&
        textTurn.answer.evidence.calculation_rules.length === 0,
      "Text provider path should not claim any tool-derived evidence.",
    );
    console.log("OK POST /api/assistant/mock-turn [mock:text]");

    const messagesAfterText = await loadChatMessages(
      normalTurn.session_id,
      primaryAuth.user.id,
    );
    assert(
      messagesAfterText.length === 4,
      "Text provider path should append another user and assistant message pair.",
    );
    assert(
      JSON.stringify(messagesAfterText[3]?.structured_output).includes(
        "deterministic_mock_provider",
      ),
      "Persisted text-path assistant message should include provider fallback evidence.",
    );
    assert(
      JSON.stringify(messagesAfterText[3]?.content).includes(
        "Deterministic mock provider message: explain without a tool",
      ),
      "Persisted text-path assistant message should include the plain-text fallback.",
    );
    assertNoSecretsInPersistedMessage(
      JSON.stringify(messagesAfterText[2]),
      primaryAuth.token,
      databaseUrl,
      "Persisted text-path user message",
    );
    assertNoSecretsInPersistedMessage(
      JSON.stringify(messagesAfterText[3]),
      primaryAuth.token,
      databaseUrl,
      "Persisted text-path assistant message",
    );
    console.log("OK text provider path persistence");

    const errorResponse = await requestJson<unknown>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          mode: "training_overview",
          session_id: normalTurn.session_id,
          message: "[mock:error] provider failed",
          start_date: "2026-05-01",
          end_date: "2026-05-02",
        }),
      },
    );
    const providerError = expectError(
      errorResponse,
      502,
      "AI_PROVIDER_ERROR",
      "POST /api/assistant/mock-turn [mock:error]",
    );
    assert(
      !("kind" in providerError) && !("tool_name" in providerError),
      "Provider error response should not leak raw provider payload fields.",
    );
    assert(
      providerError.message.includes("Deterministic mock provider error"),
      "Provider error response should preserve the mapped provider error message.",
    );
    console.log("OK POST /api/assistant/mock-turn [mock:error]");

    const crossUserResponse = await requestJson<AssistantMockTurnData>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: createAuthHeaders(secondaryToken),
        body: JSON.stringify({
          mode: "training_overview",
          session_id: normalTurn.session_id,
          message: "show me my training overview",
          start_date: "2026-05-01",
          end_date: "2026-05-02",
        }),
      },
    );
    expectError(
      crossUserResponse,
      403,
      "FORBIDDEN",
      "POST /api/assistant/mock-turn cross-user session access",
    );

    const secondaryOverviewResponse = await requestJson<AssistantMockTurnData>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: createAuthHeaders(secondaryToken),
        body: JSON.stringify({
          mode: "training_overview",
          message: "show me my training overview",
          start_date: "2026-05-01",
          end_date: "2026-05-02",
        }),
      },
    );
    const secondaryOverview = expectSuccess(
      secondaryOverviewResponse,
      200,
      "POST /api/assistant/mock-turn secondary user isolation",
    );
    assert(
      secondaryOverview.tool_calls.length === 1 &&
        secondaryOverview.tool_calls[0]?.tool_name === "get_training_summary",
      "Secondary user normal provider path should still execute get_training_summary.",
    );
    assert(
      secondaryOverview.answer.evidence.workout_ids.length === 1 &&
        secondaryOverview.answer.evidence.workout_ids[0] ===
          secondaryWorkoutId &&
        !secondaryOverview.answer.evidence.workout_ids.includes(
          primaryWorkoutIdOne,
        ) &&
        !secondaryOverview.answer.evidence.workout_ids.includes(
          primaryWorkoutIdTwo,
        ),
      "Secondary user should only see secondary-user workout context.",
    );
    console.log("OK provider path user isolation");

    console.log("Assistant provider adapter smoke passed.");
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
  console.error("Assistant provider adapter smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
