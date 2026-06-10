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

import { createApp } from "./app.js";
import { verifyJwt } from "./services/auth/jwt.js";
import { submitProductFeedback } from "./services/product-feedback-service.js";
import { HttpError } from "./utils/http-error.js";

const mockedVerifyJwt = vi.mocked(verifyJwt);
const mockedSubmitProductFeedback = vi.mocked(submitProductFeedback);

describe("createApp", () => {
  const app = createApp();
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
    const payload = (await response.json()) as {
      ok: boolean;
      data: { status: string };
    };

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      data: {
        status: "ok",
      },
    });
  });

  it("rejects unauthenticated access to /api/auth/me", async () => {
    const response = await request("/api/auth/me");
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing Authorization header.",
      },
    });
  });

  it("rejects malformed bearer headers on protected routes", async () => {
    const response = await request("/api/workouts", {
      headers: {
        authorization: "Token invalid-token",
      },
    });
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };

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
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };

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
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing Authorization header.",
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
});
