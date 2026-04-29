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

import { createApp } from "./app.js";
import { verifyJwt } from "./services/auth/jwt.js";
import {
  addUserWorkoutSet,
  createUserWorkout,
  deleteUserWorkoutSet,
  deleteUserWorkout,
  getUserWorkout,
  updateUserWorkout,
  updateUserWorkoutSet,
} from "./services/training/workout-service.js";
import { HttpError } from "./utils/http-error.js";

const mockedVerifyJwt = vi.mocked(verifyJwt);
const mockedAddUserWorkoutSet = vi.mocked(addUserWorkoutSet);
const mockedCreateUserWorkout = vi.mocked(createUserWorkout);
const mockedDeleteUserWorkoutSet = vi.mocked(deleteUserWorkoutSet);
const mockedDeleteUserWorkout = vi.mocked(deleteUserWorkout);
const mockedGetUserWorkout = vi.mocked(getUserWorkout);
const mockedUpdateUserWorkout = vi.mocked(updateUserWorkout);
const mockedUpdateUserWorkoutSet = vi.mocked(updateUserWorkoutSet);

describe("createApp", () => {
  const app = createApp();
  const server = app.listen(0);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  it("serves the health endpoint", async () => {
    const address = server.address();

    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
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
    const address = server.address();

    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/auth/me`,
    );
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

  it("rejects unauthenticated access to /api/workouts", async () => {
    const address = server.address();

    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/workouts`,
    );
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

  it("creates a workout and returns 201", async () => {
    const address = server.address();

    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    mockedVerifyJwt.mockResolvedValueOnce({
      userId: "11111111-1111-4111-8111-111111111111",
    });
    mockedCreateUserWorkout.mockResolvedValueOnce({
      workout: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        performed_at: "2026-05-01T10:00:00.000Z",
        duration_minutes: 75,
        notes: "leg day",
        sets: [],
      },
    });

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/workouts`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer valid-token",
        },
        body: JSON.stringify({
          performed_at: "2026-05-01T10:00:00.000Z",
          duration_minutes: 75,
          notes: "leg day",
          sets: [
            {
              exercise_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              set_index: 1,
              reps: 5,
              weight_kg: 100,
              rpe: 8,
              is_warmup: false,
            },
          ],
        }),
      },
    );
    const payload = (await response.json()) as {
      ok: boolean;
      data: {
        workout: {
          id: string;
          performed_at: string;
          duration_minutes: number;
          notes: string;
          sets: unknown[];
        };
      };
    };

    expect(response.status).toBe(201);
    expect(payload).toEqual({
      ok: true,
      data: {
        workout: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          performed_at: "2026-05-01T10:00:00.000Z",
          duration_minutes: 75,
          notes: "leg day",
          sets: [],
        },
      },
    });
  });

  it("rejects workout patch bodies that include sets", async () => {
    const address = server.address();

    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    mockedVerifyJwt.mockResolvedValueOnce({
      userId: "11111111-1111-4111-8111-111111111111",
    });

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/workouts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer valid-token",
        },
        body: JSON.stringify({
          sets: [
            {
              exercise_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              set_index: 1,
              reps: 5,
              weight_kg: 100,
              is_warmup: false,
            },
          ],
        }),
      },
    );
    const payload = (await response.json()) as {
      ok: boolean;
      error: {
        code: string;
        message: string;
        details?: {
          issues?: Array<{ path: string; message: string }>;
        };
      };
    };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(payload.error.message).toBe("Request validation failed.");
    expect(payload.error.details?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "At least one field is required",
        }),
      ]),
    );
    expect(mockedUpdateUserWorkout).not.toHaveBeenCalled();
  });

  it("rejects cross-user workout access", async () => {
    const address = server.address();

    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    mockedVerifyJwt.mockResolvedValueOnce({
      userId: "11111111-1111-4111-8111-111111111111",
    });
    mockedGetUserWorkout.mockRejectedValueOnce(
      new HttpError(403, "FORBIDDEN", "You cannot access this workout."),
    );

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/workouts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      {
        headers: {
          authorization: "Bearer valid-token",
        },
      },
    );
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "You cannot access this workout.",
      },
    });
  });

  it("adds a set and returns 201", async () => {
    const address = server.address();

    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    mockedVerifyJwt.mockResolvedValueOnce({
      userId: "11111111-1111-4111-8111-111111111111",
    });
    mockedAddUserWorkoutSet.mockResolvedValueOnce({
      workout: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        performed_at: "2026-05-01T10:00:00.000Z",
        duration_minutes: 75,
        notes: "leg day",
        sets: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            exercise_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            set_index: 2,
            reps: 8,
            weight_kg: 80,
            rpe: 7,
            is_warmup: false,
            notes: null,
            created_at: "2026-05-01T10:10:00.000Z",
          },
        ],
      },
    });

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/workouts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/sets`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer valid-token",
        },
        body: JSON.stringify({
          exercise_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          set_index: 2,
          reps: 8,
          weight_kg: 80,
          rpe: 7,
          is_warmup: false,
        }),
      },
    );
    const payload = (await response.json()) as {
      ok: boolean;
      data: {
        workout: {
          id: string;
          sets: Array<{ id: string; set_index: number }>;
        };
      };
    };

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.data.workout.id).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(payload.data.workout.sets).toEqual([
      expect.objectContaining({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        set_index: 2,
      }),
    ]);
  });

  it("updates a set and returns 200", async () => {
    const address = server.address();

    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    mockedVerifyJwt.mockResolvedValueOnce({
      userId: "11111111-1111-4111-8111-111111111111",
    });
    mockedUpdateUserWorkoutSet.mockResolvedValueOnce({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      exercise_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      set_index: 2,
      reps: 10,
      weight_kg: 82.5,
      rpe: 8,
      is_warmup: false,
      notes: null,
      created_at: "2026-05-01T10:10:00.000Z",
    });

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/sets/cccccccc-cccc-4ccc-8ccc-cccccccccccc`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer valid-token",
        },
        body: JSON.stringify({
          reps: 10,
          weight_kg: 82.5,
        }),
      },
    );
    const payload = (await response.json()) as {
      ok: boolean;
      data: {
        set: {
          id: string;
          reps: number;
          weight_kg: number;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.set).toEqual(
      expect.objectContaining({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        reps: 10,
        weight_kg: 82.5,
      }),
    );
  });

  it("returns the unified delete response for sets", async () => {
    const address = server.address();

    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    mockedVerifyJwt.mockResolvedValueOnce({
      userId: "11111111-1111-4111-8111-111111111111",
    });
    mockedDeleteUserWorkoutSet.mockResolvedValueOnce({
      deleted: true,
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    });

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/sets/cccccccc-cccc-4ccc-8ccc-cccccccccccc`,
      {
        method: "DELETE",
        headers: {
          authorization: "Bearer valid-token",
        },
      },
    );
    const payload = (await response.json()) as {
      ok: boolean;
      data: { deleted: boolean; id: string };
    };

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      data: {
        deleted: true,
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      },
    });
  });

  it("returns the unified delete response for workouts", async () => {
    const address = server.address();

    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    mockedVerifyJwt.mockResolvedValueOnce({
      userId: "11111111-1111-4111-8111-111111111111",
    });
    mockedDeleteUserWorkout.mockResolvedValueOnce({
      deleted: true,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/workouts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      {
        method: "DELETE",
        headers: {
          authorization: "Bearer valid-token",
        },
      },
    );
    const payload = (await response.json()) as {
      ok: boolean;
      data: { deleted: boolean; id: string };
    };

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      data: {
        deleted: true,
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
    });
  });
});
