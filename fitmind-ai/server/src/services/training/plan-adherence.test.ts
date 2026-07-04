import { describe, expect, it } from "vitest";

import { computePlanAdherence } from "./plan-adherence.js";

describe("computePlanAdherence", () => {
  it("marks fully, partially, and un-trained exercises", () => {
    const summary = computePlanAdherence({
      plannedExercises: [
        { exerciseName: "Barbell Bench Press", sets: 3 },
        { exerciseName: "Barbell Squat", sets: 4 },
        { exerciseName: "Pull Up", sets: 3 },
      ],
      performedExercises: [
        { exerciseName: "Barbell Bench Press", setCount: 3 },
        { exerciseName: "Barbell Squat", setCount: 2 },
      ],
    });

    expect(summary.exercises[0]?.status).toBe("done");
    expect(summary.exercises[1]?.status).toBe("partial");
    expect(summary.exercises[2]?.status).toBe("missed");
    expect(summary.trained_exercise_count).toBe(2);
    expect(summary.planned_exercise_count).toBe(3);
  });

  it("matches exercise names case- and whitespace-insensitively", () => {
    const summary = computePlanAdherence({
      plannedExercises: [{ exerciseName: "Barbell Bench Press", sets: 3 }],
      performedExercises: [
        { exerciseName: "  barbell bench press ", setCount: 3 },
      ],
    });

    expect(summary.exercises[0]?.status).toBe("done");
    expect(summary.exercise_adherence_ratio).toBe(1);
  });

  it("caps set completion at 100% even when over-performed", () => {
    const summary = computePlanAdherence({
      plannedExercises: [{ exerciseName: "Barbell Squat", sets: 3 }],
      performedExercises: [{ exerciseName: "Barbell Squat", setCount: 6 }],
    });

    expect(summary.exercises[0]?.performed_sets).toBe(6);
    expect(summary.exercises[0]?.set_completion_ratio).toBe(1);
    expect(summary.set_adherence_ratio).toBe(1);
  });

  it("counts performed exercises that are not in the plan as extras", () => {
    const summary = computePlanAdherence({
      plannedExercises: [{ exerciseName: "Barbell Bench Press", sets: 3 }],
      performedExercises: [
        { exerciseName: "Barbell Bench Press", setCount: 3 },
        { exerciseName: "Bicep Curl", setCount: 4 },
      ],
    });

    expect(summary.extra_exercise_count).toBe(1);
  });

  it("aggregates set adherence across the plan", () => {
    const summary = computePlanAdherence({
      plannedExercises: [
        { exerciseName: "A", sets: 4 },
        { exerciseName: "B", sets: 4 },
      ],
      performedExercises: [
        { exerciseName: "A", setCount: 4 },
        { exerciseName: "B", setCount: 2 },
      ],
    });

    // (4 + 2) / (4 + 4) = 0.75
    expect(summary.set_adherence_ratio).toBe(0.75);
    expect(summary.exercise_adherence_ratio).toBe(1);
  });

  it("returns zero ratios for an empty plan without dividing by zero", () => {
    const summary = computePlanAdherence({
      plannedExercises: [],
      performedExercises: [{ exerciseName: "A", setCount: 3 }],
    });

    expect(summary.exercise_adherence_ratio).toBe(0);
    expect(summary.set_adherence_ratio).toBe(0);
    expect(summary.extra_exercise_count).toBe(1);
  });
});
