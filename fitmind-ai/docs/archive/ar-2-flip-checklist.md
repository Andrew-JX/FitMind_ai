# AR-2 DeepSeek flip checklist

**Status: archived 2026-07-27 — this flip has been executed.**

AR-2 went live on 2026-07-16: the user set the four environment variables in
Vercel and redeployed, and production has been answering with real DeepSeek
since. This file is kept for its rollback path and for the `AR2_DB_TARGET`
guard that stops local verification from writing to the production Neon
database — not as a pending task. The header below described the pre-flip state
and is left intact as the record of what was actually run.

AR-2 changes no application code and grants Codex no authority to change Vercel
or any other online environment. The temporary verifier below is local-only,
reads its key from `.env`, never prints the key, and must not be committed.

## 1. Before running anything

From the repository root, confirm the local configuration contains these values:

```text
ASSISTANT_PROVIDER=openai_compatible
OPENAI_COMPAT_BASE_URL=https://api.deepseek.com
OPENAI_COMPAT_MODEL=deepseek-chat
OPENAI_COMPAT_API_KEY=<LOCAL_SECRET_ALREADY_IN_.env>
```

Do not paste the real key into this document, a command line, a screenshot, or a
shell history entry. The verifier loads it directly from `.env`.

Stop any other local FitMind server before each scenario. Provider and budget
configuration is captured by process-level singletons, so every scenario must
run in a fresh process.

### Database target: a hard gate

The verifier registers a disposable user and writes workouts, chat sessions,
messages, and tool-call logs. `DATABASE_URL` is therefore a **write target**, not
just a connection check. If `.env` points to a production Neon database, the
verification data is written to that production database.

Choose exactly one target for each invocation:

```powershell
# Only accepted when DATABASE_URL is loopback (localhost, 127.0.0.1, or ::1).
$env:AR2_DB_TARGET = "local"

# Explicitly acknowledge a disposable local or remote scratch database.
$env:AR2_DB_TARGET = "scratch"

# Explicitly acknowledge that the configured Neon/remote DB may retain data.
$env:AR2_DB_TARGET = "accept-neon-residue"
```

With `AR2_DB_TARGET` unset, invalid, or set to `local` while `DATABASE_URL` is
remote, the verifier exits **before registration and before any paid DeepSeek
call**. It prints only the database host and database name; credentials and URL
query parameters are never printed.

The verifier creates a unique
`ar2-live-<timestamp>-<suffix>@example.com` account. Its `finally` block first
deletes created workouts through the authenticated API, then issues a
parameterized `DELETE FROM users WHERE id = $1 AND email = $2`. Current foreign
keys cascade that exact disposable user's sessions, messages, tool logs, and
other owned rows. This is best-effort only: process termination, network loss,
or insufficient DB permissions can leave the printed test email/user ID behind.
Choosing `accept-neon-residue` means consciously accepting that possibility.

## 2. Materialize the temporary verifier

Copy the TypeScript block below verbatim to
`server/scripts/ar-2-live-verify.tmp.ts`. The `.tmp.ts` suffix is intentional:
the file is a disposable operator aid, not product code.

```typescript
import { access, readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextFunction, Request, Response } from "express";

import type { AssistantIpRateLimitLocals } from "../src/middleware/assistant-ip-rate-limit-middleware.js";

type Scenario =
  | "self-check"
  | "live"
  | "provider-error"
  | "budget-instance"
  | "budget-ip"
  | "kill-switch";

interface ApiSuccess<TData> {
  ok: true;
  data: TData;
}

interface ApiErrorResponse {
  ok: false;
  error: { code: string; message: string };
}

type ApiResponse<TData> = ApiSuccess<TData> | ApiErrorResponse;

interface AuthData {
  user: { id: string; email: string };
  token: string;
}

interface ExerciseSearchData {
  items: Array<{ id: string; name_en: string }>;
}

interface WorkoutData {
  workout: { id: string };
}

interface FaithfulnessData {
  status?: string;
  checkedNumbers?: number;
  unverifiedClaims?: string[];
}

interface AssistantOutput {
  session_id?: string;
  intent?: string;
  tool_calls?: Array<{ tool_name?: string; status?: string }>;
  faithfulness?: FaithfulnessData;
  answer?: { summary?: string };
}

type StreamEvent =
  | { type: "session"; session_id: string }
  | { type: "tool_call_started"; tool_name: string }
  | {
      type: "tool_call_finished";
      tool_name: string;
      status: "success" | "error";
    }
  | { type: "structured_output"; output: AssistantOutput }
  | { type: "done"; session_id?: string }
  | { type: "error"; code: string; message: string }
  | { type: string };

interface StreamResult {
  events: StreamEvent[];
  status: number;
  contentType: string | null;
}

interface AssistantLog {
  event?: string;
  status?: string;
  provider?: string | null;
  model?: string | null;
  llm_attempt_count?: number;
  llm_error_count?: number;
  tool_call_count?: number;
  faithfulness_status?: string;
  provider_error_fallback?: boolean;
  provider_error_code?: string | null;
  fallback_provider?: string | null;
  fallback_reason?: string | null;
  budget_fallback?: boolean;
  budget_reason?: string | null;
  budget_scope?: string | null;
  budget_ip_minute_count?: number | null;
  budget_ip_minute_limit?: number | null;
  budget_ip_day_count?: number | null;
  budget_ip_day_limit?: number | null;
}

interface CleanupPool {
  query: (
    sql: string,
    values: readonly unknown[],
  ) => Promise<{ rowCount: number | null }>;
  end: () => Promise<void>;
}

const require = createRequire(import.meta.url);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(scriptDir, "..", "..", ".env");
const expectedBaseUrl = "https://api.deepseek.com";
const expectedModel = "deepseek-chat";
const password = "Passw0rd!";

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
    if (line.length === 0 || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function parseScenario(value: string | undefined): Scenario {
  const allowed: Scenario[] = [
    "self-check",
    "live",
    "provider-error",
    "budget-instance",
    "budget-ip",
    "kill-switch",
  ];
  assert(
    value !== undefined && allowed.includes(value as Scenario),
    `Scenario must be one of: ${allowed.join(", ")}.`,
  );
  return value as Scenario;
}

function validateProviderConfiguration(): void {
  assert(
    process.env.OPENAI_COMPAT_BASE_URL === expectedBaseUrl,
    `OPENAI_COMPAT_BASE_URL must equal ${expectedBaseUrl}.`,
  );
  assert(
    process.env.OPENAI_COMPAT_MODEL === expectedModel,
    `OPENAI_COMPAT_MODEL must equal ${expectedModel}.`,
  );
  assert(
    typeof process.env.OPENAI_COMPAT_API_KEY === "string" &&
      process.env.OPENAI_COMPAT_API_KEY.trim().length > 0,
    "OPENAI_COMPAT_API_KEY must be present in .env.",
  );
}

function validateDatabaseTarget(): void {
  const rawUrl = process.env.DATABASE_URL;
  assert(rawUrl, "DATABASE_URL must be present in .env.");

  const target = process.env.AR2_DB_TARGET;
  assert(
    target === "local" ||
      target === "scratch" ||
      target === "accept-neon-residue",
    "Set AR2_DB_TARGET to local, scratch, or accept-neon-residue.",
  );

  const parsed = new URL(rawUrl);
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  const isLoopback = loopbackHosts.has(parsed.hostname.toLowerCase());
  if (target === "local") {
    assert(
      isLoopback,
      "AR2_DB_TARGET=local refuses a remote DATABASE_URL. Choose a scratch DB or explicitly accept Neon residue.",
    );
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
  console.log(
    `Database target acknowledged: mode=${target}, host=${parsed.hostname}, database=${databaseName || "(default)"}.`,
  );
}

function applyScenarioOverrides(scenario: Scenario): void {
  process.env.ASSISTANT_PROVIDER = "openai_compatible";
  process.env.ASSISTANT_PHRASING = "off";
  delete process.env.ASSISTANT_REAL_PROVIDER_KILL_SWITCH;
  delete process.env.ASSISTANT_REAL_PROVIDER_DAILY_CALL_BUDGET;

  if (scenario === "provider-error") {
    process.env.OPENAI_COMPAT_API_KEY = "ar2-intentionally-invalid-key";
  }
  if (scenario === "budget-instance") {
    process.env.ASSISTANT_REAL_PROVIDER_DAILY_CALL_BUDGET = "1";
  }
  if (scenario === "kill-switch") {
    process.env.ASSISTANT_REAL_PROVIDER_KILL_SWITCH = "true";
  }
}

function captureAssistantLogs(): {
  logs: AssistantLog[];
  restore: () => void;
} {
  const logs: AssistantLog[] = [];
  const originalInfo = console.info;

  console.info = (message?: unknown, ...optional: unknown[]): void => {
    if (typeof message === "string") {
      try {
        const parsed = JSON.parse(message) as AssistantLog;
        if (parsed.event === "assistant_turn") logs.push(parsed);
      } catch {
        // Ignore non-JSON informational logs.
      }
    }
    originalInfo(message, ...optional);
  };

  return {
    logs,
    restore: () => {
      console.info = originalInfo;
    },
  };
}

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  const { createApp } = await import("../src/app.js");
  const server = createServer(createApp());

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectPromise);
      resolvePromise();
    });
  });

  const address = server.address();
  assert(address !== null && typeof address !== "string", "Expected a port.");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolvePromise) =>
    server.close(() => resolvePromise()),
  );
}

async function requestJson<TData>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: ApiResponse<TData> }> {
  const response = await fetch(`${baseUrl}${path}`, init);
  return {
    status: response.status,
    body: (await response.json()) as ApiResponse<TData>,
  };
}

function expectSuccess<TData>(
  response: { status: number; body: ApiResponse<TData> },
  status: number,
  label: string,
): TData {
  assert(response.status === status, `${label} returned ${response.status}.`);
  assert(response.body.ok, `${label} returned an API error.`);
  return response.body.data;
}

function authHeaders(token: string): HeadersInit {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

async function register(baseUrl: string, email: string): Promise<AuthData> {
  return expectSuccess(
    await requestJson<AuthData>(baseUrl, "/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        display_name: "AR-2 Local Live Verification",
      }),
    }),
    201,
    "register",
  );
}

async function findBench(baseUrl: string): Promise<string> {
  const data = expectSuccess(
    await requestJson<ExerciseSearchData>(baseUrl, "/api/exercises?q=bench"),
    200,
    "exercise search",
  );
  const exercise = data.items[0];
  assert(exercise, "Expected a bench exercise in the dictionary.");
  return exercise.id;
}

async function createWorkout(
  baseUrl: string,
  token: string,
  exerciseId: string,
  performedAt: string,
  weightKg: number,
): Promise<string> {
  const data = expectSuccess(
    await requestJson<WorkoutData>(baseUrl, "/api/workouts", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        performed_at: performedAt,
        duration_minutes: 45,
        notes: "AR-2 local live verification",
        sets: [
          {
            exercise_id: exerciseId,
            set_index: 1,
            reps: 5,
            weight_kg: weightKg,
            rpe: 8,
            is_warmup: false,
            notes: "AR-2 verification set",
          },
        ],
      }),
    }),
    201,
    "create workout",
  );
  return data.workout.id;
}

function parseSse(text: string): StreamEvent[] {
  return text
    .split("\n\n")
    .map((frame) => frame.trim())
    .filter(Boolean)
    .map((frame) => {
      const eventType = frame
        .split("\n")
        .find((line) => line.startsWith("event: "))
        ?.slice("event: ".length);
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice("data: ".length))
        .join("\n");
      assert(eventType && data, "Malformed SSE frame.");
      const parsed = JSON.parse(data) as StreamEvent;
      assert(parsed.type === eventType, "SSE event/data type mismatch.");
      return parsed;
    });
}

async function requestStream(
  baseUrl: string,
  token: string,
  body: Record<string, unknown>,
): Promise<StreamResult> {
  const response = await fetch(`${baseUrl}/api/assistant/stream-turn`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    events: response.ok ? parseSse(text) : [],
  };
}

function assertSuccessfulStream(
  result: StreamResult,
  label: string,
): AssistantOutput {
  assert(result.status === 200, `${label} must return 200.`);
  assert(
    result.contentType?.includes("text/event-stream"),
    `${label} must return SSE.`,
  );
  assert(
    !result.events.some((event) => event.type === "error"),
    `${label} emitted error.`,
  );
  assert(result.events.at(-1)?.type === "done", `${label} must end with done.`);
  const structured = result.events.find(
    (event): event is Extract<StreamEvent, { type: "structured_output" }> =>
      event.type === "structured_output",
  );
  assert(structured, `${label} must emit structured_output.`);
  return structured.output;
}

function assertFaithfulness(output: AssistantOutput, label: string): void {
  assert(
    output.faithfulness?.status === "verified",
    `${label} faithfulness was not verified.`,
  );
  assert(
    (output.faithfulness.checkedNumbers ?? 0) > 0,
    `${label} did not check any answer numbers.`,
  );
  assert(
    (output.faithfulness.unverifiedClaims?.length ?? 0) === 0,
    `${label} contained unverified numeric claims.`,
  );
}

async function deleteWorkout(
  baseUrl: string,
  token: string,
  id: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/workouts/${id}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
  assert(response.ok, `Cleanup failed for workout ${id}.`);
}

async function deleteDisposableUser(
  userId: string,
  email: string,
): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  assert(connectionString, "DATABASE_URL disappeared before cleanup.");
  const { Pool } = require("pg") as {
    Pool: new (input: { connectionString: string }) => CleanupPool;
  };
  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 AND email = $2",
      [userId, email],
    );
    assert(
      result.rowCount === 1,
      "Disposable user cleanup did not delete exactly one row.",
    );
  } finally {
    await pool.end();
  }
}

function latestLog(logs: AssistantLog[]): AssistantLog {
  const log = logs.at(-1);
  assert(log, "Expected an assistant_turn log.");
  return log;
}

function assertLiveLog(log: AssistantLog): void {
  assert(log.status === "ok", "Live turn log must be ok.");
  assert(
    log.provider === "openai_compatible",
    "Live provider must be openai_compatible.",
  );
  assert(log.model === expectedModel, "Live model must be deepseek-chat.");
  assert(
    (log.llm_attempt_count ?? 0) > 0,
    "Live turn must attempt the provider.",
  );
  assert(log.llm_error_count === 0, "Live turn must not have provider errors.");
  assert(
    log.provider_error_fallback === false,
    "Live turn unexpectedly used AR-0 fallback.",
  );
  assert(
    log.budget_fallback === false,
    "Live turn unexpectedly used budget fallback.",
  );
  assert((log.tool_call_count ?? 0) > 0, "Live turn must execute a tool.");
  assert(
    log.faithfulness_status === "verified",
    "Live log faithfulness must be verified.",
  );
}

async function createFixture(baseUrl: string): Promise<{
  auth: AuthData;
  email: string;
  exerciseId: string;
  workoutIds: string[];
}> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `ar2-live-${suffix}@example.com`;
  const auth = await register(baseUrl, email);
  const exerciseId = await findBench(baseUrl);
  const workoutIds = [
    await createWorkout(
      baseUrl,
      auth.token,
      exerciseId,
      "2026-07-01T09:00:00Z",
      80,
    ),
    await createWorkout(
      baseUrl,
      auth.token,
      exerciseId,
      "2026-07-08T09:00:00Z",
      82.5,
    ),
  ];
  console.log(
    `Disposable test identity: email=${email}, user_id=${auth.user.id}.`,
  );
  return { auth, email, exerciseId, workoutIds };
}

async function runHttpScenario(
  scenario: Exclude<Scenario, "self-check" | "budget-ip">,
  baseUrl: string,
  fixture: Awaited<ReturnType<typeof createFixture>>,
  logs: AssistantLog[],
): Promise<void> {
  const first = await requestStream(baseUrl, fixture.auth.token, {
    mode: "exercise_progress",
    message: "请分析我最近两次卧推训练的进展，并用训练数据说明。",
    start_date: "2026-07-01",
    end_date: "2026-07-15",
    exercise_id: fixture.exerciseId,
  });
  const firstOutput = assertSuccessfulStream(first, `${scenario} first turn`);
  const firstSession = first.events.find(
    (event): event is Extract<StreamEvent, { type: "session" }> =>
      event.type === "session",
  );
  assert(firstSession, "First turn must emit a session id.");

  if (scenario === "live") {
    assert(
      first.events.some(
        (event) =>
          event.type === "tool_call_finished" &&
          "status" in event &&
          event.status === "success",
      ),
      "Live turn must finish at least one tool successfully.",
    );
    assertFaithfulness(firstOutput, "live first turn");
    assertLiveLog(latestLog(logs));

    const second = await requestStream(baseUrl, fixture.auth.token, {
      mode: "training_overview",
      session_id: firstSession.session_id,
      message: "结合刚才的卧推数据，再总结一下这段时间训练时最该关注什么。",
      start_date: "2026-07-01",
      end_date: "2026-07-15",
      exercise_id: fixture.exerciseId,
    });
    assertSuccessfulStream(second, "live second turn");
    const secondSession = second.events.find(
      (event): event is Extract<StreamEvent, { type: "session" }> =>
        event.type === "session",
    );
    assert(
      secondSession?.session_id === firstSession.session_id,
      "Second turn must reuse session_id.",
    );
    assertLiveLog(latestLog(logs));
    return;
  }

  assertFaithfulness(firstOutput, `${scenario} first turn`);
  let log = latestLog(logs);
  if (scenario === "budget-instance" && log.budget_fallback !== true) {
    const second = await requestStream(baseUrl, fixture.auth.token, {
      mode: "exercise_progress",
      session_id: firstSession.session_id,
      message: "请再次核对卧推训练进展；这轮应由预算护栏安全降级。",
      start_date: "2026-07-01",
      end_date: "2026-07-15",
      exercise_id: fixture.exerciseId,
    });
    const secondOutput = assertSuccessfulStream(
      second,
      "budget-instance second turn",
    );
    assertFaithfulness(secondOutput, "budget-instance second turn");
    log = latestLog(logs);
  }

  if (scenario === "provider-error") {
    assert(
      log.provider_error_fallback === true,
      "Broken key must set provider_error_fallback.",
    );
    assert(
      Boolean(log.provider_error_code),
      "Broken key must preserve provider_error_code.",
    );
    assert(
      log.fallback_provider === "mock",
      "Broken key must fall back to mock.",
    );
    assert(
      log.fallback_reason === "provider_error",
      "Broken key fallback reason mismatch.",
    );
  } else if (scenario === "budget-instance") {
    assert(
      log.budget_fallback === true,
      "Call budget must trigger budget_fallback.",
    );
    assert(
      log.budget_reason === "daily_call_budget_exceeded",
      "Call budget reason mismatch.",
    );
    assert(
      log.budget_scope === "instance",
      "Call budget scope must be instance.",
    );
    assert(
      logs.reduce((total, item) => total + (item.llm_attempt_count ?? 0), 0) <=
        1,
      "Budget scenario must allow at most one provider call.",
    );
  } else {
    assert(
      log.budget_fallback === true,
      "Kill-switch must trigger budget_fallback.",
    );
    assert(log.budget_reason === "kill_switch", "Kill-switch reason mismatch.");
    assert(
      log.budget_scope === "instance",
      "Kill-switch scope must be instance.",
    );
    assert(
      log.llm_attempt_count === 0,
      "Kill-switch must prevent all provider calls.",
    );
  }
}

async function runIpBudgetScenario(
  fixture: Awaited<ReturnType<typeof createFixture>>,
): Promise<void> {
  const [
    limiterModule,
    middlewareModule,
    orchestratorModule,
    observabilityModule,
  ] = await Promise.all([
    import("../src/services/assistant/ai-rate-limiter.js"),
    import("../src/middleware/assistant-ip-rate-limit-middleware.js"),
    import("../src/services/assistant/assistant-orchestrator-service.js"),
    import("../src/services/assistant/assistant-turn-observability.js"),
  ]);
  const middleware = middlewareModule.createAssistantIpRateLimitMiddleware({
    limiter: limiterModule.createAiRateLimiter({ perMinute: 1, perDay: 1 }),
    getProvider: () => "openai_compatible",
  });
  const consume = () => {
    const request = { ip: "127.0.0.1" } as Request;
    const response = { locals: { userId: fixture.auth.user.id } } as Response<
      unknown,
      AssistantIpRateLimitLocals
    >;
    let nextCalls = 0;
    middleware(request, response, (() => {
      nextCalls += 1;
    }) as NextFunction);
    assert(
      nextCalls === 1,
      "Injected IP middleware must continue exactly once.",
    );
    return response.locals.assistantIpGuardDecision;
  };

  assert(consume()?.kind === "allow", "First injected IP decision must allow.");
  const denied = consume();
  assert(denied?.kind === "fallback", "Second injected IP decision must deny.");

  const events: StreamEvent[] = [];
  const startedAt = Date.now();
  const result = await orchestratorModule.runMockAssistantTurn(
    fixture.auth.user.id,
    {
      mode: "exercise_progress",
      message: "请分析我最近两次卧推训练的进展。",
      start_date: "2026-07-01",
      end_date: "2026-07-15",
      exercise_id: fixture.exerciseId,
    },
    {
      assistantIpGuardDecision: denied,
      onEvent: (event) => {
        events.push(event);
      },
    },
  );
  assert(
    events.at(-1)?.type === "done",
    "IP budget fallback must end with done.",
  );
  assert(
    !events.some((event) => event.type === "error"),
    "IP budget fallback must not error.",
  );

  const event = observabilityModule.buildAssistantTurnLogEvent({
    intent: result.response.intent,
    durationMs: Date.now() - startedAt,
    toolCalls: result.response.tool_calls,
    agentStepCount: result.response.agent_trace?.steps.length ?? null,
    faithfulness: result.response.faithfulness ?? null,
    hasPlan: result.response.plan !== undefined,
    llm: result.telemetry.llm ?? null,
    providerErrorFallback: result.telemetry.providerErrorFallback ?? null,
    budgetFallback: result.telemetry.budgetFallback ?? null,
    safety: result.telemetry.safety ?? null,
  });
  assert(event.budget_fallback === true, "IP path must set budget_fallback.");
  assert(event.budget_scope === "ip", "IP path must report budget_scope=ip.");
  assert(event.budget_ip_minute_count === 1, "IP minute count mismatch.");
  assert(event.budget_ip_minute_limit === 1, "IP minute limit mismatch.");
  assert(event.budget_ip_day_count === 1, "IP day count mismatch.");
  assert(event.budget_ip_day_limit === 1, "IP day limit mismatch.");
  assert(
    event.llm_attempt_count === 0,
    "Denied IP turn must make zero provider calls.",
  );
}

async function main(): Promise<void> {
  const scenario = parseScenario(process.argv[2]);
  await loadEnvFile(envPath);
  validateProviderConfiguration();

  if (scenario === "self-check") {
    console.log(
      "AR-2 verifier self-check passed; no DB or provider call was made.",
    );
    return;
  }

  validateDatabaseTarget();
  applyScenarioOverrides(scenario);
  const captured = captureAssistantLogs();
  const { server, baseUrl } = await startServer();
  let fixture: Awaited<ReturnType<typeof createFixture>> | null = null;

  try {
    fixture = await createFixture(baseUrl);
    if (scenario === "budget-ip") {
      await runIpBudgetScenario(fixture);
    } else {
      await runHttpScenario(scenario, baseUrl, fixture, captured.logs);
    }
    console.log(`AR-2 ${scenario} verification passed.`);
  } finally {
    const cleanupErrors: string[] = [];
    if (fixture) {
      for (const id of fixture.workoutIds) {
        try {
          await deleteWorkout(baseUrl, fixture.auth.token, id);
        } catch (error) {
          cleanupErrors.push(
            error instanceof Error ? error.message : String(error),
          );
        }
      }
      try {
        await deleteDisposableUser(fixture.auth.user.id, fixture.email);
      } catch (error) {
        cleanupErrors.push(
          error instanceof Error ? error.message : String(error),
        );
      }
      if (cleanupErrors.length > 0) {
        console.error(
          `BEST-EFFORT CLEANUP INCOMPLETE: email=${fixture.email}, user_id=${fixture.auth.user.id}.`,
        );
        console.error(
          "Possible residue: user, workouts/sets, chat sessions/messages, tool logs.",
        );
        console.error(cleanupErrors.join(" | "));
      }
    }
    await stopServer(server);
    captured.restore();
  }
}

void main().catch((error: unknown) => {
  console.error(
    `AR-2 verifier failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
```

## 3. Run local scenarios

First run the zero-network self-check. It validates the script and the three
DeepSeek configuration fields without connecting to the database or provider:

```powershell
pnpm --filter @fitmind/server exec tsx scripts/ar-2-live-verify.tmp.ts self-check
```

Then choose and acknowledge the database target. Run every scenario as a
separate command/process:

```powershell
$env:AR2_DB_TARGET = "local" # or scratch / accept-neon-residue

# Two real Chinese turns. This creates a small, real DeepSeek charge.
pnpm --filter @fitmind/server exec tsx scripts/ar-2-live-verify.tmp.ts live

# Invalid key exists only inside this process; .env remains untouched.
pnpm --filter @fitmind/server exec tsx scripts/ar-2-live-verify.tmp.ts provider-error

# At most one real DeepSeek attempt, then instance call-budget fallback.
pnpm --filter @fitmind/server exec tsx scripts/ar-2-live-verify.tmp.ts budget-instance

# Injected 1/day limiter; no 31-request burst and no provider call on denial.
pnpm --filter @fitmind/server exec tsx scripts/ar-2-live-verify.tmp.ts budget-ip

# Emergency-stop path; zero provider calls.
pnpm --filter @fitmind/server exec tsx scripts/ar-2-live-verify.tmp.ts kill-switch
```

`live` and `budget-instance` make real paid DeepSeek calls (small at this test
size). `provider-error` should be rejected before billable completion;
`budget-ip` and `kill-switch` make no provider call on the denied turn.

For the broken-key scenario, also open the local client and submit the same
exercise-progress prompt. Confirm the UI does not blank, the answer completes,
and the Network response ends with SSE `done` rather than `error`.

Faithfulness here is the shipped D21 numeric/reference gate. A verified result
means answer numbers and IDs were found in tool output; it does not prove that
every non-numeric qualitative statement is true.

After verification:

```powershell
Remove-Item -LiteralPath server/scripts/ar-2-live-verify.tmp.ts
Remove-Item Env:AR2_DB_TARGET -ErrorAction SilentlyContinue
git status --short
```

The temporary script must not appear in the commit.

## 4. User-operated Vercel flip

Only after the local scenarios pass, set these variables in the Vercel
**Production** environment. The key value is entered only in the Vercel UI:

```text
ASSISTANT_PROVIDER=openai_compatible
OPENAI_COMPAT_BASE_URL=https://api.deepseek.com
OPENAI_COMPAT_MODEL=deepseek-chat
OPENAI_COMPAT_API_KEY=<SET_IN_VERCEL_DASHBOARD_DO_NOT_COMMIT>
```

Recommended guard configuration:

| Variable | Recommended production value | Shipped default / behavior |
| --- | --- | --- |
| `ASSISTANT_REAL_PROVIDER_KILL_SWITCH` | unset for live | Unset or explicit false is live-eligible. `1/true/on/yes` and malformed values force deterministic fallback. |
| `ASSISTANT_REAL_PROVIDER_DAILY_CALL_BUDGET` | `500` | Missing or malformed values use 500 calls per warm instance per UTC day. |
| `ASSISTANT_REAL_PROVIDER_DAILY_COST_BUDGET_USD` | `1.00` | Missing or malformed values use $1.00 known estimated cost per warm instance per UTC day. |
| `ASSISTANT_PHRASING` | unset / `off` | Off avoids an optional extra provider call. |

Provider, budget, and kill-switch values are read when the process starts. **Any
change requires a Vercel redeploy to take effect.** Do not change
`WORKOUT_INTAKE_LLM_PROVIDER` as part of AR-2.

`deepseek-chat` currently has no entry in FitMind's local pricing table, so
`estimated_cost_usd` can be `null`. In that case the cost counter does not
advance; the per-instance call budget and per-IP limits remain the hard floor.

### Online smoke after the user flips the default

1. Redeploy the reviewed revision after setting the Production variables.
2. Register or log in and confirm refresh retains the HttpOnly cookie session.
3. Add at least one training record, then ask for a training summary or exercise
   progress answer.
4. Confirm a real answer, a successful tool call, evidence, and a verified
   faithfulness marker.
5. Find the `assistant_turn` JSON line in Vercel server logs and confirm:
   - `provider:"openai_compatible"`, `model:"deepseek-chat"`;
   - `llm_attempt_count > 0`, `llm_error_count:0`;
   - `provider_error_fallback:false`;
   - expected `budget_fallback`/`budget_scope` values and counters.

Do not mark AR-2 live from a plausible-looking answer alone: AR-0 deliberately
makes a broken provider look usable through deterministic fallback, so the log
fields are required evidence.

### Emergency rollback

Both rollback paths require a redeploy:

1. Set `ASSISTANT_PROVIDER=mock` to return to the deterministic default; or
2. set `ASSISTANT_REAL_PROVIDER_KILL_SWITCH=true` to preserve DeepSeek config
   while preventing new real-provider calls.

After the redeploy, submit one assistant turn. Mock mode should show no real LLM
attempt. Kill-switch mode should show `budget_fallback:true`,
`budget_reason:"kill_switch"`, `budget_scope:"instance"`, and
`llm_attempt_count:0`.

## 5. Cost and abuse boundary

Once flipped, every visitor can cause real paid calls, and one user turn can
reach routing, tool selection, and optional phrasing call sites. Keeping
phrasing off reduces that surface.

D49's limits are partial, per-instance serverless protection. Multiple Vercel
instances each have their own counters, NAT users can share an IP bucket, and a
distributed attacker can spread across IPs. These guards reduce risk; they are
not a global billing cap or distributed abuse-control system.
