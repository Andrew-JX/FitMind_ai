import { describe, expect, it } from "vitest";

import {
  generateNextWeekPlan,
  type NextWeekPlanGeneratorInput,
} from "./next-week-plan-generator.js";

const baseInput: NextWeekPlanGeneratorInput = {
  progressionMode: "maintain",
  weakArea: null,
  topExercises: [
    { exerciseName: "Barbell Bench Press", setCount: 8 },
    { exerciseName: "Barbell Squat", setCount: 6 },
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

  it("deduplicates the focus exercise out of the top-exercise list", () => {
    const plan = generateNextWeekPlan({
      ...baseInput,
      topExercises: [
        { exerciseName: "Barbell Bench Press", setCount: 8 },
        { exerciseName: "Barbell Squat", setCount: 6 },
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
      })),
    });

    expect(plan.exercises.length).toBeLessThanOrEqual(4);
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
