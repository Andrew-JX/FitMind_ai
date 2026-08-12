import { beforeEach, describe, expect, it, vi } from "vitest";

const { poolEnd, poolQuery, sessionState } = vi.hoisted(() => ({
  poolEnd: vi.fn(async () => undefined),
  poolQuery: vi.fn(),
  sessionState: { globalExists: false },
}));

vi.mock("../../db/pool.js", () => ({
  createDbPool: () => ({
    connect: vi.fn(),
    end: poolEnd,
    query: poolQuery,
  }),
}));

vi.mock("./provider-adapter.js", () => ({
  runAssistantProvider: vi.fn(),
  runAssistantAnswerPhrasing: vi.fn(),
}));

vi.mock("../ai/tools/tool-executor.js", () => ({
  executeAiTool: vi.fn(),
}));

vi.mock("../training/dictionary-service.js", () => ({
  searchDictionaryExercises: vi.fn(),
}));

import { runMockAssistantTurn } from "./assistant-orchestrator-service.js";
import { isHttpError } from "../../utils/http-error.js";

const USER_ID = "user-1";
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

    throw new Error(`Unexpected SQL in session access test: ${sql}`);
  });
}

async function captureSessionError(): Promise<{
  statusCode: number;
  code: string;
  message: string;
}> {
  try {
    await runMockAssistantTurn(USER_ID, {
      mode: "unsupported",
      session_id: SESSION_ID,
      message: "out of scope",
      start_date: "2026-05-19",
      end_date: "2026-06-17",
    });
  } catch (error) {
    if (isHttpError(error)) {
      return {
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
      };
    }

    throw error;
  }

  throw new Error("Expected the assistant turn to reject the session id.");
}

describe("assistant session ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["foreign", true],
    ["absent", false],
  ] as const)(
    "returns the same safe 404 for a %s session without a global probe",
    async (_label, globalExists) => {
      configureSessionQueries(globalExists);

      await expect(captureSessionError()).resolves.toEqual({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Chat session was not found.",
      });
      expect(poolQuery).toHaveBeenCalledTimes(1);
      expect(poolQuery).toHaveBeenCalledWith(
        expect.stringContaining("user_id = $2"),
        [SESSION_ID, USER_ID],
      );
    },
  );
});
