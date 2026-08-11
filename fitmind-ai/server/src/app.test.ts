import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./services/auth/jwt.js", () => ({
  verifyJwt: vi.fn(),
}));

vi.mock("./services/training/workout-service.js", () => ({
  addUserWorkoutSet: vi.fn(),
  createUserWorkout: vi.fn(),
  deleteUserWorkout: vi.fn(),
  deleteUserWorkoutSet: vi.fn(),
  getUserWorkout: vi.fn(),
  listUserWorkouts: vi.fn(),
  updateUserWorkout: vi.fn(),
  updateUserWorkoutSet: vi.fn(),
}));

vi.mock("./services/product-feedback-service.js", () => ({
  submitProductFeedback: vi.fn(),
}));

import { createApp, normalizeRequestPathForLog } from "./app.js";
import { createAiRateLimiter } from "./services/assistant/ai-rate-limiter.js";
import { verifyJwt } from "./services/auth/jwt.js";
import { submitProductFeedback } from "./services/product-feedback-service.js";
import { HttpError } from "./utils/http-error.js";

const mockedVerifyJwt = vi.mocked(verifyJwt);
const mockedSubmitProductFeedback = vi.mocked(submitProductFeedback);

describe("createApp", () => {
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

  async function request(path: string, init?: RequestInit) {
    const address = server.address();

    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    return fetch(`http://127.0.0.1:${address.port}${path}`, init);
  }

  it("serves the health endpoint", async () => {
    const response = await request("/api/health");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      data: {
        status: "ok",
      },
    });
  });

  it("trusts one proxy hop for Vercel client IP resolution", () => {
    expect(app.get("trust proxy")).toBe(1);
  });

  it("normalizes health dates and record ids before logging request paths", () => {
    expect(
      normalizeRequestPathForLog(
        "/api/menstrual-records/2026-08-10/body/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ),
    ).toBe("/api/menstrual-records/:date/body/:id");
  });

  it("logs privacy-safe completion events for 2xx, 4xx, and 5xx responses", async () => {
    const entries: unknown[] = [];
    const times = [100, 125, 200, 240, 300, 355, 400, 410];
    const loggingApp = createApp({
      authRateLimiter: createAiRateLimiter({
        perMinute: 1_000,
        perDay: 100_000,
        now: () => 0,
      }),
      now: () => times.shift() ?? 355,
      requestCompletionLogger: (entry) => entries.push(entry),
      unknownErrorLogger: () => undefined,
    });
    const loggingServer = loggingApp.listen(0);

    try {
      const address = loggingServer.address();

      if (address === null || typeof address === "string") {
        throw new Error("Expected the test server to bind to a TCP port");
      }

      const origin = `http://127.0.0.1:${address.port}`;
      await fetch(`${origin}/api/health?token=must-not-appear`);
      await fetch(`${origin}/api/auth/me`, {
        headers: {
          authorization: "Token must-not-appear",
          cookie: "session=must-not-appear",
        },
      });
      await fetch(`${origin}/api/auth/login?password=must-not-appear`, {
        body: '{"password":"must-not-appear"',
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      await fetch(`${origin}/api/must-not-appear`);

      expect(entries).toEqual([
        {
          event: "http_request_completed",
          method: "GET",
          path: "/api/health",
          status: 200,
          duration_ms: 25,
        },
        {
          event: "http_request_completed",
          method: "GET",
          path: "/api/auth/me",
          status: 401,
          duration_ms: 40,
        },
        {
          event: "http_request_completed",
          method: "POST",
          path: "/api/:unmatched",
          status: 500,
          duration_ms: 55,
        },
        {
          event: "http_request_completed",
          method: "GET",
          path: "/api/:unmatched",
          status: 404,
          duration_ms: 10,
        },
      ]);
      expect(JSON.stringify(entries)).not.toContain("must-not-appear");
      expect(JSON.stringify(entries)).not.toContain("authorization");
      expect(JSON.stringify(entries)).not.toContain("cookie");
      expect(JSON.stringify(entries)).not.toContain("stack");
    } finally {
      loggingServer.close();
    }
  });

  it("does not let a completion logger failure alter the response", async () => {
    const loggingApp = createApp({
      requestCompletionLogger: () => {
        throw new Error("logger unavailable");
      },
    });
    const loggingServer = loggingApp.listen(0);

    try {
      const address = loggingServer.address();

      if (address === null || typeof address === "string") {
        throw new Error("Expected the test server to bind to a TCP port");
      }

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/health`,
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        ok: true,
        data: {
          status: "ok",
        },
      });
    } finally {
      loggingServer.close();
    }
  });

  it("logs unknown request failures without messages or request data", async () => {
    const entries: unknown[] = [];
    const loggingApp = createApp({
      authRateLimiter: createAiRateLimiter({
        perMinute: 1_000,
        perDay: 100_000,
        now: () => 0,
      }),
      requestCompletionLogger: () => undefined,
      unknownErrorLogger: (entry) => entries.push(entry),
    });
    const loggingServer = loggingApp.listen(0);

    try {
      const address = loggingServer.address();

      if (address === null || typeof address === "string") {
        throw new Error("Expected the test server to bind to a TCP port");
      }

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/auth/login`,
        {
          body: '{"password":"must-not-appear"',
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );

      expect(response.status).toBe(500);
      expect(entries).toEqual([
        {
          event: "unhandled_request_error",
          method: "POST",
          path: "/api/auth/login",
          errorType: "SyntaxError",
        },
      ]);
      expect(JSON.stringify(entries)).not.toContain("must-not-appear");
    } finally {
      loggingServer.close();
    }
  });

  it("rejects unauthenticated access to /api/auth/me", async () => {
    const response = await request("/api/auth/me");
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing authentication credentials.",
      },
    });
  });

  it("rejects malformed bearer headers on protected routes", async () => {
    const response = await request("/api/workouts", {
      headers: {
        authorization: "Token invalid-token",
      },
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid Authorization header.",
      },
    });
  });

  it("rejects invalid bearer tokens on protected routes", async () => {
    mockedVerifyJwt.mockRejectedValueOnce(
      new HttpError(401, "UNAUTHORIZED", "Invalid authentication token."),
    );

    const response = await request("/api/workouts", {
      headers: {
        authorization: "Bearer invalid-token",
      },
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid authentication token.",
      },
    });
  });

  it("keeps unauthenticated workout access guarded at the app boundary", async () => {
    const response = await request("/api/workouts");
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing authentication credentials.",
      },
    });
  });

  it("keeps unauthenticated feedback access guarded at the app boundary", async () => {
    const response = await request("/api/feedback", {
      body: JSON.stringify({
        rating: 5,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    expect(response.status).toBe(401);
    expect(mockedSubmitProductFeedback).not.toHaveBeenCalled();
  });

  it("applies auth rate limits before the login controller", async () => {
    const limitedApp = createApp({
      authRateLimiter: createAiRateLimiter({
        perMinute: 1,
        perDay: 100,
        now: () => 0,
      }),
      requestCompletionLogger: () => undefined,
    });
    const limitedServer = limitedApp.listen(0);

    try {
      const address = limitedServer.address();

      if (address === null || typeof address === "string") {
        throw new Error("Expected the test server to bind to a TCP port");
      }

      const url = `http://127.0.0.1:${address.port}/api/auth/login`;
      const requestInit = {
        body: JSON.stringify({}),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      };

      await fetch(url, requestInit);
      const response = await fetch(url, requestInit);
      const payload = await response.json();

      expect(response.status).toBe(429);
      expect(payload).toEqual({
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: "Rate limited.",
          details: {
            retry_after_seconds: 60,
          },
        },
      });
    } finally {
      limitedServer.close();
    }
  });
});
