import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db/repositories/index.js", () => ({
  listMuscleGroups: vi.fn(),
  searchExercises: vi.fn(),
}));

import { searchExercises } from "../../db/repositories/index.js";
import { searchDictionaryExercises } from "./dictionary-service.js";

const mockedSearchExercises = vi.mocked(searchExercises);

describe("dictionary-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps Chinese exercise detail fields into the dictionary API payload", async () => {
    mockedSearchExercises.mockResolvedValueOnce([
      {
        code: "bench_press_barbell",
        commonMistakesZh: ["避免肩膀前顶", "避免弹起重量"],
        equipment: "barbell",
        equipmentNotesZh: "使用杠铃时先确认握距和杠铃路径稳定。",
        id: "11111111-1111-4111-8111-111111111111",
        movementPattern: "horizontal_push",
        muscles: [
          {
            code: "chest",
            contributionWeight: 1,
            isPrimary: true,
          },
        ],
        nameEn: "Barbell Bench Press",
        nameZh: "杠铃卧推",
        techniqueCuesZh: ["肩胛保持稳定", "下降阶段控制速度"],
      },
    ]);

    const result = await searchDictionaryExercises({ q: "卧推" });

    expect(result.items[0]).toMatchObject({
      code: "bench_press_barbell",
      common_mistakes_zh: ["避免肩膀前顶", "避免弹起重量"],
      equipment_notes_zh: "使用杠铃时先确认握距和杠铃路径稳定。",
      technique_cues_zh: ["肩胛保持稳定", "下降阶段控制速度"],
    });
  });
});
