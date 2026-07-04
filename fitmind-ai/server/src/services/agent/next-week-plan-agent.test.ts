import { describe, expect, it } from "vitest";

import type { RetrievedKnowledgeChunk } from "../rag/knowledge-retriever.js";
import { runNextWeekPlanAgent } from "./next-week-plan-agent.js";
import type {
  AgentStepEvent,
  NextWeekPlanAgentDeps,
  NextWeekPlanAgentInput,
} from "./react-planner-types.js";

const baseInput: NextWeekPlanAgentInput = {
  message: "帮我规划下周训练",
  startDate: "2026-06-01",
  endDate: "2026-06-07",
};

function createWeeklyResult(overrides: Record<string, unknown> = {}): unknown {
  return {
    status: "ready",
    range: { start_date: "2026-06-01", end_date: "2026-06-07" },
    totals: {
      workout_count: 4,
      set_count: 40,
      total_reps: 320,
      total_volume: 12000,
      total_weighted_volume: 12000,
    },
    frequency: { range_days: 7, workouts_per_week: 4 },
    top_exercises: [
      {
        exercise_name: "Barbell Bench Press",
        set_count: 8,
        total_volume: 4000,
        max_weight_kg: 80,
        estimated_1rm_kg: 100,
      },
    ],
    top_muscle_groups: [{ muscle_group_name: "胸", contribution_ratio: 0.4 }],
    low_volume_muscle_groups: [
      { muscle_group_name: "腿", contribution_ratio: 0.05 },
    ],
    evidence: {
      workout_ids: ["w1", "w2"],
      set_ids: ["s1"],
      calculation_rules: ["weekly_rule"],
    },
    ...overrides,
  };
}

function createRecommendationResult(): unknown {
  return {
    range: { start_date: "2026-06-01", end_date: "2026-06-07" },
    summary: {
      workout_count: 6,
      set_count: 60,
      total_reps: 480,
      total_volume: 18000,
      by_exercise: [
        { exercise_name: "Barbell Bench Press", total_volume: 5000 },
      ],
    },
    focus_exercises: [],
    recent_workouts: [],
    evidence: {
      workout_ids: ["w2", "w3"],
      set_ids: ["s2"],
      calculation_rules: ["reco_rule"],
    },
  };
}

function createProgressResult(): unknown {
  return {
    range: { start_date: "2026-06-01", end_date: "2026-06-07" },
    exercise: { exercise_id: "e1", exercise_name: "Barbell Bench Press" },
    totals: {
      workout_count: 3,
      set_count: 9,
      total_reps: 30,
      total_volume: 3000,
      max_weight_kg: 80,
      estimated_1rm_kg: 95,
    },
    sessions: [],
    evidence: {
      workout_ids: ["w1"],
      set_ids: ["s3"],
      calculation_rules: ["progress_rule"],
    },
  };
}

function createSource(id: string, title: string): RetrievedKnowledgeChunk {
  return {
    id,
    title,
    category: "progression",
    chunk_text: `${title} 内容`,
    source_type: "seed",
    tags: ["volume"],
    score: 0.9,
    retrieval_mode: "keyword",
  };
}

function createDeps(overrides: Partial<NextWeekPlanAgentDeps> = {}): {
  deps: NextWeekPlanAgentDeps;
  events: AgentStepEvent[];
} {
  const events: AgentStepEvent[] = [];
  let tick = 0;

  const deps: NextWeekPlanAgentDeps = {
    runTool: async (toolName) => {
      if (toolName === "get_weekly_training_report") {
        return createWeeklyResult();
      }

      if (toolName === "get_recommendation_context") {
        return createRecommendationResult();
      }

      if (toolName === "get_exercise_progress") {
        return createProgressResult();
      }

      return {};
    },
    retrieve: async () => [
      createSource("k1", "渐进超负荷"),
      createSource("k2", "训练容量"),
    ],
    onStep: (event) => {
      events.push(event);
    },
    now: () => {
      tick += 10;
      return tick;
    },
    ...overrides,
  };

  return { deps, events };
}

describe("runNextWeekPlanAgent", () => {
  it("runs the full ReAct loop and skips progress when no exercise is specified", async () => {
    const { deps, events } = createDeps();

    const output = await runNextWeekPlanAgent(baseInput, deps);

    expect(output.trace.stop_reason).toBe("completed");
    expect(output.trace.steps.map((step) => step.kind)).toEqual([
      "tool",
      "tool",
      "tool",
      "retrieval",
      "synthesis",
    ]);
    expect(output.trace.steps[2]?.status).toBe("skipped");
    expect(output.answer.intent).toBe("next_week_plan");
    expect(output.answer.evidence.workout_ids).toEqual(
      expect.arrayContaining(["w1", "w2", "w3"]),
    );
    expect(output.answer.evidence.workout_ids).toHaveLength(3);
    expect(output.answer.sources.map((source) => source.id)).toEqual([
      "k1",
      "k2",
    ]);
    expect(output.answer.bullets.length).toBeGreaterThan(0);

    const started = events.filter((event) => event.phase === "started");
    const finished = events.filter((event) => event.phase === "finished");
    expect(started).toHaveLength(5);
    expect(finished).toHaveLength(5);
  });

  it("derives a target weight for a non-focus top exercise from its weekly max/1RM", async () => {
    const { deps } = createDeps();

    const output = await runNextWeekPlanAgent(baseInput, deps);

    const planned = output.plan?.exercises.find(
      (exercise) => exercise.exercise_name === "Barbell Bench Press",
    );
    // hypertrophy default: 100 * 0.72 = 72 → nearest 2.5kg plate.
    expect(planned?.target_weight_kg).toBe(72.5);
    expect(planned?.basis).toContain("1RM");
  });

  it("inspects exercise progress when an exercise id is provided", async () => {
    const { deps } = createDeps();

    const output = await runNextWeekPlanAgent(
      { ...baseInput, exerciseId: "e1" },
      deps,
    );

    const progressStep = output.trace.steps[2];
    expect(progressStep?.tool_name).toBe("get_exercise_progress");
    expect(progressStep?.status).toBe("success");
    expect(output.answer.evidence.set_ids).toEqual(
      expect.arrayContaining(["s1", "s2", "s3"]),
    );
  });

  it("stops early with a no-data answer when there are no workouts", async () => {
    const { deps, events } = createDeps({
      runTool: async () =>
        createWeeklyResult({ status: "empty", totals: { workout_count: 0 } }),
    });

    const output = await runNextWeekPlanAgent(baseInput, deps);

    expect(output.trace.stop_reason).toBe("no_data");
    expect(output.trace.steps).toHaveLength(1);
    expect(output.answer.summary).toContain("还没有足够的训练记录");
    expect(events.filter((event) => event.phase === "started")).toHaveLength(1);
    expect(events.filter((event) => event.phase === "finished")).toHaveLength(
      1,
    );
  });

  it("continues to synthesis when a secondary tool fails", async () => {
    const { deps } = createDeps({
      runTool: async (toolName) => {
        if (toolName === "get_weekly_training_report") {
          return createWeeklyResult();
        }

        if (toolName === "get_recommendation_context") {
          throw new Error("reco boom");
        }

        return {};
      },
    });

    const output = await runNextWeekPlanAgent(baseInput, deps);

    expect(output.trace.stop_reason).toBe("completed");
    expect(output.trace.steps[1]?.status).toBe("error");
    expect(output.answer.intent).toBe("next_week_plan");
  });
});
