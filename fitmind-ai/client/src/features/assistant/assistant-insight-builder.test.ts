import { describe, expect, it } from "vitest";

import type { ExerciseProgress } from "../training/exercise-progress-api";
import type { RecommendationContext } from "../training/recommendation-context-api";
import type { TrainingSummary } from "../training/training-summary-api";
import { buildAssistantInsightSnapshot } from "./assistant-insight-builder";

function createBaseSummary(): TrainingSummary {
  return {
    range: {
      start_date: "2026-04-09",
      end_date: "2026-05-09",
    },
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
  };
}

function createBaseRecommendationContext(): RecommendationContext {
  return {
    range: {
      start_date: "2026-04-09",
      end_date: "2026-05-09",
    },
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
      source: "deterministic_calculation_layer" as const,
      workout_ids: [],
      set_ids: [],
      calculation_rules: ["recommendation rule"],
    },
  };
}

describe("buildAssistantInsightSnapshot", () => {
  it("returns product-friendly empty states when there are no workouts", () => {
    const snapshot = buildAssistantInsightSnapshot({
      exerciseProgress: null,
      recommendationContext: createBaseRecommendationContext(),
      selectedExerciseName: null,
      summary: createBaseSummary(),
    });

    expect(snapshot.overview.workout_count).toBe(0);
    expect(snapshot.cards[0]?.summary).toContain("最近还没有足够训练记录");
    expect(snapshot.cards[1]?.summary).toContain("现在还没有可比较的训练分布");
    expect(snapshot.cards[2]?.summary).toContain("还没有最近训练记录可供参考");
    expect(snapshot.cards[3]?.summary).toContain("当前还没有选中动作");
    expect(snapshot.cards[4]?.summary).toContain("当前还没有训练证据可解释");
  });

  it("stays conservative when the record is still sparse", () => {
    const summary = createBaseSummary();
    summary.totals.workout_count = 1;
    summary.totals.set_count = 3;
    summary.totals.total_reps = 24;
    summary.totals.total_volume = 1775;
    summary.by_exercise = [
      {
        exercise_id: "bench-id",
        exercise_name: "Barbell Bench Press",
        set_count: 3,
        total_reps: 24,
        total_volume: 1775,
      },
    ];

    const recommendationContext = createBaseRecommendationContext();
    recommendationContext.summary = {
      workout_count: 1,
      set_count: 3,
      total_reps: 24,
      total_volume: 1775,
      by_exercise: summary.by_exercise,
    };
    recommendationContext.recent_workouts = [
      {
        workout_id: "workout-1",
        performed_at: new Date().toISOString(),
        notes: "first workout",
        set_count: 3,
        total_volume: 1775,
      },
    ];
    recommendationContext.evidence.workout_ids = ["workout-1"];

    const snapshot = buildAssistantInsightSnapshot({
      exerciseProgress: null,
      recommendationContext,
      selectedExerciseName: null,
      summary,
    });

    expect(snapshot.cards[0]?.summary).toContain("当前样本还偏少");
    expect(snapshot.cards[1]?.summary).toContain("目前训练记录还不够厚");
    expect(snapshot.cards[2]?.summary).toContain("当前只有 1 次训练记录");
    expect(snapshot.cards[3]?.summary).toContain("当前还没有选中动作");
  });

  it("shows a no-session fallback for a selected exercise with no records in range", () => {
    const summary = createBaseSummary();
    summary.totals.workout_count = 2;
    summary.totals.set_count = 6;

    const recommendationContext = createBaseRecommendationContext();
    recommendationContext.summary.workout_count = 2;
    recommendationContext.summary.set_count = 6;
    recommendationContext.recent_workouts = [
      {
        workout_id: "workout-1",
        performed_at: new Date().toISOString(),
        notes: "recent workout",
        set_count: 3,
        total_volume: 1200,
      },
    ];

    const snapshot = buildAssistantInsightSnapshot({
      exerciseProgress: {
        range: {
          start_date: "2026-04-09",
          end_date: "2026-05-09",
        },
        exercise: {
          exercise_id: "squat-id",
          exercise_name: "Barbell Back Squat",
        },
        totals: {
          workout_count: 0,
          set_count: 0,
          total_reps: 0,
          total_volume: 0,
          max_weight_kg: null,
          max_reps: null,
          estimated_1rm_kg: null,
        },
        sessions: [],
        evidence: {
          workout_ids: [],
          set_ids: [],
          calculation_rules: ["progress rule"],
        },
      } satisfies ExerciseProgress,
      recommendationContext,
      selectedExerciseName: "Barbell Back Squat",
      summary,
    });

    expect(snapshot.cards[3]?.summary).toContain("最近 30 天还没有训练记录");
  });

  it("produces a stronger focus recommendation when chest work dominates", () => {
    const summary = createBaseSummary();
    summary.totals.workout_count = 5;
    summary.totals.set_count = 12;
    summary.totals.total_reps = 88;
    summary.totals.total_volume = 5200;
    summary.by_exercise = [
      {
        exercise_id: "bench-id",
        exercise_name: "Barbell Bench Press",
        set_count: 6,
        total_reps: 36,
        total_volume: 2900,
      },
      {
        exercise_id: "incline-id",
        exercise_name: "Incline Barbell Bench Press",
        set_count: 3,
        total_reps: 24,
        total_volume: 1200,
      },
      {
        exercise_id: "row-id",
        exercise_name: "Barbell Row",
        set_count: 3,
        total_reps: 28,
        total_volume: 1100,
      },
    ];

    const recommendationContext = createBaseRecommendationContext();
    recommendationContext.summary = {
      workout_count: 5,
      set_count: 12,
      total_reps: 88,
      total_volume: 5200,
      by_exercise: summary.by_exercise,
    };
    recommendationContext.recent_workouts = [
      {
        workout_id: "workout-1",
        performed_at: new Date(
          Date.now() - 2 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        notes: "recent chest day",
        set_count: 3,
        total_volume: 1400,
      },
    ];
    recommendationContext.evidence.workout_ids = [
      "workout-1",
      "workout-2",
      "workout-3",
      "workout-4",
      "workout-5",
    ];
    recommendationContext.evidence.set_ids = ["set-1", "set-2", "set-3"];
    recommendationContext.evidence.calculation_rules = [
      "recommendation rule",
      "volume rule",
    ];

    const snapshot = buildAssistantInsightSnapshot({
      exerciseProgress: {
        range: {
          start_date: "2026-04-09",
          end_date: "2026-05-09",
        },
        exercise: {
          exercise_id: "bench-id",
          exercise_name: "Barbell Bench Press",
        },
        totals: {
          workout_count: 3,
          set_count: 6,
          total_reps: 36,
          total_volume: 2900,
          max_weight_kg: 92.5,
          max_reps: 10,
          estimated_1rm_kg: 104.8,
        },
        sessions: [
          {
            workout_id: "workout-1",
            performed_at: new Date(
              Date.now() - 2 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            set_count: 2,
            total_reps: 9,
            total_volume: 830,
            max_weight_kg: 92.5,
            max_reps: 5,
            estimated_1rm_kg: 104.8,
            set_ids: ["set-1", "set-2"],
          },
        ],
        evidence: {
          workout_ids: ["workout-1", "workout-3", "workout-5"],
          set_ids: ["set-1", "set-2", "set-3", "set-4", "set-5", "set-6"],
          calculation_rules: ["progress rule"],
        },
      } satisfies ExerciseProgress,
      recommendationContext,
      selectedExerciseName: "Barbell Bench Press",
      summary,
    });

    expect(snapshot.cards[0]?.summary).toContain("下一次可以优先补背部或腿部");
    expect(snapshot.cards[1]?.summary).toContain("当前分布有点偏向胸推动作");
    expect(snapshot.cards[3]?.summary).toContain("当前估算最大重量");
  });
});
