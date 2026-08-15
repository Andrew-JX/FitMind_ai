import { describe, expect, it } from "vitest";

import type { AssistantPlanDraft } from "./assistant-types";
import {
  deletePlanExercise,
  replacePlanExercise,
  updatePlanExercise,
} from "./assistant-plan-editor";

const plan: AssistantPlanDraft = {
  strategy: "maintain",
  exercises: [exercise("深蹲"), exercise("卧推")],
  sessions: [
    {
      sessionIndex: 1,
      title: "训练日 1",
      focusAreas: ["legs"],
      estimatedDurationMinutes: 30,
      exercises: [exercise("深蹲")],
    },
    {
      sessionIndex: 2,
      title: "训练日 2",
      focusAreas: ["chest"],
      estimatedDurationMinutes: 30,
      exercises: [exercise("卧推")],
    },
  ],
  notes: [],
};

describe("assistant plan editor", () => {
  it("keeps sessions and the flat adherence list synchronized after edits", () => {
    const result = updatePlanExercise(plan, 1, 0, {
      sets: 4,
      repMin: 8,
      repMax: 12,
      restSeconds: 120,
    });

    expect(result.sessions?.[0]?.exercises[0]).toMatchObject({
      sets: 4,
      repMin: 8,
      repMax: 12,
      restSeconds: 120,
    });
    expect(result.exercises[0]).toMatchObject({ sets: 4, restSeconds: 120 });
  });

  it("deletes an exercise from both structures and removes an empty day", () => {
    const result = deletePlanExercise(plan, 1, 0);

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions?.[0]?.title).toBe("训练日 1");
    expect(result.exercises.map((item) => item.exerciseName)).toEqual(["卧推"]);
  });

  it("replaces only with the chosen generated alternative and clears invented load", () => {
    const result = replacePlanExercise(plan, 2, 0, {
      exerciseId: "00000000-0000-4000-8000-000000000003",
      exerciseName: "哑铃卧推",
      equipment: "dumbbell",
      movementPattern: "horizontal_push",
      primaryMuscles: ["chest"],
      restSeconds: 90,
    });

    expect(result.exercises[1]).toMatchObject({
      exerciseName: "哑铃卧推",
      targetWeightKg: null,
      equipment: "dumbbell",
      restSeconds: 90,
    });
  });
});

function exercise(exerciseName: string) {
  return {
    exerciseName,
    sets: 3,
    repMin: 6,
    repMax: 10,
    targetWeightKg: 50,
    restSeconds: 90,
    equipment: "barbell",
    movementPattern: "horizontal_push",
    primaryMuscles: ["chest"],
    alternatives: [],
    basis: "测试基线",
  };
}
