import { describe, expect, it, vi } from "vitest";

import type { PlannedWorkoutRow } from "../db/planned-workout-repository.js";
import type { TrainingSummaryRepositoryResult } from "../db/training-summary-repository.js";
import type { NextWeekPlanDraft } from "./agent/react-planner-types.js";
import {
  acceptPlan,
  getCurrentPlanWithAdherence,
  setPlanStatus,
} from "./planned-workout-service.js";

const planDraft: NextWeekPlanDraft = {
  strategy: "maintain",
  exercises: [
    {
      exercise_name: "Barbell Bench Press",
      sets: 3,
      rep_min: 6,
      rep_max: 10,
      target_weight_kg: 72.5,
      basis: "基于估算 1RM ...",
    },
    {
      exercise_name: "Barbell Squat",
      sets: 4,
      rep_min: 6,
      rep_max: 10,
      target_weight_kg: null,
      basis: "沿用上次训练重量。",
    },
  ],
  notes: ["一次只改一个变量。"],
};

function buildRow(overrides: Partial<PlannedWorkoutRow> = {}): PlannedWorkoutRow {
  return {
    id: "plan-1",
    user_id: "u1",
    status: "active",
    start_date: "2026-06-15",
    end_date: "2026-06-21",
    plan: planDraft,
    source_message_id: null,
    created_at: "2026-06-14T00:00:00.000Z",
    updated_at: "2026-06-14T00:00:00.000Z",
    ...overrides,
  };
}

function buildSummary(): TrainingSummaryRepositoryResult {
  return {
    totals: {
      workout_count: 2,
      set_count: 5,
      total_reps: 40,
      total_volume: 1000,
      workout_ids: ["w1"],
    },
    byExercise: [
      {
        exercise_id: "e1",
        exercise_name: "Barbell Bench Press",
        set_count: 3,
        total_reps: 24,
        total_volume: 600,
      },
      {
        exercise_id: "e2",
        exercise_name: "Barbell Squat",
        set_count: 2,
        total_reps: 16,
        total_volume: 400,
      },
    ],
  };
}

function deps(overrides: Partial<Parameters<typeof acceptPlan>[2]> = {}) {
  return {
    createPlannedWorkout: vi.fn(),
    getActivePlannedWorkoutForUser: vi.fn(),
    updatePlannedWorkoutStatus: vi.fn(),
    getTrainingSummary: vi.fn(),
    ...overrides,
  };
}

describe("acceptPlan", () => {
  it("serializes the plan and persists it as a planned workout", async () => {
    const createPlannedWorkout = vi.fn().mockResolvedValue(buildRow());

    const dto = await acceptPlan(
      "u1",
      { startDate: "2026-06-15", endDate: "2026-06-21", plan: planDraft },
      deps({ createPlannedWorkout }),
    );

    expect(createPlannedWorkout).toHaveBeenCalledWith({
      userId: "u1",
      startDate: "2026-06-15",
      endDate: "2026-06-21",
      planJson: JSON.stringify(planDraft),
      sourceMessageId: null,
    });
    expect(dto.status).toBe("active");
    expect(dto.plan.exercises).toHaveLength(2);
  });
});

describe("getCurrentPlanWithAdherence", () => {
  it("computes adherence against performed workouts in range", async () => {
    const dto = await getCurrentPlanWithAdherence(
      "u1",
      deps({
        getActivePlannedWorkoutForUser: vi.fn().mockResolvedValue(buildRow()),
        getTrainingSummary: vi.fn().mockResolvedValue(buildSummary()),
      }),
    );

    expect(dto).not.toBeNull();
    expect(dto?.adherence.planned_exercise_count).toBe(2);
    expect(dto?.adherence.trained_exercise_count).toBe(2);
    // Bench 3/3 done, Squat 2/4 partial → sets (3+2)/(3+4).
    expect(dto?.adherence.exercises[0]?.status).toBe("done");
    expect(dto?.adherence.exercises[1]?.status).toBe("partial");
    expect(dto?.adherence.set_adherence_ratio).toBeCloseTo(5 / 7, 3);
  });

  it("returns null when there is no active plan", async () => {
    const dto = await getCurrentPlanWithAdherence(
      "u1",
      deps({
        getActivePlannedWorkoutForUser: vi.fn().mockResolvedValue(null),
      }),
    );

    expect(dto).toBeNull();
  });
});

describe("setPlanStatus", () => {
  it("throws 404 when no matching plan exists", async () => {
    await expect(
      setPlanStatus(
        "u1",
        "missing",
        "abandoned",
        deps({
          updatePlannedWorkoutStatus: vi.fn().mockResolvedValue(null),
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
