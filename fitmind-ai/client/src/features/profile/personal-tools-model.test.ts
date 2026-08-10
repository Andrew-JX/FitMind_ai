import { describe, expect, it } from "vitest";

import {
  buildRmLoadTable,
  calculateEpleyOneRepMax,
  convertWeight,
  groupConsecutiveDates,
} from "./personal-tools-model";

describe("personal tools model", () => {
  it("calculates Epley 1RM and rounded percentage loads", () => {
    expect(calculateEpleyOneRepMax(80, 8)).toBeCloseTo(101.333, 3);
    expect(buildRmLoadTable(101.333).at(-1)).toEqual({
      percentage: 100,
      weight: 101.5,
    });
  });

  it("converts kg and jin without changing the stored kg meaning", () => {
    expect(convertWeight(70, "kg", "jin")).toBe(140);
    expect(convertWeight(140, "jin", "kg")).toBe(70);
  });

  it("groups consecutive menstrual dates into readable ranges", () => {
    expect(
      groupConsecutiveDates(["2026-08-03", "2026-08-04", "2026-08-06"]),
    ).toEqual(["08-03 – 08-04", "08-06"]);
  });
});
