import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { poolEnd, poolQuery, sessionState, verifyJwt } = vi.hoisted(() => ({
  poolEnd: vi.fn(async () => undefined),
  poolQuery: vi.fn(),
  sessionState: { globalExists: false },
  verifyJwt: vi.fn(async () => ({ userId: "user-1" })),
}));

vi.mock("./services/auth/jwt.js", () => ({ verifyJwt }));

vi.mock("./services/auth/consent-service.js", async (importOriginal) => ({
  ...(await importOriginal()),
  getPendingConsents: vi.fn(async () => []),
}));

vi.mock("./db/pool.js", () => ({
  createDbPool: () => ({
    connect: vi.fn(),
    end: poolEnd,
    query: poolQuery,
  }),
}));

vi.mock("./services/assistant/provider-adapter.js", () => ({
  runAssistantProvider: vi.fn(),
  runAssistantAnswerPhrasing: vi.fn(),
}));

vi.mock("./services/assistant/provider-config.js", () => ({
  getConfiguredAssistantProvider: vi.fn(() => "mock"),
  isAssistantAnswerPhrasingEnabled: vi.fn(() => false),
}));

vi.mock("./services/ai/tools/tool-executor.js", () => ({
  executeAiTool: vi.fn(),
}));

vi.mock("./services/training/dictionary-service.js", () => ({
  searchDictionaryExercises: vi.fn(),
}));

import { createApp } from "./app.js";
import { createAiRateLimiter } from "./services/assistant/ai-rate-limiter.js";

const SESSION_ID = "77777777-7777-4777-8777-777777777777";

function configureSessionQueries(globalExists: boolean): void {
  sessionState.globalExists = globalExists;
  poolQuery.mockImplementation(async (sql: string) => {
    if (/WHERE id = \$1 AND user_id = \$2/u.test(sql)) {
      return { rows: [] };
    }

    if (/FROM chat_sessions[\s\S]*WHERE id = \$1/u.test(sql)) {
      return {
        rows: sessionState.globalExists ? [{ id: SESSION_ID }] : [],
      };
    }

    throw new Error(`Unexpected SQL in session HTTP test: ${sql}`);
  });
}

describe("assistant session ownership HTTP boundary", () => {
  const app = createApp({
    authRateLimiter: createAiRateLimiter({
      perMinute: 1_000,
      perDay: 100_000,
      now: () => 0,
    }),
    requestCompletionLogger: () => undefined,
  });
  const server = app.listen(0);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  async function requestTurn(globalExists: boolean): Promise<{
    status: number;
    body: unknown;
  }> {
    configureSessionQueries(globalExists);
    const address = server.address();

    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port.");
    }

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/assistant/mock-turn`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer test-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          mode: "unsupported",
          session_id: SESSION_ID,
          message: "out of scope",
          start_date: "2026-05-19",
          end_date: "2026-06-17",
        }),
      },
    );

    return { status: response.status, body: await response.json() };
  }

  it("makes foreign and absent session ids HTTP-indistinguishable", async () => {
    const foreign = await requestTurn(true);
    const absent = await requestTurn(false);

    expect(foreign).toEqual({
      status: 404,
      body: {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Chat session was not found.",
        },
      },
    });
    expect(absent).toEqual(foreign);
    expect(verifyJwt).toHaveBeenCalledTimes(2);
    expect(poolQuery).toHaveBeenCalledTimes(2);
    expect(
      poolQuery.mock.calls.every(([sql]) =>
        typeof sql === "string" ? sql.includes("user_id = $2") : false,
      ),
    ).toBe(true);
  });
});
