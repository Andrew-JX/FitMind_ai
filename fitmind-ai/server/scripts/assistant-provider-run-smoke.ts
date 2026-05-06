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

interface WorkoutDetailData {
  workout: {
    id: string;
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
  const response = await requestJson<WorkoutDetailData>(baseUrl, "/api/workouts", {
    method: "POST",
    headers: createAuthHeaders(token),
    body: JSON.stringify(input),
  });

  return expectSuccess(response, 201, label).workout;
}

async function createFixtureUsersAndWorkouts(baseUrl: string): Promise<{
  databaseUrl: string;
  primaryAuth: AuthSuccessData;
  secondaryAuth: AuthSuccessData;
  primaryWorkoutIdOne: string;
  primaryWorkoutIdTwo: string;
  secondaryWorkoutId: string;
}> {
  const databaseUrl = process.env.DATABASE_URL;
  assert(
    typeof databaseUrl === "string" && databaseUrl.length > 0,
    "DATABASE_URL should remain available for persistence assertions.",
  );

  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const primaryEmail = `assistant-provider-run-${uniqueSuffix}@example.com`;
  const secondaryEmail = `assistant-provider-run-other-${uniqueSuffix}@example.com`;

  const primaryAuth = await registerUser(
    baseUrl,
    primaryEmail,
    "Assistant Provider Run Smoke",
  );
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
  assert(benchExercise !== undefined, "Bench search should return one exercise.");

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
  console.log("OK 200 exercise searches");

  const primaryWorkoutOne = await createWorkout(
    baseUrl,
    primaryAuth.token,
    {
      performed_at: "2026-05-01T09:00:00Z",
      duration_minutes: 45,
      notes: "Provider run smoke workout one",
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
    "POST /api/workouts primary workout one",
  );
  console.log("OK 201 POST /api/workouts primary workout one");

  const primaryWorkoutTwo = await createWorkout(
    baseUrl,
    primaryAuth.token,
    {
      performed_at: "2026-05-02T09:00:00Z",
      duration_minutes: 40,
      notes: "Provider run smoke workout two",
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
    "POST /api/workouts primary workout two",
  );
  console.log("OK 201 POST /api/workouts primary workout two");

  const secondaryAuth = await registerUser(
    baseUrl,
    secondaryEmail,
    "Assistant Provider Run Smoke Other User",
  );
  console.log("OK 201 POST /api/auth/register secondary user");

  const secondaryWorkout = await createWorkout(
    baseUrl,
    secondaryAuth.token,
    {
      performed_at: "2026-05-01T11:00:00Z",
      duration_minutes: 30,
      notes: "Secondary provider run smoke workout",
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
    "POST /api/workouts secondary workout",
  );
  console.log("OK 201 POST /api/workouts secondary workout");

  return {
    databaseUrl,
    primaryAuth,
    secondaryAuth,
    primaryWorkoutIdOne: primaryWorkoutOne.id,
    primaryWorkoutIdTwo: primaryWorkoutTwo.id,
    secondaryWorkoutId: secondaryWorkout.id,
  };
}

async function runMockProviderTrack(
  baseUrl: string,
  fixture: {
    databaseUrl: string;
    primaryAuth: AuthSuccessData;
    secondaryAuth: AuthSuccessData;
    primaryWorkoutIdOne: string;
    primaryWorkoutIdTwo: string;
    secondaryWorkoutId: string;
  },
): Promise<string> {
  process.env.ASSISTANT_PROVIDER = "mock";

  const normalResponse = await requestJson<AssistantMockTurnData>(
    baseUrl,
    "/api/assistant/mock-turn",
    {
      method: "POST",
      headers: createAuthHeaders(fixture.primaryAuth.token),
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
    "POST /api/assistant/mock-turn mock normal provider path",
  );
  assert(
    normalTurn.assistant_type === "deterministic_mock",
    "Mock provider path should keep assistant_type=deterministic_mock.",
  );
  assert(
    normalTurn.tool_calls.length === 1 &&
      normalTurn.tool_calls[0]?.tool_name === "get_training_summary" &&
      normalTurn.tool_calls[0].status === "success",
    "Mock provider path should execute get_training_summary once.",
  );
  assert(
    normalTurn.answer.evidence.source === "deterministic_tool_executor",
    "Mock provider path should expose deterministic tool evidence.",
  );
  assert(
    normalTurn.answer.evidence.workout_ids.includes(fixture.primaryWorkoutIdOne) &&
      normalTurn.answer.evidence.workout_ids.includes(fixture.primaryWorkoutIdTwo) &&
      !normalTurn.answer.evidence.workout_ids.includes(fixture.secondaryWorkoutId),
    "Mock provider path should only expose primary-user workout evidence.",
  );
  console.log("OK mock provider normal tool path");

  const sessionsAfterNormal = await loadChatSessions(fixture.primaryAuth.user.id);
  assert(
    sessionsAfterNormal.length === 1 &&
      sessionsAfterNormal[0]?.id === normalTurn.session_id,
    "Mock provider path should create one chat session for the primary user.",
  );
  const messagesAfterNormal = await loadChatMessages(
    normalTurn.session_id,
    fixture.primaryAuth.user.id,
  );
  assert(
    messagesAfterNormal.length === 2,
    "Mock provider normal path should persist one user and one assistant message.",
  );

  const textResponse = await requestJson<AssistantMockTurnData>(
    baseUrl,
    "/api/assistant/mock-turn",
    {
      method: "POST",
      headers: createAuthHeaders(fixture.primaryAuth.token),
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
    "POST /api/assistant/mock-turn mock [mock:text]",
  );
  assert(
    textTurn.tool_calls.length === 0,
    "Mock [mock:text] path should not execute any tools.",
  );
  assert(
    textTurn.answer.evidence.source === "deterministic_mock_provider" &&
      textTurn.answer.evidence.tool_names.length === 0 &&
      textTurn.answer.evidence.workout_ids.length === 0 &&
      textTurn.answer.evidence.set_ids.length === 0 &&
      textTurn.answer.evidence.calculation_rules.length === 0,
    "Mock [mock:text] path should not claim tool-derived evidence.",
  );
  console.log("OK mock provider [mock:text] path");

  const messagesAfterText = await loadChatMessages(
    normalTurn.session_id,
    fixture.primaryAuth.user.id,
  );
  assert(
    messagesAfterText.length === 4,
    "Mock [mock:text] path should append another user and assistant message pair.",
  );
  assert(
    JSON.stringify(messagesAfterText[3]?.content).includes(
      "Deterministic mock provider message: explain without a tool",
    ),
    "Mock [mock:text] assistant message should persist the plain-text fallback.",
  );
  assertNoSecretsInPersistedMessage(
    JSON.stringify(messagesAfterText[0]),
    fixture.primaryAuth.token,
    fixture.databaseUrl,
    "Persisted mock-path user message",
  );
  assertNoSecretsInPersistedMessage(
    JSON.stringify(messagesAfterText[3]),
    fixture.primaryAuth.token,
    fixture.databaseUrl,
    "Persisted mock-path assistant message",
  );

  const errorResponse = await requestJson<unknown>(
    baseUrl,
    "/api/assistant/mock-turn",
    {
      method: "POST",
      headers: createAuthHeaders(fixture.primaryAuth.token),
      body: JSON.stringify({
        mode: "training_overview",
        session_id: normalTurn.session_id,
        message: "[mock:error] provider failed",
        start_date: "2026-05-01",
        end_date: "2026-05-02",
      }),
    },
  );
  expectError(
    errorResponse,
    502,
    "AI_PROVIDER_ERROR",
    "POST /api/assistant/mock-turn mock [mock:error]",
  );
  console.log("OK mock provider [mock:error] path");

  const crossUserResponse = await requestJson<AssistantMockTurnData>(
    baseUrl,
    "/api/assistant/mock-turn",
    {
      method: "POST",
      headers: createAuthHeaders(fixture.secondaryAuth.token),
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
    "POST /api/assistant/mock-turn mock cross-user session access",
  );
  console.log("OK mock provider user isolation");

  return normalTurn.session_id;
}

async function runRealProviderTrack(
  baseUrl: string,
  fixture: {
    databaseUrl: string;
    primaryAuth: AuthSuccessData;
    secondaryAuth: AuthSuccessData;
    primaryWorkoutIdOne: string;
    primaryWorkoutIdTwo: string;
    secondaryWorkoutId: string;
  },
  existingSessionId: string,
): Promise<void> {
  if (
    typeof process.env.ANTHROPIC_API_KEY !== "string" ||
    process.env.ANTHROPIC_API_KEY.length === 0
  ) {
    console.log(
      "Skipping real provider smoke because ANTHROPIC_API_KEY is not set.",
    );
    return;
  }

  process.env.ASSISTANT_PROVIDER = "anthropic";

  const response = await requestJson<AssistantMockTurnData>(
    baseUrl,
    "/api/assistant/mock-turn",
    {
      method: "POST",
      headers: createAuthHeaders(fixture.primaryAuth.token),
      body: JSON.stringify({
        mode: "training_overview",
        session_id: existingSessionId,
        message: "Summarize my recent training using the available backend tool if needed.",
        start_date: "2026-05-01",
        end_date: "2026-05-02",
      }),
    },
  );
  const realTurn = expectSuccess(
    response,
    200,
    "POST /api/assistant/mock-turn anthropic provider path",
  );
  assert(
    realTurn.assistant_type === "deterministic_mock",
    "Real provider path should keep assistant_type=deterministic_mock.",
  );
  assert(
    realTurn.session_id === existingSessionId,
    "Real provider path should preserve the requested session_id.",
  );
  assert(
    realTurn.tool_calls.length <= 1,
    "Real provider path should execute at most one tool call.",
  );
  assert(
    typeof realTurn.answer.summary === "string" &&
      Array.isArray(realTurn.answer.bullets) &&
      Array.isArray(realTurn.answer.evidence.tool_names),
    "Real provider path should preserve the public mock-turn response contract.",
  );

  if (realTurn.tool_calls.length === 1) {
    assert(
      realTurn.answer.evidence.source === "deterministic_tool_executor",
      "Tool-backed real provider path should expose deterministic tool evidence.",
    );
    assert(
      realTurn.answer.evidence.workout_ids.includes(fixture.primaryWorkoutIdOne) &&
        realTurn.answer.evidence.workout_ids.includes(
          fixture.primaryWorkoutIdTwo,
        ) &&
        !realTurn.answer.evidence.workout_ids.includes(fixture.secondaryWorkoutId),
      "Tool-backed real provider path should only expose primary-user workout evidence.",
    );
  } else {
    assert(
      realTurn.answer.evidence.source === "deterministic_mock_provider",
      "Plain-text real provider path should use the provider evidence source.",
    );
  }
  console.log("OK anthropic provider success path");

  const messagesAfterReal = await loadChatMessages(
    existingSessionId,
    fixture.primaryAuth.user.id,
  );
  assert(
    messagesAfterReal.length >= 6,
    "Successful real provider path should append one more user and assistant message pair.",
  );
  const latestAssistantMessage = messagesAfterReal[messagesAfterReal.length - 1];
  assertNoSecretsInPersistedMessage(
    JSON.stringify(latestAssistantMessage),
    fixture.primaryAuth.token,
    fixture.databaseUrl,
    "Persisted real-provider assistant message",
  );

  const secondaryOverviewResponse = await requestJson<AssistantMockTurnData>(
    baseUrl,
    "/api/assistant/mock-turn",
    {
      method: "POST",
      headers: createAuthHeaders(fixture.secondaryAuth.token),
      body: JSON.stringify({
        mode: "training_overview",
        message: "Summarize my recent training using the available backend tool if needed.",
        start_date: "2026-05-01",
        end_date: "2026-05-02",
      }),
    },
  );
  const secondaryOverview = expectSuccess(
    secondaryOverviewResponse,
    200,
    "POST /api/assistant/mock-turn anthropic secondary user isolation",
  );
  if (secondaryOverview.answer.evidence.source === "deterministic_tool_executor") {
    assert(
      secondaryOverview.answer.evidence.workout_ids.length === 1 &&
        secondaryOverview.answer.evidence.workout_ids[0] ===
          fixture.secondaryWorkoutId,
      "Secondary anthropic provider path should only expose secondary-user workout evidence.",
    );
  }
  console.log("OK anthropic provider user isolation");
}

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(scriptDir, "..", ".env.local");
  await loadEnvFile(envPath);

  assert(
    typeof process.env.DATABASE_URL === "string" &&
      process.env.DATABASE_URL.length > 0,
    "DATABASE_URL is required for assistant provider run smoke.",
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
  let primaryToken: string | null = null;
  let secondaryToken: string | null = null;
  let primaryWorkoutIdOne: string | null = null;
  let primaryWorkoutIdTwo: string | null = null;
  let secondaryWorkoutId: string | null = null;

  try {
    console.log(`Smoke base URL: ${baseUrl}`);
    const fixture = await createFixtureUsersAndWorkouts(baseUrl);
    primaryToken = fixture.primaryAuth.token;
    secondaryToken = fixture.secondaryAuth.token;
    primaryWorkoutIdOne = fixture.primaryWorkoutIdOne;
    primaryWorkoutIdTwo = fixture.primaryWorkoutIdTwo;
    secondaryWorkoutId = fixture.secondaryWorkoutId;

    const sessionId = await runMockProviderTrack(baseUrl, fixture);
    await runRealProviderTrack(baseUrl, fixture, sessionId);

    console.log("Assistant provider run smoke passed.");
  } finally {
    process.env.ASSISTANT_PROVIDER = "mock";
    await deleteWorkoutIfNeeded(baseUrl, primaryToken ?? "", primaryWorkoutIdOne);
    await deleteWorkoutIfNeeded(baseUrl, primaryToken ?? "", primaryWorkoutIdTwo);
    await deleteWorkoutIfNeeded(baseUrl, secondaryToken ?? "", secondaryWorkoutId);
    await stopServer(server);
  }
}

void main().catch((error: unknown) => {
  console.error("Assistant provider run smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
