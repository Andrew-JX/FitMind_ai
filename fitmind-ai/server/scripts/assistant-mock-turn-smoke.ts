import { access, readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  listChatSessionsForUser,
  listMessagesForSession,
} from "../src/db/chat-repository.js";
import { createDbPool } from "../src/db/pool.js";
import { listRecentToolCallLogs } from "../src/db/tool-call-log-repository.js";

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
      source: "deterministic_tool_executor";
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

async function loadRecentLogsForUser(userId: string) {
  const pool = createDbPool();

  try {
    return await listRecentToolCallLogs(
      {
        userId,
        limit: 20,
      },
      pool,
    );
  } finally {
    await pool.end();
  }
}

async function loadChatSessionsForUser(userId: string) {
  const pool = createDbPool();

  try {
    return await listChatSessionsForUser(userId, pool);
  } finally {
    await pool.end();
  }
}

async function loadMessagesForSession(sessionId: string, userId: string) {
  const pool = createDbPool();

  try {
    return await listMessagesForSession(sessionId, userId, pool);
  } finally {
    await pool.end();
  }
}

function expectValidationIssue(
  error: ApiErrorResponse["error"],
  path: string,
  label: string,
): void {
  assert(
    error.details?.issues?.some((issue) => issue.path === path) ?? false,
    `${label} should include a ${path} validation issue.`,
  );
}

function expectToolCall(
  response: AssistantMockTurnData,
  toolName: string,
  label: string,
): void {
  assert(
    response.assistant_type === "deterministic_mock",
    `${label} should return assistant_type=deterministic_mock.`,
  );
  assert(
    response.tool_calls.some(
      (toolCall) =>
        toolCall.tool_name === toolName &&
        toolCall.status === "success" &&
        toolCall.duration_ms >= 0,
    ),
    `${label} should include a successful ${toolName} tool call.`,
  );
  assert(
    response.answer.evidence.source === "deterministic_tool_executor",
    `${label} should expose deterministic_tool_executor evidence.`,
  );
  assert(
    response.answer.evidence.tool_names.includes(toolName),
    `${label} should include ${toolName} in evidence.tool_names.`,
  );
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

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(scriptDir, "..", ".env.local");
  await loadEnvFile(envPath);

  assert(
    typeof process.env.DATABASE_URL === "string" &&
      process.env.DATABASE_URL.length > 0,
    "DATABASE_URL is required for assistant mock-turn smoke.",
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
  const primaryEmail = `assistant-mock-turn-smoke-${uniqueSuffix}@example.com`;
  const secondaryEmail =
    `assistant-mock-turn-smoke-other-${uniqueSuffix}@example.com`;
  let primaryToken: string | null = null;
  let secondaryToken: string | null = null;
  let primaryWorkoutIdOne: string | null = null;
  let primaryWorkoutIdTwo: string | null = null;
  let secondaryWorkoutId: string | null = null;
  let primarySessionId: string | null = null;

  try {
    console.log(`Smoke base URL: ${baseUrl}`);

    const unauthorizedResponse = await requestJson<unknown>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          mode: "training_overview",
          message: "show me my training",
          start_date: "2026-04-29",
          end_date: "2026-04-30",
        }),
      },
    );
    expectError(
      unauthorizedResponse,
      401,
      "UNAUTHORIZED",
      "POST /api/assistant/mock-turn without token",
    );
    console.log("OK 401 POST /api/assistant/mock-turn without token");

    const primaryAuth = await registerUser(
      baseUrl,
      primaryEmail,
      "Assistant Mock Turn Smoke",
    );
    primaryToken = primaryAuth.token;
    console.log("OK 201 POST /api/auth/register primary user");

    const invalidModeResponse = await requestJson<unknown>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          mode: "not_real",
          message: "show me my training",
          start_date: "2026-04-29",
          end_date: "2026-04-30",
        }),
      },
    );
    const invalidModeError = expectError(
      invalidModeResponse,
      400,
      "VALIDATION_ERROR",
      "POST /api/assistant/mock-turn invalid mode",
    );
    expectValidationIssue(invalidModeError, "mode", "Invalid mode response");
    console.log("OK 400 invalid mode validation");

    const invalidStartDateResponse = await requestJson<unknown>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          mode: "training_overview",
          message: "show me my training",
          start_date: "2026-04-99",
          end_date: "2026-04-30",
        }),
      },
    );
    const invalidStartDateError = expectError(
      invalidStartDateResponse,
      400,
      "VALIDATION_ERROR",
      "POST /api/assistant/mock-turn invalid start_date",
    );
    expectValidationIssue(
      invalidStartDateError,
      "start_date",
      "Invalid start_date response",
    );
    console.log("OK 400 invalid start_date validation");

    const invalidRangeResponse = await requestJson<unknown>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          mode: "training_overview",
          message: "show me my training",
          start_date: "2026-04-30",
          end_date: "2026-04-29",
        }),
      },
    );
    const invalidRangeError = expectError(
      invalidRangeResponse,
      400,
      "VALIDATION_ERROR",
      "POST /api/assistant/mock-turn end_date before start_date",
    );
    expectValidationIssue(
      invalidRangeError,
      "end_date",
      "Invalid range response",
    );
    console.log("OK 400 end_date before start_date validation");

    const missingExerciseIdResponse = await requestJson<AssistantMockTurnData>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          mode: "exercise_progress",
          message: "show me bench progress",
          start_date: "2026-04-29",
          end_date: "2026-04-30",
        }),
      },
    );
    const missingExerciseIdTurn = expectSuccess(
      missingExerciseIdResponse,
      200,
      "POST /api/assistant/mock-turn missing exercise_id",
    );
    assert(
      missingExerciseIdTurn.tool_calls.length === 0,
      "Missing exercise_id should return a product message instead of executing a tool.",
    );
    assert(
      missingExerciseIdTurn.answer.summary.includes("请先到“分析”页选择对应动作"),
      "Missing exercise_id response should ask the user to select the exercise first.",
    );
    console.log("OK 200 missing exercise_id returns select-exercise guidance");

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

    const primaryWorkoutOneResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      "/api/workouts",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          performed_at: "2026-04-29T09:00:00Z",
          duration_minutes: 45,
          notes: "Assistant mock turn workout one",
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
      "POST /api/workouts primary assistant workout one",
    ).workout;
    primaryWorkoutIdOne = primaryWorkoutOne.id;
    const primaryBenchSetIds = primaryWorkoutOne.sets
      .filter((setItem) => setItem.exercise_id === benchExercise.id)
      .map((setItem) => setItem.id);
    const primarySquatSetIds = primaryWorkoutOne.sets
      .filter((setItem) => setItem.exercise_id === squatExercise.id)
      .map((setItem) => setItem.id);
    console.log("OK 201 POST /api/workouts primary assistant workout one");

    const primaryWorkoutTwoResponse = await requestJson<WorkoutDetailData>(
      baseUrl,
      "/api/workouts",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          performed_at: "2026-04-30T09:00:00Z",
          duration_minutes: 40,
          notes: "Assistant mock turn workout two",
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
      "POST /api/workouts primary assistant workout two",
    ).workout;
    primaryWorkoutIdTwo = primaryWorkoutTwo.id;
    const primaryWorkoutTwoSetId = primaryWorkoutTwo.sets[0]?.id;
    assert(
      typeof primaryWorkoutTwoSetId === "string",
      "Primary workout two should include one set id.",
    );
    console.log("OK 201 POST /api/workouts primary assistant workout two");

    const secondaryAuth = await registerUser(
      baseUrl,
      secondaryEmail,
      "Assistant Mock Turn Smoke Other User",
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
          notes: "Secondary assistant workout",
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
      "POST /api/workouts secondary assistant workout",
    ).workout;
    secondaryWorkoutId = secondaryWorkout.id;
    console.log("OK 201 POST /api/workouts secondary assistant workout");

    const trainingOverviewResponse = await requestJson<AssistantMockTurnData>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          mode: "training_overview",
          message: "看看我最近的训练总览。",
          start_date: "2026-04-29",
          end_date: "2026-04-30",
        }),
      },
    );
    const trainingOverview = expectSuccess(
      trainingOverviewResponse,
      200,
      "POST /api/assistant/mock-turn training_overview",
    );
    primarySessionId = trainingOverview.session_id;
    expectToolCall(
      trainingOverview,
      "get_training_summary",
      "training_overview response",
    );
    assert(
      typeof primarySessionId === "string" && primarySessionId.length > 0,
      "training_overview should return a session_id.",
    );
    assert(
      trainingOverview.answer.evidence.workout_ids.includes(primaryWorkoutIdOne) &&
        trainingOverview.answer.evidence.workout_ids.includes(primaryWorkoutIdTwo) &&
        !trainingOverview.answer.evidence.workout_ids.includes(secondaryWorkoutId),
      "training_overview evidence should include only primary workout ids.",
    );
    assert(
      trainingOverview.answer.evidence.set_ids.length === 0,
      "training_overview should not expose set_ids when the tool result has none.",
    );
    assert(
      !trainingOverview.answer.summary.includes("Deterministic mock summary"),
      "training_overview summary should not expose debug copy.",
    );
    assert(
      trainingOverview.answer.summary.includes("最近 30 天你共记录了"),
      "training_overview summary should use the new Chinese product-facing copy.",
    );
    const primarySessionsAfterFirstTurn = await loadChatSessionsForUser(
      primaryAuth.user.id,
    );
    assert(
      primarySessionsAfterFirstTurn.some(
        (session) => session.id === primarySessionId,
      ),
      "First training_overview turn should persist a chat session for the authenticated user.",
    );
    const messagesAfterFirstTurn = await loadMessagesForSession(
      primarySessionId,
      primaryAuth.user.id,
    );
    assert(
      messagesAfterFirstTurn.length === 2,
      "First mock turn should persist one user message and one assistant message.",
    );
    assert(
      messagesAfterFirstTurn[0]?.role === "user" &&
        messagesAfterFirstTurn[1]?.role === "assistant",
      "Persisted messages should preserve user then assistant order.",
    );
    assert(
      JSON.stringify(messagesAfterFirstTurn[0].content).includes(
        "看看我最近的训练总览。",
      ),
      "Persisted user message should include the submitted text.",
    );
    assert(
      JSON.stringify(messagesAfterFirstTurn[1].structured_output).includes(
        "deterministic_mock",
      ),
      "Persisted assistant message should include the deterministic mock response.",
    );
    assertNoSecretsInPersistedMessage(
      JSON.stringify(messagesAfterFirstTurn[0]),
      primaryAuth.token,
      databaseUrl,
      "Persisted user message",
    );
    assertNoSecretsInPersistedMessage(
      JSON.stringify(messagesAfterFirstTurn[1]),
      primaryAuth.token,
      databaseUrl,
      "Persisted assistant message",
    );
    console.log("OK POST /api/assistant/mock-turn training_overview");
    console.log("OK chat session and first message pair persisted");

    const recommendationContextResponse =
      await requestJson<AssistantMockTurnData>(
        baseUrl,
        "/api/assistant/mock-turn",
        {
          method: "POST",
          headers: createAuthHeaders(primaryToken),
          body: JSON.stringify({
            mode: "recommendation_context",
            session_id: primarySessionId,
            message: "build deterministic context",
            start_date: "2026-04-29",
            end_date: "2026-04-30",
          }),
        },
      );
    const recommendationContext = expectSuccess(
      recommendationContextResponse,
      200,
      "POST /api/assistant/mock-turn recommendation_context",
    );
    expectToolCall(
      recommendationContext,
      "get_recommendation_context",
      "recommendation_context response",
    );
    assert(
      recommendationContext.session_id === primarySessionId,
      "Second mock turn should append to the same session when session_id is provided.",
    );
    assert(
      recommendationContext.answer.evidence.workout_ids.includes(
        primaryWorkoutIdOne,
      ) &&
        recommendationContext.answer.evidence.workout_ids.includes(
          primaryWorkoutIdTwo,
        ) &&
        !recommendationContext.answer.evidence.workout_ids.includes(
          secondaryWorkoutId,
        ),
      "recommendation_context evidence should include only primary workout ids.",
    );
    assert(
      recommendationContext.answer.evidence.calculation_rules.length > 0,
      "recommendation_context should expose evidence rules.",
    );
    assert(
      recommendationContext.answer.summary.includes("确定性上下文预览") ||
        recommendationContext.answer.summary.includes("确定性上下文"),
      "recommendation_context summary should explain deterministic context preview in Chinese.",
    );
    const primarySessionsAfterSecondTurn = await loadChatSessionsForUser(
      primaryAuth.user.id,
    );
    assert(
      primarySessionsAfterSecondTurn.filter(
        (session) => session.id === primarySessionId,
      ).length === 1,
      "Second mock turn should keep appending to the same session when reusing session_id.",
    );
    const messagesAfterSecondTurn = await loadMessagesForSession(
      primarySessionId,
      primaryAuth.user.id,
    );
    assert(
      messagesAfterSecondTurn.length === 4,
      "Second mock turn should append two more persisted messages to the existing session.",
    );
    assert(
      messagesAfterSecondTurn[2]?.role === "user" &&
        messagesAfterSecondTurn[3]?.role === "assistant",
      "Second mock turn should append another user/assistant message pair.",
    );
    console.log("OK POST /api/assistant/mock-turn recommendation_context");
    console.log("OK mock-turn appends messages to the existing session");

    const exerciseProgressResponse = await requestJson<AssistantMockTurnData>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          mode: "exercise_progress",
          session_id: primarySessionId,
          message: "show me bench progress",
          start_date: "2026-04-29",
          end_date: "2026-04-30",
          exercise_id: benchExercise.id,
        }),
      },
    );
    const exerciseProgress = expectSuccess(
      exerciseProgressResponse,
      200,
      "POST /api/assistant/mock-turn exercise_progress",
    );
    expectToolCall(
      exerciseProgress,
      "get_exercise_progress",
      "exercise_progress response",
    );
    assert(
      exerciseProgress.session_id === primarySessionId,
      "exercise_progress should continue using the provided session_id.",
    );
    const expectedBenchEvidenceSetIds = [
      ...primaryBenchSetIds,
      primaryWorkoutTwoSetId,
    ].sort();
    assert(
      JSON.stringify([...exerciseProgress.answer.evidence.set_ids].sort()) ===
        JSON.stringify(expectedBenchEvidenceSetIds),
      "exercise_progress evidence should include only bench set ids from the primary user.",
    );
    assert(
      !exerciseProgress.answer.evidence.set_ids.some((setId) =>
        primarySquatSetIds.includes(setId),
      ),
      "exercise_progress evidence should exclude unrelated squat set ids.",
    );
    assert(
      exerciseProgress.answer.summary.includes("系统预估你的 1RM"),
      "exercise_progress summary should mention the estimated 1RM in Chinese.",
    );
    console.log("OK POST /api/assistant/mock-turn exercise_progress");

    const routedExerciseIntentResponse = await requestJson<AssistantMockTurnData>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          mode: "training_overview",
          session_id: primarySessionId,
          message: "预估我现在的卧推极限。",
          start_date: "2026-04-29",
          end_date: "2026-04-30",
          exercise_id: benchExercise.id,
        }),
      },
    );
    const routedExerciseIntent = expectSuccess(
      routedExerciseIntentResponse,
      200,
      "POST /api/assistant/mock-turn routed bench 1RM intent",
    );
    expectToolCall(
      routedExerciseIntent,
      "get_exercise_progress",
      "routed bench 1RM intent response",
    );
    assert(
      !routedExerciseIntent.tool_calls.some(
        (toolCall) => toolCall.tool_name === "get_training_summary",
      ),
      "Bench 1RM intent should not silently fall back to get_training_summary.",
    );
    console.log("OK POST /api/assistant/mock-turn routed bench 1RM intent");

    const recommendationIntentResponse = await requestJson<AssistantMockTurnData>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          mode: "training_overview",
          session_id: primarySessionId,
          message: "AI 会看到哪些训练数据？",
          start_date: "2026-04-29",
          end_date: "2026-04-30",
        }),
      },
    );
    const recommendationIntent = expectSuccess(
      recommendationIntentResponse,
      200,
      "POST /api/assistant/mock-turn routed recommendation context intent",
    );
    expectToolCall(
      recommendationIntent,
      "get_recommendation_context",
      "routed recommendation context intent response",
    );
    console.log("OK POST /api/assistant/mock-turn routed recommendation context intent");

    const secondaryOverviewResponse = await requestJson<AssistantMockTurnData>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: createAuthHeaders(secondaryToken),
        body: JSON.stringify({
          mode: "training_overview",
          session_id: primarySessionId,
          message: "show me my training overview",
          start_date: "2026-04-29",
          end_date: "2026-04-30",
        }),
      },
    );
    expectError(
      secondaryOverviewResponse,
      403,
      "FORBIDDEN",
      "POST /api/assistant/mock-turn cross-user session access",
    );
    const secondaryOwnSessionResponse = await requestJson<AssistantMockTurnData>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: createAuthHeaders(secondaryToken),
        body: JSON.stringify({
          mode: "training_overview",
          message: "show me my training overview",
          start_date: "2026-04-29",
          end_date: "2026-04-30",
        }),
      },
    );
    const secondaryOverview = expectSuccess(
      secondaryOwnSessionResponse,
      200,
      "POST /api/assistant/mock-turn secondary user isolation",
    );
    expectToolCall(
      secondaryOverview,
      "get_training_summary",
      "secondary training_overview response",
    );
    assert(
      secondaryOverview.answer.evidence.workout_ids.length === 1 &&
        secondaryOverview.answer.evidence.workout_ids[0] === secondaryWorkoutId,
      "Secondary user response should expose only the secondary workout id.",
    );
    console.log("OK POST /api/assistant/mock-turn user isolation");

    const logs = await loadRecentLogsForUser(primaryAuth.user.id);
    const executedToolNames = logs.map((log) => log.tool_name);
    assert(
      executedToolNames.includes("get_training_summary") &&
        executedToolNames.includes("get_recommendation_context") &&
        executedToolNames.includes("get_exercise_progress"),
      "Executed assistant tools should be persisted in tool_call_logs for the authenticated user.",
    );
    console.log("OK tool_call_logs captures assistant tool executions");

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
      "DELETE /api/workouts/:id primary assistant workout one",
    );
    primaryWorkoutIdOne = null;
    console.log("OK 200 DELETE /api/workouts/:id primary assistant workout one");

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
      "DELETE /api/workouts/:id primary assistant workout two",
    );
    primaryWorkoutIdTwo = null;
    console.log("OK 200 DELETE /api/workouts/:id primary assistant workout two");

    const emptyStateResponse = await requestJson<AssistantMockTurnData>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          mode: "training_overview",
          message: "show me my training overview",
          start_date: "2026-04-29",
          end_date: "2026-04-30",
        }),
      },
    );
    const emptyState = expectSuccess(
      emptyStateResponse,
      200,
      "POST /api/assistant/mock-turn empty-state after delete",
    );
    expectToolCall(
      emptyState,
      "get_training_summary",
      "empty-state training_overview response",
    );
    assert(
      emptyState.answer.evidence.workout_ids.length === 0 &&
        emptyState.answer.summary.includes("还没有训练记录"),
      "Empty-state response should remain valid after workout cleanup.",
    );
    console.log("OK POST /api/assistant/mock-turn empty-state after cleanup");

    console.log("Assistant mock-turn smoke passed.");
  } finally {
    await deleteWorkoutIfNeeded(baseUrl, primaryToken ?? "", primaryWorkoutIdOne);
    await deleteWorkoutIfNeeded(baseUrl, primaryToken ?? "", primaryWorkoutIdTwo);
    await deleteWorkoutIfNeeded(baseUrl, secondaryToken ?? "", secondaryWorkoutId);
    await stopServer(server);
  }
}

void main().catch((error: unknown) => {
  console.error("Assistant mock-turn smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
