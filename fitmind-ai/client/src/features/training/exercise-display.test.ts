import { describe, expect, it } from "vitest";

import type {
  DictionaryExercise,
  DictionaryMuscleGroup,
} from "./dictionary-api";
import {
  getEquipmentLabel,
  getExerciseCategory,
  getExerciseDisplayName,
  getExerciseSearchText,
  getMovementPatternLabel,
  getMuscleGroupDisplayName,
} from "./exercise-display";

function createExercise(
  overrides: Partial<DictionaryExercise> = {},
): DictionaryExercise {
  return {
    code: "shoulder_press_dumbbell",
    common_mistakes_zh: ["避免耸肩", "避免后仰"],
    equipment: "dumbbell",
    equipment_notes_zh: "选择可控重量。",
    id: "exercise-1",
    movement_pattern: "vertical_push",
    muscles: [
      {
        code: "front_delts",
        contribution_weight: 1,
        is_primary: true,
      },
    ],
    name_en: "Dumbbell Shoulder Press",
    technique_cues_zh: ["核心收紧", "稳定推起"],
    name_zh: "哑铃推肩",
    ...overrides,
  };
}

describe("exercise display helpers", () => {
  it("uses Chinese exercise names and does not fall back to English names", () => {
    expect(getExerciseDisplayName(createExercise())).toBe("哑铃推肩");
    expect(getExerciseDisplayName(createExercise({ name_zh: "" }))).toBe(
      "未知动作",
    );
  });

  it("normalizes shoulder category from delt and deltoid codes", () => {
    expect(getExerciseCategory(createExercise())).toBe("肩");
    expect(
      getExerciseCategory(
        createExercise({
          muscles: [
            {
              code: "deltoids",
              contribution_weight: 0.5,
              is_primary: false,
            },
          ],
        }),
      ),
    ).toBe("肩");
  });

  it("maps raw equipment, movement, and muscle codes into Chinese labels", () => {
    const muscleGroup: DictionaryMuscleGroup = {
      code: "shoulders",
      id: "muscle-1",
      name_en: "Shoulders",
      name_zh: "鑲?",
      recovery_hours: 48,
    };

    expect(getEquipmentLabel("dumbbell")).toBe("哑铃");
    expect(getMovementPatternLabel("vertical_push")).toBe("垂直推");
    expect(getMuscleGroupDisplayName(muscleGroup)).toBe("肩");
  });

  it("keeps English searchable without making it the display label", () => {
    const searchText = getExerciseSearchText(createExercise());

    expect(searchText).toContain("dumbbell shoulder press");
    expect(searchText).toContain("哑铃推肩");
  });
});
