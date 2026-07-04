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

  return expectSuccess(response, 201, "POST /api/workouts").workout;
}

async function deleteWorkoutIfNeeded(
  baseUrl: string,
  token: string,
  workoutId: string | null,
): Promise<void> {
  if (!workoutId) {
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
    // Best-effort cleanup.
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

function expectToolCall(
  response: AssistantMockTurnData,
  toolName: string,
  label: string,
): void {
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
  }

  const { server, baseUrl } = await startServer();
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const primaryEmail = `assistant-mock-turn-smoke-${uniqueSuffix}@example.com`;
  const secondaryEmail = `assistant-mock-turn-smoke-other-${uniqueSuffix}@example.com`;
  let primaryToken: string | null = null;
  let secondaryToken: string | null = null;
  let primaryWorkoutIdOne: string | null = null;
  let primaryWorkoutIdTwo: string | null = null;
  let secondaryWorkoutId: string | null = null;

  try {
    const primaryAuth = await registerUser(
      baseUrl,
      primaryEmail,
      "Assistant Mock Turn Smoke",
    );
    primaryToken = primaryAuth.token;

    const secondaryAuth = await registerUser(
      baseUrl,
      secondaryEmail,
      "Assistant Mock Turn Smoke Other",
    );
    secondaryToken = secondaryAuth.token;

    const benchSearch = expectSuccess(
      await requestJson<ExerciseSearchData>(baseUrl, "/api/exercises?q=bench"),
      200,
      "GET /api/exercises?q=bench",
    );
    const squatSearch = expectSuccess(
      await requestJson<ExerciseSearchData>(baseUrl, "/api/exercises?q=squat"),
      200,
      "GET /api/exercises?q=squat",
    );
    const benchExercise = benchSearch.items[0];
    const squatExercise = squatSearch.items[0];
    assert(
      benchExercise && squatExercise,
      "Expected bench and squat exercises.",
    );

    const primaryWorkoutOne = await createWorkout(baseUrl, primaryToken, {
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
    });
    primaryWorkoutIdOne = primaryWorkoutOne.id;
    const primaryBenchSetIds = primaryWorkoutOne.sets
      .filter((setItem) => setItem.exercise_id === benchExercise.id)
      .map((setItem) => setItem.id);
    const primarySquatSetIds = primaryWorkoutOne.sets
      .filter((setItem) => setItem.exercise_id === squatExercise.id)
      .map((setItem) => setItem.id);

    const primaryWorkoutTwo = await createWorkout(baseUrl, primaryToken, {
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
    });
    primaryWorkoutIdTwo = primaryWorkoutTwo.id;
    const primaryWorkoutTwoSetId = primaryWorkoutTwo.sets[0]?.id;
    assert(primaryWorkoutTwoSetId, "Expected a bench set id in workout two.");

    const secondaryWorkout = await createWorkout(baseUrl, secondaryToken, {
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
    });
    secondaryWorkoutId = secondaryWorkout.id;

    const missingExerciseIdTurn = expectSuccess(
      await requestJson<AssistantMockTurnData>(
        baseUrl,
        "/api/assistant/mock-turn",
        {
          method: "POST",
          headers: createAuthHeaders(primaryToken),
          body: JSON.stringify({
            mode: "exercise_progress",
            message: "当前动作进展",
            start_date: "2026-04-29",
            end_date: "2026-04-30",
          }),
        },
      ),
      200,
      "POST /api/assistant/mock-turn missing exercise",
    );
    assert(
      missingExerciseIdTurn.tool_calls.length === 0,
      "Missing exercise progress prompt should not execute a tool.",
    );
    assert(
      missingExerciseIdTurn.answer.summary.includes(
        "请先去“分析”页选中对应动作",
      ),
      "Missing exercise progress prompt should ask the user to select an exercise.",
    );

    const trainingOverview = expectSuccess(
      await requestJson<AssistantMockTurnData>(
        baseUrl,
        "/api/assistant/mock-turn",
        {
          method: "POST",
          headers: createAuthHeaders(primaryToken),
          body: JSON.stringify({
            mode: "training_overview",
            message: "最近训练总览",
            start_date: "2026-04-29",
            end_date: "2026-04-30",
          }),
        },
      ),
      200,
      "POST /api/assistant/mock-turn training_overview",
    );
    const sessionId = trainingOverview.session_id;
    expectToolCall(
      trainingOverview,
      "get_training_summary",
      "training_overview",
    );
    assert(
      trainingOverview.answer.summary.includes("根据你最近这段时间的训练记录"),
      "Training overview should use product-facing Chinese copy.",
    );
    assert(
      trainingOverview.answer.evidence.workout_ids.includes(
        primaryWorkoutIdOne,
      ) &&
        trainingOverview.answer.evidence.workout_ids.includes(
          primaryWorkoutIdTwo,
        ) &&
        !trainingOverview.answer.evidence.workout_ids.includes(
          secondaryWorkoutId,
        ),
      "Training overview should only expose primary-user workout ids.",
    );

    const nextTrainingFocus = expectSuccess(
      await requestJson<AssistantMockTurnData>(
        baseUrl,
        "/api/assistant/mock-turn",
        {
          method: "POST",
          headers: createAuthHeaders(primaryToken),
          body: JSON.stringify({
            mode: "next_training_focus",
            session_id: sessionId,
            message: "我今天应该练什么？",
            start_date: "2026-04-29",
            end_date: "2026-04-30",
          }),
        },
      ),
      200,
      "POST /api/assistant/mock-turn next_training_focus",
    );
    expectToolCall(
      nextTrainingFocus,
      "get_recommendation_context",
      "next_training_focus",
    );
    assert(
      nextTrainingFocus.answer.summary.includes("下一次训练可以优先补"),
      "next_training_focus should return a conservative suggestion.",
    );

    const muscleBalance = expectSuccess(
      await requestJson<AssistantMockTurnData>(
        baseUrl,
        "/api/assistant/mock-turn",
        {
          method: "POST",
          headers: createAuthHeaders(primaryToken),
          body: JSON.stringify({
            mode: "muscle_balance",
            session_id: sessionId,
            message: "我胸练得够吗？",
            start_date: "2026-04-29",
            end_date: "2026-04-30",
          }),
        },
      ),
      200,
      "POST /api/assistant/mock-turn muscle_balance",
    );
    expectToolCall(
      muscleBalance,
      "get_recommendation_context",
      "muscle_balance",
    );
    assert(
      muscleBalance.answer.summary.includes("训练量") ||
        muscleBalance.answer.summary.includes("训练"),
      "muscle_balance should explain the distribution in product copy.",
    );

    const trainingImbalance = expectSuccess(
      await requestJson<AssistantMockTurnData>(
        baseUrl,
        "/api/assistant/mock-turn",
        {
          method: "POST",
          headers: createAuthHeaders(primaryToken),
          body: JSON.stringify({
            mode: "training_imbalance",
            session_id: sessionId,
            message: "我是不是训练偏科？",
            start_date: "2026-04-29",
            end_date: "2026-04-30",
          }),
        },
      ),
      200,
      "POST /api/assistant/mock-turn training_imbalance",
    );
    expectToolCall(
      trainingImbalance,
      "get_recommendation_context",
      "training_imbalance",
    );
    assert(
      trainingImbalance.answer.summary.includes("偏科") ||
        trainingImbalance.answer.summary.includes("均衡"),
      "training_imbalance should use product-facing imbalance language.",
    );

    const exerciseProgress = expectSuccess(
      await requestJson<AssistantMockTurnData>(
        baseUrl,
        "/api/assistant/mock-turn",
        {
          method: "POST",
          headers: createAuthHeaders(primaryToken),
          body: JSON.stringify({
            mode: "exercise_progress",
            session_id: sessionId,
            message: "预估我现在的卧推极限",
            start_date: "2026-04-29",
            end_date: "2026-04-30",
            exercise_id: benchExercise.id,
          }),
        },
      ),
      200,
      "POST /api/assistant/mock-turn exercise_progress",
    );
    expectToolCall(
      exerciseProgress,
      "get_exercise_progress",
      "exercise_progress",
    );
    const expectedBenchSetIds = [
      ...primaryBenchSetIds,
      primaryWorkoutTwoSetId,
    ].sort();
    assert(
      JSON.stringify([...exerciseProgress.answer.evidence.set_ids].sort()) ===
        JSON.stringify(expectedBenchSetIds),
      "exercise_progress should expose only the bench set ids.",
    );
    assert(
      !exerciseProgress.answer.evidence.set_ids.some((setId) =>
        primarySquatSetIds.includes(setId),
      ),
      "exercise_progress should not include unrelated squat set ids.",
    );
    assert(
      exerciseProgress.answer.summary.includes("估算 1RM"),
      "exercise_progress should mention the estimated 1RM.",
    );

    const routedExerciseIntent = expectSuccess(
      await requestJson<AssistantMockTurnData>(
        baseUrl,
        "/api/assistant/mock-turn",
        {
          method: "POST",
          headers: createAuthHeaders(primaryToken),
          body: JSON.stringify({
            mode: "training_overview",
            session_id: sessionId,
            message: "预估我现在的卧推极限",
            start_date: "2026-04-29",
            end_date: "2026-04-30",
            exercise_id: benchExercise.id,
          }),
        },
      ),
      200,
      "POST /api/assistant/mock-turn routed exercise intent",
    );
    expectToolCall(
      routedExerciseIntent,
      "get_exercise_progress",
      "routed exercise intent",
    );
    assert(
      !routedExerciseIntent.tool_calls.some(
        (toolCall) => toolCall.tool_name === "get_training_summary",
      ),
      "Exercise progress intent must not silently fall back to training summary.",
    );

    const evidenceExplain = expectSuccess(
      await requestJson<AssistantMockTurnData>(
        baseUrl,
        "/api/assistant/mock-turn",
        {
          method: "POST",
          headers: createAuthHeaders(primaryToken),
          body: JSON.stringify({
            mode: "evidence_explain",
            session_id: sessionId,
            message: "你根据什么判断？",
            start_date: "2026-04-29",
            end_date: "2026-04-30",
          }),
        },
      ),
      200,
      "POST /api/assistant/mock-turn evidence_explain",
    );
    expectToolCall(
      evidenceExplain,
      "get_recommendation_context",
      "evidence_explain",
    );
    assert(
      evidenceExplain.answer.summary.includes("不是模型凭空猜测"),
      "evidence_explain should clarify the deterministic evidence basis.",
    );

    const unsupportedTurn = expectSuccess(
      await requestJson<AssistantMockTurnData>(
        baseUrl,
        "/api/assistant/mock-turn",
        {
          method: "POST",
          headers: createAuthHeaders(primaryToken),
          body: JSON.stringify({
            mode: "unsupported",
            session_id: sessionId,
            message: "今天天气怎么样，顺便讲个笑话",
            start_date: "2026-04-29",
            end_date: "2026-04-30",
          }),
        },
      ),
      200,
      "POST /api/assistant/mock-turn unsupported",
    );
    assert(
      unsupportedTurn.tool_calls.length === 0,
      "Unsupported prompt should not execute any tool.",
    );
    assert(
      unsupportedTurn.answer.summary.includes("这个问题我还没识别清楚"),
      "Unsupported prompt should explain supported question types.",
    );

    const secondarySessionAccess = await requestJson<AssistantMockTurnData>(
      baseUrl,
      "/api/assistant/mock-turn",
      {
        method: "POST",
        headers: createAuthHeaders(secondaryToken),
        body: JSON.stringify({
          mode: "training_overview",
          session_id: sessionId,
          message: "最近训练总览",
          start_date: "2026-04-29",
          end_date: "2026-04-30",
        }),
      },
    );
    expectError(
      secondarySessionAccess,
      403,
      "FORBIDDEN",
      "POST /api/assistant/mock-turn cross-user session access",
    );

    const logs = await loadRecentLogsForUser(primaryAuth.user.id);
    const executedToolNames = logs.map((log) => log.tool_name);
    assert(
      executedToolNames.includes("get_training_summary") &&
        executedToolNames.includes("get_recommendation_context") &&
        executedToolNames.includes("get_exercise_progress"),
      "tool_call_logs should capture the expected assistant tool executions.",
    );

    const sessions = await listChatSessionsForUser(primaryAuth.user.id);
    assert(
      sessions.some((session) => session.id === sessionId),
      "The first assistant turn should persist a chat session.",
    );
    const persistedMessages = await listMessagesForSession(
      sessionId,
      primaryAuth.user.id,
    );
    assert(
      persistedMessages.length >= 2,
      "Assistant turns should persist user and assistant messages.",
    );

    const deleteOne = await requestJson<DeleteResponseData>(
      baseUrl,
      `/api/workouts/${primaryWorkoutIdOne}`,
      {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    expectSuccess(deleteOne, 200, "DELETE workout one");
    primaryWorkoutIdOne = null;

    const deleteTwo = await requestJson<DeleteResponseData>(
      baseUrl,
      `/api/workouts/${primaryWorkoutIdTwo}`,
      {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${primaryToken}`,
        },
      },
    );
    expectSuccess(deleteTwo, 200, "DELETE workout two");
    primaryWorkoutIdTwo = null;

    const emptyStateTurn = expectSuccess(
      await requestJson<AssistantMockTurnData>(
        baseUrl,
        "/api/assistant/mock-turn",
        {
          method: "POST",
          headers: createAuthHeaders(primaryToken),
          body: JSON.stringify({
            mode: "training_overview",
            message: "最近训练总览",
            start_date: "2026-04-29",
            end_date: "2026-04-30",
          }),
        },
      ),
      200,
      "POST /api/assistant/mock-turn empty-state",
    );
    expectToolCall(emptyStateTurn, "get_training_summary", "empty_state");
    assert(
      emptyStateTurn.answer.evidence.workout_ids.length === 0 &&
        emptyStateTurn.answer.summary.includes("还没有可用的训练数据"),
      "Empty-state overview should stay honest after cleanup.",
    );

    console.log("Assistant mock-turn smoke passed.");
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
  console.error("Assistant mock-turn smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
