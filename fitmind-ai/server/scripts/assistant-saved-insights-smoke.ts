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

interface AssistantMockTurnData {
  session_id: string;
  message_id?: string;
  intent: string;
  answer: {
    summary: string;
    evidence: {
      workout_ids: string[];
      set_ids: string[];
      tool_names: string[];
    };
    sources?: Array<{
      title: string;
    }>;
    limitations?: string[];
  };
}

interface AssistantSavedInsightData {
  id: string;
  message_id: string | null;
  insight_type: "weekly_report" | "plateau_diagnosis" | "next_week_plan";
  title: string;
  summary: string;
  share_text: string;
}

interface AssistantSavedInsightListData {
  items: AssistantSavedInsightData[];
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

async function createAssistantTurn(
  baseUrl: string,
  token: string,
  input: {
    message: string;
    mode: string;
  },
): Promise<AssistantMockTurnData> {
  const response = await requestJson<AssistantMockTurnData>(
    baseUrl,
    "/api/assistant/mock-turn",
    {
      method: "POST",
      headers: createAuthHeaders(token),
      body: JSON.stringify({
        mode: input.mode,
        message: input.message,
        start_date: "2026-06-01",
        end_date: "2026-06-07",
      }),
    },
  );

  const data = expectSuccess(
    response,
    200,
    `POST /api/assistant/mock-turn ${input.mode}`,
  );
  assert(data.message_id, `${input.mode} turn should return message_id.`);

  return data;
}

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(scriptDir, "..", ".env.local");
  await loadEnvFile(envPath);

  assert(
    typeof process.env.DATABASE_URL === "string" &&
      process.env.DATABASE_URL.length > 0,
    "DATABASE_URL is required for assistant saved insights smoke.",
  );

  if (
    typeof process.env.JWT_SECRET !== "string" ||
    process.env.JWT_SECRET.length === 0
  ) {
    process.env.JWT_SECRET = SMOKE_JWT_SECRET;
  }

  const { server, baseUrl } = await startServer();
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const primaryAuth = await registerUser(
      baseUrl,
      `assistant-saved-insights-${uniqueSuffix}@example.com`,
      "Assistant Saved Insights Smoke",
    );
    const secondaryAuth = await registerUser(
      baseUrl,
      `assistant-saved-insights-other-${uniqueSuffix}@example.com`,
      "Assistant Saved Insights Other",
    );

    const weeklyReport = await createAssistantTurn(
      baseUrl,
      primaryAuth.token,
      {
        mode: "weekly_report",
        message: "Build my weekly training report",
      },
    );
    const unsupported = await createAssistantTurn(baseUrl, primaryAuth.token, {
      mode: "unsupported",
      message: "Tell me a joke",
    });

    const saved = expectSuccess(
      await requestJson<AssistantSavedInsightData>(
        baseUrl,
        "/api/assistant/insights",
        {
          method: "POST",
          headers: createAuthHeaders(primaryAuth.token),
          body: JSON.stringify({
            message_id: weeklyReport.message_id,
          }),
        },
      ),
      201,
      "POST /api/assistant/insights weekly_report",
    );
    assert(saved.insight_type === "weekly_report", "Saved type should match.");
    assert(
      saved.share_text.includes("Type: weekly_report") &&
        saved.share_text.includes("Evidence:") &&
        saved.share_text.includes("Sources:") &&
        saved.share_text.includes("Limitations:"),
      "Saved insight share_text should include type, evidence, sources, and limitations.",
    );

    const list = expectSuccess(
      await requestJson<AssistantSavedInsightListData>(
        baseUrl,
        "/api/assistant/insights",
        {
          headers: {
            authorization: `Bearer ${primaryAuth.token}`,
          },
        },
      ),
      200,
      "GET /api/assistant/insights",
    );
    assert(
      list.items.some((item) => item.id === saved.id),
      "Saved insight list should include created item.",
    );

    const detail = expectSuccess(
      await requestJson<AssistantSavedInsightData>(
        baseUrl,
        `/api/assistant/insights/${saved.id}`,
        {
          headers: {
            authorization: `Bearer ${primaryAuth.token}`,
          },
        },
      ),
      200,
      "GET /api/assistant/insights/:id",
    );
    assert(detail.share_text === saved.share_text, "Detail should keep share text.");

    expectError(
      await requestJson<unknown>(baseUrl, "/api/assistant/insights", {
        method: "POST",
        headers: createAuthHeaders(primaryAuth.token),
        body: JSON.stringify({
          message_id: unsupported.message_id,
        }),
      }),
      400,
      "VALIDATION_ERROR",
      "POST /api/assistant/insights unsupported",
    );

    expectError(
      await requestJson<unknown>(baseUrl, "/api/assistant/insights", {
        method: "POST",
        headers: createAuthHeaders(secondaryAuth.token),
        body: JSON.stringify({
          message_id: weeklyReport.message_id,
        }),
      }),
      403,
      "FORBIDDEN",
      "POST /api/assistant/insights cross-user message",
    );

    expectSuccess(
      await requestJson<DeleteResponseData>(
        baseUrl,
        `/api/assistant/insights/${saved.id}`,
        {
          method: "DELETE",
          headers: {
            authorization: `Bearer ${primaryAuth.token}`,
          },
        },
      ),
      200,
      "DELETE /api/assistant/insights/:id",
    );

    expectError(
      await requestJson<unknown>(
        baseUrl,
        `/api/assistant/insights/${saved.id}`,
        {
          headers: {
            authorization: `Bearer ${primaryAuth.token}`,
          },
        },
      ),
      404,
      "NOT_FOUND",
      "GET /api/assistant/insights/:id deleted",
    );

    console.log("Assistant saved insights smoke passed.");
  } finally {
    await stopServer(server);
  }
}

void main().catch((error: unknown) => {
  console.error("Assistant saved insights smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
