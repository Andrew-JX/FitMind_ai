import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/planned-workout-service.js", async () => {
  const actual = await vi.importActual<
    typeof import("../services/planned-workout-service.js")
  >("../services/planned-workout-service.js");

  return {
    ...actual,
    acceptPlan: vi.fn(),
    getCurrentPlanWithAdherence: vi.fn(),
    setPlanStatus: vi.fn(),
  };
});

import {
  acceptPlan,
  getCurrentPlanWithAdherence,
  setPlanStatus,
} from "../services/planned-workout-service.js";
import {
  getCurrentPlannedWorkoutController,
  patchPlannedWorkoutStatusController,
  postAcceptPlanController,
} from "./planned-workout-controller.js";

const mockedAccept = vi.mocked(acceptPlan);
const mockedGetCurrent = vi.mocked(getCurrentPlanWithAdherence);
const mockedSetStatus = vi.mocked(setPlanStatus);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PLAN_ID = "22222222-2222-4222-8222-222222222222";

const validPlan = {
  strategy: "maintain" as const,
  exercises: [
    {
      exercise_name: "Barbell Bench Press",
      sets: 3,
      rep_min: 6,
      rep_max: 10,
      target_weight_kg: 72.5,
      basis: "x",
    },
  ],
  notes: ["y"],
};

function createResponse() {
  const response = {
    json: vi.fn(),
    locals: { userId: USER_ID },
    status: vi.fn(),
  };
  response.status.mockReturnValue(response);

  return response as unknown as Response<unknown, { userId: string }>;
}

function createRequest(parts: { body?: unknown; params?: unknown }): Request {
  return { body: parts.body, params: parts.params } as unknown as Request;
}

describe("planned-workout-controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a valid plan and returns 201", async () => {
    mockedAccept.mockResolvedValueOnce({
      id: PLAN_ID,
      status: "active",
      startDate: "2026-06-15",
      endDate: "2026-06-21",
      plan: validPlan,
      sourceMessageId: null,
      createdAt: "2026-06-14T00:00:00.000Z",
      updatedAt: "2026-06-14T00:00:00.000Z",
    });
    const response = createResponse();

    await postAcceptPlanController(
      createRequest({
        body: { startDate: "2026-06-15", endDate: "2026-06-21", plan: validPlan },
      }),
      response,
    );

    expect(mockedAccept).toHaveBeenCalledWith(USER_ID, {
      startDate: "2026-06-15",
      endDate: "2026-06-21",
      plan: validPlan,
    });
    expect(response.status).toHaveBeenCalledWith(201);
  });

  it("rejects an invalid date range before calling the service", async () => {
    await expect(
      postAcceptPlanController(
        createRequest({
          body: { startDate: "2026-06-21", endDate: "2026-06-15", plan: validPlan },
        }),
        createResponse(),
      ),
    ).rejects.toBeTruthy();
    expect(mockedAccept).not.toHaveBeenCalled();
  });

  it("returns the current plan (or null) on GET", async () => {
    mockedGetCurrent.mockResolvedValueOnce(null);
    const response = createResponse();

    await getCurrentPlannedWorkoutController(createRequest({}), response);

    expect(mockedGetCurrent).toHaveBeenCalledWith(USER_ID);
    expect(response.json).toHaveBeenCalledWith({
      ok: true,
      data: { plannedWorkout: null },
    });
  });

  it("updates plan status on PATCH", async () => {
    mockedSetStatus.mockResolvedValueOnce({
      id: PLAN_ID,
      status: "completed",
      startDate: "2026-06-15",
      endDate: "2026-06-21",
      plan: validPlan,
      sourceMessageId: null,
      createdAt: "2026-06-14T00:00:00.000Z",
      updatedAt: "2026-06-14T00:00:00.000Z",
    });
    const response = createResponse();

    await patchPlannedWorkoutStatusController(
      createRequest({ params: { id: PLAN_ID }, body: { status: "completed" } }),
      response,
    );

    expect(mockedSetStatus).toHaveBeenCalledWith(USER_ID, PLAN_ID, "completed");
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("rejects an invalid status value", async () => {
    await expect(
      patchPlannedWorkoutStatusController(
        createRequest({ params: { id: PLAN_ID }, body: { status: "active" } }),
        createResponse(),
      ),
    ).rejects.toBeTruthy();
    expect(mockedSetStatus).not.toHaveBeenCalled();
  });
});
