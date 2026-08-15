import { describe, expect, it } from "vitest";

import {
  generateNextWeekPlan,
  type NextWeekPlanGeneratorInput,
} from "./next-week-plan-generator.js";
import type {
  PlanAdherenceContext,
  PlanAdherenceExerciseContext,
} from "./react-planner-types.js";

const baseInput: NextWeekPlanGeneratorInput = {
  progressionMode: "maintain",
  weakArea: null,
  topExercises: [
    {
      exerciseName: "Barbell Bench Press",
      setCount: 8,
      estimated1RmKg: null,
      maxWeightKg: null,
    },
    {
      exerciseName: "Barbell Squat",
      setCount: 6,
      estimated1RmKg: null,
      maxWeightKg: null,
    },
  ],
  focusExercise: null,
};

const partialBenchAdherence: PlanAdherenceExerciseContext = {
  exerciseName: "Barbell Bench Press",
  plannedSets: 4,
  performedSets: 2,
  status: "partial",
  setCompletionRatio: 0.5,
  targetWeightKg: 70,
};

const partialAdherence: PlanAdherenceContext = {
  startDate: "2026-06-15",
  endDate: "2026-06-21",
  exerciseAdherenceRatio: 0.5,
  setAdherenceRatio: 0.75,
  exercises: [partialBenchAdherence],
};

describe("generateNextWeekPlan", () => {
  it("derives a plate-rounded target weight from estimated 1RM for the focus exercise", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      focusExercise: {
        exerciseName: "Barbell Bench Press",
        estimated1RmKg: 100,
        maxWeightKg: 90,
      },
    });

    const focus = plan.exercises[0];
    expect(focus?.exercise_name).toBe("Barbell Bench Press");
    // 100 * 0.72 = 72 → already a 2.5kg multiple.
    expect(focus?.target_weight_kg).toBe(72.5);
    expect(focus?.rep_min).toBe(6);
    expect(focus?.rep_max).toBe(10);
    expect(focus?.basis).toContain("1RM");
  });

  it("never fabricates a weight when there is no baseline", () => {
    const plan = generateNextWeekPlan(baseInput);

    expect(plan.exercises.length).toBeGreaterThan(0);
    for (const exercise of plan.exercises) {
      expect(exercise.target_weight_kg).toBeNull();
      expect(exercise.basis).toContain("沿用上次");
    }
  });

  it("falls back to recent max weight when 1RM is missing", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      focusExercise: {
        exerciseName: "Barbell Bench Press",
        estimated1RmKg: null,
        maxWeightKg: 81,
      },
    });

    // 81 rounds to the nearest 2.5kg plate.
    expect(plan.exercises[0]?.target_weight_kg).toBe(80);
    expect(plan.exercises[0]?.basis).toContain("最高训练重量");
  });

  it("derives a target weight for a non-focus top exercise from its estimated 1RM", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      focusExercise: null,
      topExercises: [
        {
          exerciseName: "Barbell Squat",
          setCount: 6,
          estimated1RmKg: 150,
          maxWeightKg: 130,
        },
      ],
    });

    const squat = plan.exercises[0];
    // hypertrophy default: 150 * 0.72 = 108 → nearest 2.5kg plate.
    expect(squat?.exercise_name).toBe("Barbell Squat");
    expect(squat?.target_weight_kg).toBe(107.5);
    expect(squat?.basis).toContain("1RM");
  });

  it("falls back to recent max weight for a non-focus top exercise without 1RM", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      focusExercise: null,
      topExercises: [
        {
          exerciseName: "Barbell Row",
          setCount: 5,
          estimated1RmKg: null,
          maxWeightKg: 71,
        },
      ],
    });

    expect(plan.exercises[0]?.target_weight_kg).toBe(70);
    expect(plan.exercises[0]?.basis).toContain("最高训练重量");
  });

  it("keeps the target null for a bodyweight exercise whose only baseline is zero", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      focusExercise: {
        exerciseName: "Pull Up",
        estimated1RmKg: 0,
        maxWeightKg: 0,
      },
    });

    expect(plan.exercises[0]?.exercise_name).toBe("Pull Up");
    expect(plan.exercises[0]?.target_weight_kg).toBeNull();
    expect(plan.exercises[0]?.basis).toContain("沿用上次");
  });

  it("rounds the estimated 1RM shown in basis copy to one decimal (no float tail)", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      focusExercise: null,
      topExercises: [
        {
          exerciseName: "Barbell Squat",
          setCount: 6,
          estimated1RmKg: 110.83333333333333,
          maxWeightKg: 100,
        },
      ],
    });

    const basis = plan.exercises[0]?.basis ?? "";
    expect(basis).toContain("110.8 kg");
    expect(basis).not.toMatch(/\d\.\d{2,}/);
  });

  it("deduplicates the focus exercise out of the top-exercise list", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      topExercises: [
        {
          exerciseName: "Barbell Bench Press",
          setCount: 8,
          estimated1RmKg: null,
          maxWeightKg: null,
        },
        {
          exerciseName: "Barbell Squat",
          setCount: 6,
          estimated1RmKg: null,
          maxWeightKg: null,
        },
      ],
      focusExercise: {
        exerciseName: "Barbell Bench Press",
        estimated1RmKg: 120,
        maxWeightKg: 100,
      },
    });

    const names = plan.exercises.map((exercise) => exercise.exercise_name);
    expect(names.filter((name) => name === "Barbell Bench Press")).toHaveLength(
      1,
    );
  });

  it("caps the expanded weekly plan at twelve exercises", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      topExercises: Array.from({ length: 8 }, (_, index) => ({
        exerciseName: `Exercise ${index}`,
        setCount: 5,
        estimated1RmKg: null,
        maxWeightKg: null,
      })),
    });

    expect(plan.exercises.length).toBeLessThanOrEqual(12);
  });

  it("switches to the strength rep/intensity scheme from the profile goal", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      focusExercise: {
        exerciseName: "Barbell Bench Press",
        estimated1RmKg: 100,
        maxWeightKg: 90,
      },
      profile: { goal: "strength", weeklyDays: 4, injuryConstraints: [] },
    });

    const focus = plan.exercises[0];
    // strength: 3-6 reps @ 85% → 100 * 0.85 = 85.
    expect(focus?.rep_min).toBe(3);
    expect(focus?.rep_max).toBe(6);
    expect(focus?.target_weight_kg).toBe(85);
  });

  it("keeps the hypertrophy default when no profile is provided", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      focusExercise: {
        exerciseName: "Barbell Bench Press",
        estimated1RmKg: 100,
        maxWeightKg: 90,
      },
    });

    expect(plan.exercises[0]?.rep_max).toBe(10);
    expect(plan.exercises[0]?.target_weight_kg).toBe(72.5);
  });

  it("injects injury and weekly-day notes from the profile", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      profile: {
        goal: "hypertrophy",
        weeklyDays: 3,
        injuryConstraints: ["knee", "shoulder"],
      },
    });

    expect(plan.notes.some((note) => note.includes("knee"))).toBe(true);
    expect(plan.notes.some((note) => note.includes("shoulder"))).toBe(true);
    expect(plan.notes.some((note) => note.includes("3 个灵活训练日"))).toBe(
      true,
    );
  });

  it("uses more working sets when adding frequency, and surfaces the weak area", () => {
    const consolidate = generateNextWeekPlan({
      ...baseInput,
      progressionMode: "consolidate",
    });
    const addFrequency = generateNextWeekPlan({
      ...baseInput,
      progressionMode: "add_frequency",
      weakArea: "腿",
    });

    expect(consolidate.exercises[0]?.sets).toBe(3);
    expect(addFrequency.exercises[0]?.sets).toBe(4);
    expect(addFrequency.strategy).toBe("add_frequency");
    expect(addFrequency.notes.some((note) => note.includes("腿"))).toBe(true);
  });

  it("leaves the generated plan unchanged when no adherence context is provided", () => {
    const withoutContext = generateNextWeekPlan({
      ...baseInput,
      progressionMode: "add_frequency",
      focusExercise: {
        exerciseName: "Barbell Bench Press",
        estimated1RmKg: 100,
        maxWeightKg: 90,
      },
    });
    const withNullContext = generateNextWeekPlan({
      ...baseInput,
      progressionMode: "add_frequency",
      focusExercise: {
        exerciseName: "Barbell Bench Press",
        estimated1RmKg: 100,
        maxWeightKg: 90,
      },
      planAdherence: null,
    });

    expect(withNullContext).toEqual(withoutContext);
  });

  it("keeps done exercises on the normal progression path", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      focusExercise: {
        exerciseName: "Barbell Bench Press",
        estimated1RmKg: 100,
        maxWeightKg: 90,
      },
      planAdherence: {
        ...partialAdherence,
        setAdherenceRatio: 1,
        exercises: [
          {
            ...partialBenchAdherence,
            performedSets: 4,
            status: "done",
            setCompletionRatio: 1,
          },
        ],
      },
    });

    expect(plan.strategy).toBe("maintain");
    expect(plan.exercises[0]?.sets).toBe(3);
    expect(plan.exercises[0]?.target_weight_kg).toBe(72.5);
    expect(plan.exercises[0]?.basis).toContain("1RM");
  });

  it("caps partial exercises at the adjusted base sets and previous target weight", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      progressionMode: "add_frequency",
      focusExercise: {
        exerciseName: "Barbell Bench Press",
        estimated1RmKg: 120,
        maxWeightKg: 100,
      },
      planAdherence: partialAdherence,
    });

    const bench = plan.exercises[0];
    expect(plan.strategy).toBe("maintain");
    expect(bench?.sets).toBe(3);
    expect(bench?.target_weight_kg).toBe(70);
    expect(bench?.basis).toContain("完成 2/4 组");
  });

  it("reduces missed exercises by one set and keeps null targets null", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      focusExercise: {
        exerciseName: "Barbell Bench Press",
        estimated1RmKg: 100,
        maxWeightKg: 90,
      },
      planAdherence: {
        ...partialAdherence,
        exercises: [
          {
            ...partialBenchAdherence,
            plannedSets: 3,
            performedSets: 0,
            status: "missed",
            setCompletionRatio: 0,
            targetWeightKg: null,
          },
        ],
      },
    });

    const bench = plan.exercises[0];
    expect(bench?.sets).toBe(2);
    expect(bench?.target_weight_kg).toBeNull();
    expect(bench?.basis).toContain("未完成");
  });

  it("carries partial and missed exercises forward before unmatched top exercises", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      focusExercise: {
        exerciseName: "Barbell Bench Press",
        estimated1RmKg: 100,
        maxWeightKg: 90,
      },
      planAdherence: {
        ...partialAdherence,
        exercises: [
          {
            exerciseName: "Barbell Row",
            plannedSets: 4,
            performedSets: 2,
            status: "partial",
            setCompletionRatio: 0.5,
            targetWeightKg: 60,
          },
        ],
      },
    });

    expect(plan.exercises.map((exercise) => exercise.exercise_name)).toEqual([
      "Barbell Bench Press",
      "Barbell Row",
      "Barbell Squat",
    ]);
    expect(plan.exercises[1]?.target_weight_kg).toBe(60);
  });

  it("keeps low-adherence missed plans non-empty and non-degenerate", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      progressionMode: "add_frequency",
      planAdherence: {
        ...partialAdherence,
        setAdherenceRatio: 0.25,
        exercises: [
          {
            ...partialBenchAdherence,
            plannedSets: 2,
            performedSets: 0,
            status: "missed",
            setCompletionRatio: 0,
          },
        ],
      },
    });

    expect(plan.strategy).toBe("consolidate");
    expect(plan.exercises.length).toBeGreaterThan(0);
    expect(plan.exercises.some((exercise) => exercise.sets > 1)).toBe(true);
    expect(plan.exercises.every((exercise) => exercise.sets >= 1)).toBe(true);
  });

  it("hard-filters the catalog by this week's equipment and known injury risks", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      topExercises: [],
      profile: {
        goal: "general_fitness",
        weeklyDays: 2,
        availableEquipment: ["bodyweight"],
        injuryConstraints: ["knee"],
      },
      preferences: {
        weeklyDays: 2,
        sessionDurationMinutes: 30,
        availableEquipment: ["bodyweight"],
      },
      exerciseCatalog: [
        catalogExercise(1, "俯卧撑", "bodyweight", "horizontal_push", [
          "chest",
        ]),
        catalogExercise(2, "自重深蹲", "bodyweight", "squat", ["quads"]),
        catalogExercise(3, "杠铃卧推", "barbell", "horizontal_push", ["chest"]),
        catalogExercise(4, "平板支撑", "bodyweight", "anti_extension", [
          "core",
        ]),
        catalogExercise(5, "反手引体", "bodyweight", "vertical_pull", ["back"]),
        catalogExercise(6, "俯身 Y 举", "bodyweight", "shoulder_flexion", [
          "shoulders",
        ]),
      ],
    });

    expect(plan.exercises.length).toBeGreaterThan(0);
    expect(
      plan.exercises.every((exercise) => exercise.equipment === "bodyweight"),
    ).toBe(true);
    expect(
      plan.exercises.map((exercise) => exercise.exercise_name),
    ).not.toContain("自重深蹲");
    expect(
      plan.exercises.map((exercise) => exercise.exercise_name),
    ).not.toContain("杠铃卧推");
  });

  it("builds a weight-safe starter plan and real session groups without history", () => {
    const catalog = Array.from({ length: 8 }, (_, index) =>
      catalogExercise(
        index + 1,
        `动作 ${index + 1}`,
        "dumbbell",
        index % 2 === 0 ? "horizontal_push" : "horizontal_pull",
        [index % 2 === 0 ? "chest" : "back"],
      ),
    );
    const plan = generateNextWeekPlan({
      ...baseInput,
      topExercises: [],
      profile: {
        goal: "hypertrophy",
        weeklyDays: 3,
        availableEquipment: ["dumbbell"],
        injuryConstraints: [],
      },
      preferences: { weeklyDays: 3, sessionDurationMinutes: 45 },
      exerciseCatalog: catalog,
    });

    expect(plan.sessions).toHaveLength(3);
    expect(plan.sessions?.map((session) => session.session_index)).toEqual([
      1, 2, 3,
    ]);
    expect(
      plan.exercises.every((exercise) => exercise.target_weight_kg === null),
    ).toBe(true);
    expect(
      plan.sessions
        ?.flatMap((session) => session.exercises)
        .map((exercise) => exercise.exercise_name)
        .sort(),
    ).toEqual(plan.exercises.map((exercise) => exercise.exercise_name).sort());
    expect(
      plan.sessions?.every((session) =>
        session.exercises.every((exercise) => (exercise.rest_seconds ?? 0) > 0),
      ),
    ).toBe(true);
  });

  it("uses temporary days, duration, focus and fatigue without mutating profile defaults", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      topExercises: [],
      progressionMode: "add_frequency",
      profile: {
        goal: "hypertrophy",
        weeklyDays: 5,
        availableEquipment: ["dumbbell"],
        injuryConstraints: [],
      },
      preferences: {
        weeklyDays: 2,
        sessionDurationMinutes: 30,
        readiness: "fatigued",
        focusAreas: ["core"],
      },
      exerciseCatalog: [
        catalogExercise(1, "哑铃卧推", "dumbbell", "horizontal_push", [
          "chest",
        ]),
        catalogExercise(2, "俄罗斯转体", "dumbbell", "rotation", ["core"]),
        catalogExercise(3, "哑铃划船", "dumbbell", "horizontal_pull", ["back"]),
        catalogExercise(4, "哑铃弯举", "dumbbell", "elbow_flexion", ["biceps"]),
        catalogExercise(5, "哑铃侧平举", "dumbbell", "shoulder_abduction", [
          "shoulders",
        ]),
        catalogExercise(6, "哑铃硬拉", "dumbbell", "hinge", ["hamstrings"]),
      ],
    });

    expect(plan.strategy).toBe("consolidate");
    expect(plan.sessions).toHaveLength(2);
    expect(plan.exercises[0]?.exercise_name).toBe("俄罗斯转体");
    expect(plan.notes.some((note) => note.includes("30 分钟"))).toBe(true);
  });
});

function catalogExercise(
  index: number,
  exerciseName: string,
  equipment: string,
  movementPattern: string,
  primaryMuscles: string[],
) {
  return {
    exerciseId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    exerciseName,
    equipment,
    movementPattern,
    primaryMuscles,
    defaultRestSeconds: 90,
  };
}
