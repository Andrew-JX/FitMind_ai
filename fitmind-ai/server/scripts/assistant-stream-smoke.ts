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

type AssistantStreamEvent =
  | { type: "state"; state: "thinking" | "tool_calling" | "answering" }
  | { type: "session"; session_id: string }
  | { type: "provider_selected"; provider: "mock" | "anthropic" }
  | { type: "tool_call_started"; tool_name: string }
  | {
      type: "tool_call_finished";
      tool_name: string;
      status: "success" | "error";
      duration_ms: number;
    }
  | { type: "answer_delta"; text: string }
  | {
      type: "done";
      message_id?: string | undefined;
      session_id?: string | undefined;
    }
  | { type: "error"; code: string; message: string };

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

function parseSsePayload(text: string): AssistantStreamEvent[] {
  const frames = text
    .split("\n\n")
    .map((frame) => frame.trim())
    .filter((frame) => frame.length > 0);

  return frames.map((frame, index) => {
    const lines = frame.split("\n");
    const eventLine = lines.find((line) => line.startsWith("event: "));
    const dataLines = lines
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice("data: ".length));

    assert(eventLine !== undefined, `SSE frame ${index} should include event.`);
    assert(dataLines.length > 0, `SSE frame ${index} should include data.`);

    const eventType = eventLine.slice("event: ".length);
    const parsed = JSON.parse(dataLines.join("\n")) as AssistantStreamEvent;

    assert(
      parsed.type === eventType,
      `SSE frame ${index} event mismatch: header=${eventType} payload=${parsed.type}.`,
    );

    return parsed;
  });
}

async function requestSse(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<{
  status: number;
  contentType: string | null;
  rawText: string;
  events: AssistantStreamEvent[];
}> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const rawText = await response.text();

  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    rawText,
    events: response.ok ? parseSsePayload(rawText) : [],
  };
}

function collectEventTypes(events: AssistantStreamEvent[]): string[] {
  return events.map((event) =>
    event.type === "state" ? `state:${event.state}` : event.type,
  );
}

function assertEventOrder(
  events: AssistantStreamEvent[],
  expectedOrder: string[],
  label: string,
): void {
  const actualOrder = collectEventTypes(events);

  assert(
    JSON.stringify(actualOrder) === JSON.stringify(expectedOrder),
    `${label} expected event order ${JSON.stringify(expectedOrder)}, got ${JSON.stringify(actualOrder)}.`,
  );
}

function assertNoRawProviderLeak(serializedValue: string, label: string): void {
  const forbiddenFragments = [
    "content_block",
    "stop_reason",
    "\"kind\"",
    "\"tool_args\"",
    "\"input\"",
    "\"anthropic-version\"",
    "\"x-api-key\"",
  ];

  for (const fragment of forbiddenFragments) {
    assert(
      !serializedValue.includes(fragment),
      `${label} should not contain raw provider payload fragment ${fragment}.`,
    );
  }
}

function assertDoneExists(events: AssistantStreamEvent[], label: string): void {
  assert(
    events.some((event) => event.type === "done"),
    `${label} should include a done event.`,
  );
}

function assertSessionEvent(
  events: AssistantStreamEvent[],
  expectedSessionId: string | null,
  label: string,
): string {
  const sessionEvent = events.find(
    (event): event is Extract<AssistantStreamEvent, { type: "session" }> =>
      event.type === "session",
  );

  assert(sessionEvent !== undefined, `${label} should include a session event.`);
  assert(
    sessionEvent.session_id.length > 0,
    `${label} session event should include a non-empty session_id.`,
  );

  if (expectedSessionId !== null) {
    assert(
      sessionEvent.session_id === expectedSessionId,
      `${label} should reuse session_id ${expectedSessionId}.`,
    );
  }

  return sessionEvent.session_id;
}

function assertDoneSessionId(
  events: AssistantStreamEvent[],
  expectedSessionId: string,
  label: string,
): void {
  const doneEvent = events.find(
    (event): event is Extract<AssistantStreamEvent, { type: "done" }> =>
      event.type === "done",
  );

  assert(doneEvent !== undefined, `${label} should include a done event.`);
  assert(
    doneEvent.session_id === expectedSessionId,
    `${label} done event should include session_id ${expectedSessionId}.`,
  );
}

function assertSessionBeforeAnswer(
  events: AssistantStreamEvent[],
  label: string,
): void {
  const sessionIndex = events.findIndex((event) => event.type === "session");
  const firstAnswerDeltaIndex = events.findIndex(
    (event) => event.type === "answer_delta",
  );

  assert(sessionIndex >= 0, `${label} should include a session event.`);

  if (firstAnswerDeltaIndex >= 0) {
    assert(
      sessionIndex <= firstAnswerDeltaIndex,
      `${label} should emit session_id before or no later than the first answer_delta.`,
    );
  }
}

function assertErrorExists(events: AssistantStreamEvent[], label: string): void {
  assert(
    events.some((event) => event.type === "error"),
    `${label} should include an error event.`,
  );
}

function assertNoDoneEvent(events: AssistantStreamEvent[], label: string): void {
  assert(
    !events.some((event) => event.type === "done"),
    `${label} should not include a done event.`,
  );
}

function assertProviderSelected(
  events: AssistantStreamEvent[],
  label: string,
): void {
  const providerEvent = events.find(
    (event): event is Extract<AssistantStreamEvent, { type: "provider_selected" }> =>
      event.type === "provider_selected",
  );

  assert(providerEvent !== undefined, `${label} should include provider_selected.`);
  assert(
    providerEvent.provider === "mock" || providerEvent.provider === "anthropic",
    `${label} should use a supported provider name.`,
  );
}

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(scriptDir, "..", ".env.local");
  await loadEnvFile(envPath);

  assert(
    typeof process.env.DATABASE_URL === "string" &&
      process.env.DATABASE_URL.length > 0,
    "DATABASE_URL is required for assistant stream smoke.",
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
  const primaryEmail = `assistant-stream-smoke-${uniqueSuffix}@example.com`;
  const secondaryEmail =
    `assistant-stream-smoke-other-${uniqueSuffix}@example.com`;

  let primaryToken: string | null = null;
  let secondaryToken: string | null = null;
  let primaryWorkoutIdOne: string | null = null;
  let primaryWorkoutIdTwo: string | null = null;
  let secondaryWorkoutId: string | null = null;

  try {
    console.log(`Smoke base URL: ${baseUrl}`);

    const unauthorizedResponse = await requestJson<unknown>(
      baseUrl,
      "/api/assistant/stream-turn",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          mode: "training_overview",
          message: "show me my training overview",
          start_date: "2026-05-01",
          end_date: "2026-05-02",
        }),
      },
    );
    expectError(
      unauthorizedResponse,
      401,
      "UNAUTHORIZED",
      "POST /api/assistant/stream-turn without token",
    );
    console.log("OK 401 POST /api/assistant/stream-turn without token");

    const primaryAuth = await registerUser(
      baseUrl,
      primaryEmail,
      "Assistant Stream Smoke",
    );
    primaryToken = primaryAuth.token;
    console.log("OK 201 POST /api/auth/register primary user");

    const secondaryAuth = await registerUser(
      baseUrl,
      secondaryEmail,
      "Assistant Stream Smoke Other User",
    );
    secondaryToken = secondaryAuth.token;
    console.log("OK 201 POST /api/auth/register secondary user");

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
      primaryToken,
      {
        performed_at: "2026-05-01T09:00:00Z",
        duration_minutes: 45,
        notes: "Assistant stream smoke workout one",
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
      "POST /api/workouts primary stream workout one",
    );
    primaryWorkoutIdOne = primaryWorkoutOne.id;
    console.log("OK 201 POST /api/workouts primary stream workout one");

    const primaryWorkoutTwo = await createWorkout(
      baseUrl,
      primaryToken,
      {
        performed_at: "2026-05-02T09:00:00Z",
        duration_minutes: 40,
        notes: "Assistant stream smoke workout two",
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
      "POST /api/workouts primary stream workout two",
    );
    primaryWorkoutIdTwo = primaryWorkoutTwo.id;
    console.log("OK 201 POST /api/workouts primary stream workout two");

    const secondaryWorkout = await createWorkout(
      baseUrl,
      secondaryToken,
      {
        performed_at: "2026-05-01T11:00:00Z",
        duration_minutes: 30,
        notes: "Secondary stream workout",
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
      "POST /api/workouts secondary stream workout",
    );
    secondaryWorkoutId = secondaryWorkout.id;
    console.log("OK 201 POST /api/workouts secondary stream workout");

    const normalStream = await requestSse(baseUrl, "/api/assistant/stream-turn", {
      method: "POST",
      headers: createAuthHeaders(primaryToken),
      body: JSON.stringify({
        mode: "training_overview",
        message: "show me my training overview",
        start_date: "2026-05-01",
        end_date: "2026-05-02",
      }),
    });
    assert(
      normalStream.status === 200,
      `Normal stream expected HTTP 200, got ${normalStream.status}.`,
    );
    assert(
      normalStream.contentType?.includes("text/event-stream") ?? false,
      "Normal stream should use text/event-stream content type.",
    );
    assertProviderSelected(normalStream.events, "Normal stream");
    const normalSessionId = assertSessionEvent(
      normalStream.events,
      null,
      "Normal stream",
    );
    assertSessionBeforeAnswer(normalStream.events, "Normal stream");
    assertEventOrder(
      normalStream.events,
      [
        "state:thinking",
        "session",
        "provider_selected",
        "state:tool_calling",
        "tool_call_started",
        "tool_call_finished",
        "state:answering",
        ...normalStream.events
          .filter((event) => event.type === "answer_delta")
          .map(() => "answer_delta"),
        "done",
      ],
      "Normal tool-backed stream",
    );
    assertDoneExists(normalStream.events, "Normal stream");
    assertDoneSessionId(normalStream.events, normalSessionId, "Normal stream");
    assert(
      normalStream.events.filter((event) => event.type === "answer_delta").length > 0,
      "Normal stream should include answer_delta chunks.",
    );
    const normalToolStart = normalStream.events.find(
      (event): event is Extract<AssistantStreamEvent, { type: "tool_call_started" }> =>
        event.type === "tool_call_started",
    );
    const normalToolFinish = normalStream.events.find(
      (
        event,
      ): event is Extract<AssistantStreamEvent, { type: "tool_call_finished" }> =>
        event.type === "tool_call_finished",
    );
    assert(
      normalToolStart?.tool_name === "get_training_summary",
      "Normal stream should start get_training_summary.",
    );
    assert(
      normalToolFinish?.tool_name === "get_training_summary" &&
        normalToolFinish.status === "success" &&
        normalToolFinish.duration_ms >= 0,
      "Normal stream should finish get_training_summary successfully.",
    );
    assertNoRawProviderLeak(normalStream.rawText, "Normal stream raw SSE");
    console.log("OK normal tool-backed stream");

    const primarySessions = await listChatSessionsForUser(primaryAuth.user.id);
    assert(
      primarySessions.length === 1,
      "Normal stream should create one primary-user chat session.",
    );
    const primarySessionId = primarySessions[0]?.id;
    assert(
      typeof primarySessionId === "string" && primarySessionId.length > 0,
      "Normal stream should create a usable session id.",
    );
    assert(
      normalSessionId === primarySessionId,
      "Normal stream session event should match the persisted primary session id.",
    );
    const normalMessages = await listMessagesForSession(
      primarySessionId,
      primaryAuth.user.id,
    );
    assert(
      normalMessages.length === 2,
      "Normal stream should persist one user and one assistant message.",
    );
    console.log("OK normal stream persistence");

    const textStream = await requestSse(baseUrl, "/api/assistant/stream-turn", {
      method: "POST",
      headers: createAuthHeaders(primaryToken),
      body: JSON.stringify({
        mode: "training_overview",
        session_id: primarySessionId,
        message: "[mock:text] explain without a tool",
        start_date: "2026-05-01",
        end_date: "2026-05-02",
      }),
    });
    assert(
      textStream.status === 200,
      `Text stream expected HTTP 200, got ${textStream.status}.`,
    );
    assertProviderSelected(textStream.events, "Text stream");
    const textSessionId = assertSessionEvent(
      textStream.events,
      primarySessionId,
      "Text stream",
    );
    assertSessionBeforeAnswer(textStream.events, "Text stream");
    assertEventOrder(
      textStream.events,
      [
        "state:thinking",
        "session",
        "provider_selected",
        "state:answering",
        ...textStream.events
          .filter((event) => event.type === "answer_delta")
          .map(() => "answer_delta"),
        "done",
      ],
      "[mock:text] stream",
    );
    assertDoneExists(textStream.events, "[mock:text] stream");
    assertDoneSessionId(textStream.events, textSessionId, "[mock:text] stream");
    assert(
      !textStream.events.some((event) => event.type === "tool_call_started"),
      "[mock:text] stream should not start a tool call.",
    );
    assertNoRawProviderLeak(textStream.rawText, "[mock:text] raw SSE");
    console.log("OK [mock:text] stream");

    const textMessages = await listMessagesForSession(
      primarySessionId,
      primaryAuth.user.id,
    );
    assert(
      textMessages.length === 4,
      "[mock:text] stream should append another user and assistant message pair.",
    );
    console.log("OK [mock:text] stream persistence");

    const errorStream = await requestSse(baseUrl, "/api/assistant/stream-turn", {
      method: "POST",
      headers: createAuthHeaders(primaryToken),
      body: JSON.stringify({
        mode: "training_overview",
        session_id: primarySessionId,
        message: "[mock:error] provider failed",
        start_date: "2026-05-01",
        end_date: "2026-05-02",
      }),
    });
    assert(
      errorStream.status === 200,
      `Error stream expected HTTP 200, got ${errorStream.status}.`,
    );
    assertProviderSelected(errorStream.events, "Error stream");
    assertSessionEvent(errorStream.events, primarySessionId, "Error stream");
    assertEventOrder(
      errorStream.events,
      ["state:thinking", "session", "provider_selected", "error"],
      "[mock:error] stream",
    );
    assertErrorExists(errorStream.events, "[mock:error] stream");
    assertNoDoneEvent(errorStream.events, "[mock:error] stream");
    const providerErrorEvent = errorStream.events.find(
      (event): event is Extract<AssistantStreamEvent, { type: "error" }> =>
        event.type === "error",
    );
    assert(
      providerErrorEvent?.code === "AI_PROVIDER_ERROR",
      "[mock:error] stream should map to AI_PROVIDER_ERROR.",
    );
    assert(
      providerErrorEvent.message.includes("Deterministic mock provider error"),
      "[mock:error] stream should preserve the mapped provider error message.",
    );
    assertNoRawProviderLeak(errorStream.rawText, "[mock:error] raw SSE");
    console.log("OK [mock:error] stream");

    const crossUserStream = await requestSse(baseUrl, "/api/assistant/stream-turn", {
      method: "POST",
      headers: createAuthHeaders(secondaryToken),
      body: JSON.stringify({
        mode: "training_overview",
        session_id: primarySessionId,
        message: "show me my training overview",
        start_date: "2026-05-01",
        end_date: "2026-05-02",
      }),
    });
    assert(
      crossUserStream.status === 200,
      `Cross-user stream expected HTTP 200, got ${crossUserStream.status}.`,
    );
    assertEventOrder(
      crossUserStream.events,
      ["state:thinking", "error"],
      "Cross-user isolation stream",
    );
    assertErrorExists(crossUserStream.events, "Cross-user isolation stream");
    assertNoDoneEvent(crossUserStream.events, "Cross-user isolation stream");
    const crossUserError = crossUserStream.events.find(
      (event): event is Extract<AssistantStreamEvent, { type: "error" }> =>
        event.type === "error",
    );
    assert(
      crossUserError?.code === "FORBIDDEN",
      "Cross-user isolation stream should emit FORBIDDEN.",
    );
    console.log("OK stream second-user isolation");

    const secondaryStream = await requestSse(baseUrl, "/api/assistant/stream-turn", {
      method: "POST",
      headers: createAuthHeaders(secondaryToken),
      body: JSON.stringify({
        mode: "training_overview",
        message: "show me my training overview",
        start_date: "2026-05-01",
        end_date: "2026-05-02",
      }),
    });
    assert(
      secondaryStream.status === 200,
      `Secondary stream expected HTTP 200, got ${secondaryStream.status}.`,
    );
    assertDoneExists(secondaryStream.events, "Secondary user stream");
    assertNoRawProviderLeak(secondaryStream.rawText, "Secondary user stream");
    console.log("OK secondary user normal stream");

    console.log("Assistant stream smoke passed.");
  } finally {
    await deleteWorkoutIfNeeded(baseUrl, primaryToken ?? "", primaryWorkoutIdOne);
    await deleteWorkoutIfNeeded(baseUrl, primaryToken ?? "", primaryWorkoutIdTwo);
    await deleteWorkoutIfNeeded(baseUrl, secondaryToken ?? "", secondaryWorkoutId);
    await stopServer(server);
  }
}

void main().catch((error: unknown) => {
  console.error("Assistant stream smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
