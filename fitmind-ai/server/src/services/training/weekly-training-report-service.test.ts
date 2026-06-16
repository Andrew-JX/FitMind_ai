import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./training-summary-service.js", () => ({
  getUserTrainingSummary: vi.fn(),
}));

vi.mock("./muscle-load-service.js", () => ({
  getUserMuscleLoad: vi.fn(),
}));

vi.mock("./recommendation-context-service.js", () => ({
  getUserRecommendationContext: vi.fn(),
}));

vi.mock("./exercise-progress-service.js", () => ({
  getUserExerciseProgress: vi.fn(),
}));

import { getUserExerciseProgress } from "./exercise-progress-service.js";
import { getUserMuscleLoad } from "./muscle-load-service.js";
import { getUserRecommendationContext } from "./recommendation-context-service.js";
import { getUserTrainingSummary } from "./training-summary-service.js";
import { getUserWeeklyTrainingReport } from "./weekly-training-report-service.js";

const userId = "11111111-1111-4111-8111-111111111111";
const exerciseId = "22222222-2222-4222-8222-222222222222";
const range = {
  start_date: "2026-05-01",
  end_date: "2026-05-07",
};

const mockedGetUserTrainingSummary = vi.mocked(getUserTrainingSummary);
const mockedGetUserMuscleLoad = vi.mocked(getUserMuscleLoad);
const mockedGetUserRecommendationContext = vi.mocked(
  getUserRecommendationContext,
);
const mockedGetUserExerciseProgress = vi.mocked(getUserExerciseProgress);

function mockEmptyDependencies(): void {
  mockedGetUserTrainingSummary.mockResolvedValue({
    range,
    totals: {
      workout_count: 0,
      set_count: 0,
      total_reps: 0,
      total_volume: 0,
    },
    by_exercise: [],
    evidence: {
      workout_ids: [],
      calculation_rules: ["summary rule"],
    },
  });
  mockedGetUserMuscleLoad.mockResolvedValue({
    range,
    totals: {
      workout_count: 0,
      set_count: 0,
      total_reps: 0,
      total_raw_volume: 0,
      total_weighted_volume: 0,
      muscle_group_count: 0,
    },
    by_muscle_group: [],
    top_muscle_groups: [],
    low_volume_muscle_groups: [],
    evidence: {
      workout_ids: [],
      set_ids: [],
      calculation_rules: ["muscle rule"],
    },
  });
  mockedGetUserRecommendationContext.mockResolvedValue({
    range,
    summary: {
      workout_count: 0,
      set_count: 0,
      total_reps: 0,
      total_volume: 0,
      by_exercise: [],
    },
    focus_exercises: [],
    recent_workouts: [],
    evidence: {
      source: "deterministic_calculation_layer",
      workout_ids: [],
      set_ids: [],
      calculation_rules: ["context rule"],
    },
  });
}

describe("getUserWeeklyTrainingReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a safe empty-state report", async () => {
    mockEmptyDependencies();

    const report = await getUserWeeklyTrainingReport(userId, range);

    expect(report.status).toBe("empty");
    expect(report.frequency.workouts_per_week).toBe(0);
    expect(report.top_exercises).toEqual([]);
    expect(report.top_muscle_groups).toEqual([]);
    expect(report.selected_exercise_progress).toBeNull();
    expect(report.limitations).toContain(
      "Weekly reports are based only on recorded workouts and sets.",
    );
    expect(report.evidence.workout_ids).toEqual([]);
    expect(report.evidence.calculation_sources).toEqual([
      "training_summary",
      "muscle_load",
      "recommendation_context",
    ]);
  });

  it("summarizes weekly volume, frequency, exercises, and muscle distribution", async () => {
    mockEmptyDependencies();
    mockedGetUserTrainingSummary.mockResolvedValueOnce({
      range,
      totals: {
        workout_count: 3,
        set_count: 18,
        total_reps: 120,
        total_volume: 14250,
      },
      by_exercise: [
        {
          exercise_id: exerciseId,
          exercise_name: "Bench Press",
          set_count: 9,
          total_reps: 45,
          total_volume: 6000,
          max_weight_kg: 82.5,
          estimated_1rm_kg: 96.25,
        },
      ],
      evidence: {
        workout_ids: ["33333333-3333-4333-8333-333333333333"],
        calculation_rules: ["summary rule"],
      },
    });
    mockedGetUserMuscleLoad.mockResolvedValueOnce({
      range,
      totals: {
        workout_count: 3,
        set_count: 18,
        total_reps: 120,
        total_raw_volume: 14250,
        total_weighted_volume: 11000,
        muscle_group_count: 3,
      },
      by_muscle_group: [],
      top_muscle_groups: [
        {
          muscle_group_id: "44444444-4444-4444-8444-444444444444",
          muscle_group_name: "Chest",
          set_count: 9,
          total_reps: 45,
          raw_volume: 6000,
          weighted_volume: 5000,
          contribution_ratio: 0.45,
          top_exercises: [],
        },
      ],
      low_volume_muscle_groups: [
        {
          muscle_group_id: "55555555-5555-4555-8555-555555555555",
          muscle_group_name: "Legs",
          set_count: 3,
          total_reps: 24,
          raw_volume: 1800,
          weighted_volume: 1200,
          contribution_ratio: 0.11,
          top_exercises: [],
        },
      ],
      evidence: {
        workout_ids: ["33333333-3333-4333-8333-333333333333"],
        set_ids: ["66666666-6666-4666-8666-666666666666"],
        calculation_rules: ["muscle rule"],
      },
    });
    mockedGetUserRecommendationContext.mockResolvedValueOnce({
      range,
      summary: {
        workout_count: 3,
        set_count: 18,
        total_reps: 120,
        total_volume: 14250,
        by_exercise: [],
      },
      focus_exercises: [],
      recent_workouts: [
        {
          workout_id: "33333333-3333-4333-8333-333333333333",
          performed_at: "2026-05-07T09:00:00.000Z",
          notes: null,
          set_count: 6,
          total_volume: 4500,
        },
      ],
      evidence: {
        source: "deterministic_calculation_layer",
        workout_ids: ["33333333-3333-4333-8333-333333333333"],
        set_ids: ["66666666-6666-4666-8666-666666666666"],
        calculation_rules: ["context rule"],
      },
    });

    const report = await getUserWeeklyTrainingReport(userId, range);

    expect(report.status).toBe("ready");
    expect(report.frequency).toEqual({
      range_days: 7,
      workouts_per_week: 3,
    });
    expect(report.totals.total_volume).toBe(14250);
    expect(report.top_exercises[0]?.exercise_name).toBe("Bench Press");
    expect(report.top_exercises[0]?.max_weight_kg).toBe(82.5);
    expect(report.top_exercises[0]?.estimated_1rm_kg).toBe(96.25);
    expect(report.top_muscle_groups[0]?.muscle_group_name).toBe("Chest");
    expect(report.low_volume_muscle_groups[0]?.muscle_group_name).toBe("Legs");
    expect(report.recovery_notes[0]).toContain("latest recorded workout");
  });

  it("includes selected exercise progress when exercise_id is provided", async () => {
    mockEmptyDependencies();
    mockedGetUserExerciseProgress.mockResolvedValueOnce({
      range,
      exercise: {
        exercise_id: exerciseId,
        exercise_name: "Bench Press",
      },
      totals: {
        workout_count: 2,
        set_count: 6,
        total_reps: 30,
        total_volume: 4200,
        max_weight_kg: 82.5,
        max_reps: 5,
        estimated_1rm_kg: 96.25,
      },
      sessions: [],
      evidence: {
        workout_ids: ["77777777-7777-4777-8777-777777777777"],
        set_ids: ["88888888-8888-4888-8888-888888888888"],
        calculation_rules: ["progress rule"],
      },
    });

    const report = await getUserWeeklyTrainingReport(userId, {
      ...range,
      exercise_id: exerciseId,
    });

    expect(mockedGetUserExerciseProgress).toHaveBeenCalledWith(
      userId,
      exerciseId,
      range,
    );
    expect(report.selected_exercise_progress).toEqual({
      exercise_id: exerciseId,
      exercise_name: "Bench Press",
      workout_count: 2,
      set_count: 6,
      max_weight_kg: 82.5,
      estimated_1rm_kg: 96.25,
    });
    expect(report.evidence.calculation_sources).toContain("exercise_progress");
    expect(report.evidence.set_ids).toContain(
      "88888888-8888-4888-8888-888888888888",
    );
  });
});
