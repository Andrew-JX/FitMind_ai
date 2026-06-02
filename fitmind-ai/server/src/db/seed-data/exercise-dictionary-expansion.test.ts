import { describe, expect, it } from "vitest";

import { exerciseMuscleSeeds } from "./exercise-muscles.js";
import { exerciseSeeds } from "./exercises.js";

describe("exercise dictionary expansion seeds", () => {
  it("includes common intake exercises requested by Chinese workout logging", () => {
    const codes = new Set<string>(exerciseSeeds.map((exercise) => exercise.code));

    for (const code of [
      "shoulder_press_dumbbell",
      "seated_dumbbell_shoulder_press",
      "pull_up_bodyweight",
      "chin_up_bodyweight",
      "lateral_raise_dumbbell",
      "barbell_row",
      "dumbbell_row",
      "cable_fly",
      "leg_extension_machine",
      "leg_curl_machine",
      "hip_thrust_barbell",
      "bulgarian_split_squat",
      "hammer_curl_dumbbell",
    ]) {
      expect(codes.has(code), `${code} should exist in exercise seeds`).toBe(true);
    }
  });

  it("adds deterministic muscle-load mappings for new common movements", () => {
    const mappingKeys = new Set<string>(
      exerciseMuscleSeeds.map(
        (mapping) => `${mapping.exerciseCode}:${mapping.muscleCode}`,
      ),
    );

    for (const key of [
      "shoulder_press_dumbbell:front_delts",
      "shoulder_press_dumbbell:side_delts",
      "shoulder_press_dumbbell:triceps",
      "pull_up_bodyweight:lats",
      "pull_up_bodyweight:upper_back",
      "pull_up_bodyweight:biceps",
      "lateral_raise_dumbbell:side_delts",
      "dumbbell_row:upper_back",
      "dumbbell_row:lats",
      "dumbbell_row:biceps",
      "dumbbell_row:rear_delts",
    ]) {
      expect(mappingKeys.has(key), `${key} should exist in exercise-muscles`).toBe(
        true,
      );
    }
  });

  it("adds Chinese detail content for every exercise", () => {
    for (const exercise of exerciseSeeds) {
      expect(
        exercise.techniqueCuesZh.length,
        `${exercise.code} should include at least two technique cues`,
      ).toBeGreaterThanOrEqual(2);
      expect(
        exercise.commonMistakesZh.length,
        `${exercise.code} should include at least two common mistakes`,
      ).toBeGreaterThanOrEqual(2);
      expect(
        exercise.equipmentNotesZh.trim().length,
        `${exercise.code} should include equipment notes`,
      ).toBeGreaterThan(0);
    }
  });
});
