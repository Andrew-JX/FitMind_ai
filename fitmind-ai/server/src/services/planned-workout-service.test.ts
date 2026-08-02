import { describe, expect, it, vi } from "vitest";

import { getLatestAcceptedPlannedWorkoutForUser } from "../db/planned-workout-repository.js";
import type { PlannedWorkoutRow } from "../db/planned-workout-repository.js";
import type { TrainingSummaryRepositoryResult } from "../db/training-summary-repository.js";
import type { NextWeekPlanDraft } from "./agent/react-planner-types.js";
import {
  acceptPlan,
  getCurrentPlanWithAdherence,
  getPlanAdherenceContextForPlanner,
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

function buildRow(
  overrides: Partial<PlannedWorkoutRow> = {},
): PlannedWorkoutRow {
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
        max_weight_kg: 90,
        estimated_1rm_kg: 105,
      },
      {
        exercise_id: "e2",
        exercise_name: "Barbell Squat",
        set_count: 2,
        total_reps: 16,
        total_volume: 400,
        max_weight_kg: 120,
        estimated_1rm_kg: 140,
      },
    ],
  };
}

function deps(overrides: Partial<Parameters<typeof acceptPlan>[2]> = {}) {
  return {
    createPlannedWorkout: vi.fn(),
    getActivePlannedWorkoutForUser: vi.fn(),
    getLatestAcceptedPlannedWorkoutForUser: vi.fn(),
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

describe("getPlanAdherenceContextForPlanner", () => {
  it("computes planner adherence context from a completed overlapping plan", async () => {
    const context = await getPlanAdherenceContextForPlanner(
      "u1",
      { startDate: "2026-06-15", endDate: "2026-06-21" },
      deps({
        getLatestAcceptedPlannedWorkoutForUser: vi
          .fn()
          .mockResolvedValue(buildRow({ status: "completed" })),
        getTrainingSummary: vi.fn().mockResolvedValue(buildSummary()),
      }),
    );

    expect(context).not.toBeNull();
    expect(context?.startDate).toBe("2026-06-15");
    expect(context?.endDate).toBe("2026-06-21");
    expect(context?.setAdherenceRatio).toBeCloseTo(5 / 7, 3);
    expect(context?.exercises[0]).toMatchObject({
      exerciseName: "Barbell Bench Press",
      plannedSets: 3,
      performedSets: 3,
      status: "done",
      targetWeightKg: 72.5,
    });
    expect(context?.exercises[1]).toMatchObject({
      exerciseName: "Barbell Squat",
      status: "partial",
      targetWeightKg: null,
    });
  });

  it("returns null when no accepted plan overlaps the planner window", async () => {
    const context = await getPlanAdherenceContextForPlanner(
      "u1",
      { startDate: "2026-06-22", endDate: "2026-06-28" },
      deps({
        getLatestAcceptedPlannedWorkoutForUser: vi.fn().mockResolvedValue(null),
      }),
    );

    expect(context).toBeNull();
  });

  it("lets training summary failures bubble to the best-effort orchestrator caller", async () => {
    await expect(
      getPlanAdherenceContextForPlanner(
        "u1",
        { startDate: "2026-06-15", endDate: "2026-06-21" },
        deps({
          getLatestAcceptedPlannedWorkoutForUser: vi
            .fn()
            .mockResolvedValue(buildRow()),
          getTrainingSummary: vi.fn().mockRejectedValue(new Error("db down")),
        }),
      ),
    ).rejects.toThrow("db down");
  });
});

describe("getLatestAcceptedPlannedWorkoutForUser", () => {
  it("queries only active or completed plans that overlap the evidence window", async () => {
    const query = vi.fn(async (sql: string, params?: readonly unknown[]) => {
      void sql;
      void params;

      return {
        rows: [buildRow({ status: "completed" })],
      };
    });

    const row = await getLatestAcceptedPlannedWorkoutForUser(
      { userId: "u1", startDate: "2026-06-15", endDate: "2026-06-21" },
      { query },
    );
    const sql = query.mock.calls[0]?.[0] ?? "";

    expect(row?.status).toBe("completed");
    expect(sql).toContain("status IN ('active', 'completed')");
    expect(sql).toContain("start_date <= $3::date");
    expect(sql).toContain("end_date >= $2::date");
    expect(query).toHaveBeenCalledWith(expect.any(String), [
      "u1",
      "2026-06-15",
      "2026-06-21",
    ]);
  });
});

// PL-4 guard, written before acceptPlan started superseding old plans.
//
// Superseding flips a previous plan from active to completed. The D42 learning
// loop reads its context through getLatestAcceptedPlannedWorkoutForUser, which
// accepts active *and* completed, so the flip must leave that context intact.
// If a later change ever narrows that query to active-only, or supersedes by
// abandoning instead of completing, these two fail and say why.
describe("D42 planner context survives a superseded plan", () => {
  it("still builds adherence context from a completed plan", async () => {
    const context = await getPlanAdherenceContextForPlanner(
      "u1",
      { startDate: "2026-06-15", endDate: "2026-06-21" },
      deps({
        getLatestAcceptedPlannedWorkoutForUser: vi
          .fn()
          .mockResolvedValue(buildRow({ status: "completed" })),
        getTrainingSummary: vi.fn().mockResolvedValue(buildSummary()),
      }),
    );

    expect(context).not.toBeNull();
    expect(context?.startDate).toBe("2026-06-15");
    expect(context?.exercises).toHaveLength(2);
    expect(context?.exerciseAdherenceRatio).toBeGreaterThan(0);
  });

  it("keeps 'completed' inside the accepted status set of the query", async () => {
    const query = vi.fn(async () => ({
      rows: [buildRow({ status: "completed" })],
    }));

    await getLatestAcceptedPlannedWorkoutForUser(
      { userId: "u1", startDate: "2026-06-15", endDate: "2026-06-21" },
      { query },
    );

    const sql = query.mock.calls[0]?.[0] ?? "";

    expect(sql).toContain("'completed'");
    expect(sql).not.toContain("'abandoned'");
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
