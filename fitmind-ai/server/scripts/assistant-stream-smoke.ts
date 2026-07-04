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
  assert(address !== null && typeof address !== "string", "Expected a port.");

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

function createAuthHeaders(token: string): HeadersInit {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
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
): Promise<string> {
  const response = await requestJson<WorkoutDetailData>(
    baseUrl,
    "/api/workouts",
    {
      method: "POST",
      headers: createAuthHeaders(token),
      body: JSON.stringify(input),
    },
  );

  return expectSuccess(response, 201, "POST /api/workouts").workout.id;
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

    assert(eventLine, `Missing event line in frame ${index}.`);
    assert(dataLines.length > 0, `Missing data lines in frame ${index}.`);

    const eventType = eventLine.slice("event: ".length);
    const parsed = JSON.parse(dataLines.join("\n")) as AssistantStreamEvent;
    assert(
      parsed.type === eventType,
      `Frame ${index} event mismatch: expected ${eventType}, got ${parsed.type}.`,
    );

    return parsed;
  });
}

async function requestSse(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<{
  contentType: string | null;
  events: AssistantStreamEvent[];
  status: number;
}> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const rawText = await response.text();

  return {
    contentType: response.headers.get("content-type"),
    events: response.ok ? parseSsePayload(rawText) : [],
    status: response.status,
  };
}

function collectEventTypes(events: AssistantStreamEvent[]): string[] {
  return events.map((event) =>
    event.type === "state" ? `state:${event.state}` : event.type,
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
  }

  const { server, baseUrl } = await startServer();
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const primaryEmail = `assistant-stream-smoke-${uniqueSuffix}@example.com`;
  const secondaryEmail = `assistant-stream-smoke-other-${uniqueSuffix}@example.com`;
  let primaryToken: string | null = null;
  let secondaryToken: string | null = null;
  let primaryWorkoutId: string | null = null;
  let secondaryWorkoutId: string | null = null;

  try {
    const primaryAuth = await registerUser(
      baseUrl,
      primaryEmail,
      "Assistant Stream Smoke",
    );
    primaryToken = primaryAuth.token;
    const secondaryAuth = await registerUser(
      baseUrl,
      secondaryEmail,
      "Assistant Stream Smoke Other",
    );
    secondaryToken = secondaryAuth.token;

    const benchSearch = expectSuccess(
      await requestJson<ExerciseSearchData>(baseUrl, "/api/exercises?q=bench"),
      200,
      "GET /api/exercises?q=bench",
    );
    const benchExercise = benchSearch.items[0];
    assert(benchExercise, "Expected a bench exercise.");

    primaryWorkoutId = await createWorkout(baseUrl, primaryToken, {
      performed_at: "2026-05-01T09:00:00Z",
      duration_minutes: 45,
      notes: "Assistant stream workout",
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
      ],
    });

    secondaryWorkoutId = await createWorkout(baseUrl, secondaryToken, {
      performed_at: "2026-05-01T11:00:00Z",
      duration_minutes: 30,
      notes: "Other user stream workout",
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
    });

    const normalStream = await requestSse(
      baseUrl,
      "/api/assistant/stream-turn",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          mode: "training_overview",
          message: "最近训练总览",
          start_date: "2026-05-01",
          end_date: "2026-05-02",
        }),
      },
    );
    assert(normalStream.status === 200, "Normal stream should return 200.");
    assert(
      normalStream.contentType?.includes("text/event-stream") ?? false,
      "Normal stream should use text/event-stream.",
    );
    assert(
      JSON.stringify(collectEventTypes(normalStream.events)) ===
        JSON.stringify([
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
        ]),
      "Normal stream should preserve the SSE event order contract.",
    );
    const normalSession = normalStream.events.find(
      (event): event is Extract<AssistantStreamEvent, { type: "session" }> =>
        event.type === "session",
    );
    assert(normalSession, "Normal stream should emit a session event.");
    const normalDone = normalStream.events.find(
      (event): event is Extract<AssistantStreamEvent, { type: "done" }> =>
        event.type === "done",
    );
    assert(
      normalDone?.session_id === normalSession.session_id,
      "Done event should repeat the same session id.",
    );

    const textStream = await requestSse(baseUrl, "/api/assistant/stream-turn", {
      method: "POST",
      headers: createAuthHeaders(primaryToken),
      body: JSON.stringify({
        mode: "training_overview",
        session_id: normalSession.session_id,
        message: "[mock:text] 这次不要调用工具，直接返回说明。",
        start_date: "2026-05-01",
        end_date: "2026-05-02",
      }),
    });
    assert(textStream.status === 200, "Text stream should return 200.");
    assert(
      !textStream.events.some((event) => event.type === "tool_call_started"),
      "[mock:text] stream should not start a tool call.",
    );

    const errorStream = await requestSse(
      baseUrl,
      "/api/assistant/stream-turn",
      {
        method: "POST",
        headers: createAuthHeaders(primaryToken),
        body: JSON.stringify({
          mode: "training_overview",
          session_id: normalSession.session_id,
          message: "[mock:error] provider failed",
          start_date: "2026-05-01",
          end_date: "2026-05-02",
        }),
      },
    );
    assert(errorStream.status === 200, "Error stream should return 200.");
    assert(
      JSON.stringify(collectEventTypes(errorStream.events)) ===
        JSON.stringify([
          "state:thinking",
          "session",
          "provider_selected",
          "error",
        ]),
      "Error stream should preserve the SSE error sequence.",
    );
    const providerErrorEvent = errorStream.events.find(
      (event): event is Extract<AssistantStreamEvent, { type: "error" }> =>
        event.type === "error",
    );
    assert(
      providerErrorEvent?.code === "AI_PROVIDER_ERROR",
      "[mock:error] stream should surface AI_PROVIDER_ERROR.",
    );
    assert(
      providerErrorEvent.message.includes("provider failed"),
      "[mock:error] stream should preserve the provider error message.",
    );

    const crossUserStream = await requestSse(
      baseUrl,
      "/api/assistant/stream-turn",
      {
        method: "POST",
        headers: createAuthHeaders(secondaryToken),
        body: JSON.stringify({
          mode: "training_overview",
          session_id: normalSession.session_id,
          message: "最近训练总览",
          start_date: "2026-05-01",
          end_date: "2026-05-02",
        }),
      },
    );
    assert(
      crossUserStream.status === 200,
      "Cross-user stream should return 200.",
    );
    assert(
      JSON.stringify(collectEventTypes(crossUserStream.events)) ===
        JSON.stringify(["state:thinking", "error"]),
      "Cross-user access should fail without changing SSE event names.",
    );

    const primarySessions = await listChatSessionsForUser(primaryAuth.user.id);
    assert(
      primarySessions.some(
        (session) => session.id === normalSession.session_id,
      ),
      "Normal stream should persist a chat session.",
    );
    const persistedMessages = await listMessagesForSession(
      normalSession.session_id,
      primaryAuth.user.id,
    );
    assert(
      persistedMessages.length >= 2,
      "Normal stream should persist at least one user/assistant pair.",
    );

    console.log("Assistant stream smoke passed.");
  } finally {
    await deleteWorkoutIfNeeded(baseUrl, primaryToken ?? "", primaryWorkoutId);
    await deleteWorkoutIfNeeded(
      baseUrl,
      secondaryToken ?? "",
      secondaryWorkoutId,
    );
    await stopServer(server);
  }
}

void main().catch((error: unknown) => {
  console.error("Assistant stream smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
