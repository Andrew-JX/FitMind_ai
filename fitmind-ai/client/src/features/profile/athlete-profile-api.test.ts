import { describe, expect, it } from "vitest";

import { parseInjuryTags } from "./athlete-profile-api";

describe("parseInjuryTags", () => {
  it("splits on commas and whitespace, trims, lowercases, and dedupes", () => {
    expect(parseInjuryTags("膝盖, 肩  Knee，knee")).toEqual([
      "膝盖",
      "肩",
      "knee",
    ]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseInjuryTags("   ")).toEqual([]);
  });

  it("caps the number of tags at 10", () => {
    const input = Array.from({ length: 15 }, (_, index) => `t${index}`).join(
      ",",
    );

    expect(parseInjuryTags(input)).toHaveLength(10);
  });

  it("truncates an overly long tag to 40 characters", () => {
    const longTag = "a".repeat(60);

    expect(parseInjuryTags(longTag)[0]).toHaveLength(40);
  });
});
