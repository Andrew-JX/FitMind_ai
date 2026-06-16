import { describe, expect, it } from "vitest";

import {
  generateNextWeekPlan,
  type NextWeekPlanGeneratorInput,
} from "./next-week-plan-generator.js";

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
    expect(names.filter((name) => name === "Barbell Bench Press")).toHaveLength(1);
  });

  it("caps the plan at four exercises", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      topExercises: Array.from({ length: 8 }, (_, index) => ({
        exerciseName: `Exercise ${index}`,
        setCount: 5,
        estimated1RmKg: null,
        maxWeightKg: null,
      })),
    });

    expect(plan.exercises.length).toBeLessThanOrEqual(4);
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
    expect(plan.notes.some((note) => note.includes("每周 3 天"))).toBe(true);
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
});
