import { describe, expect, it } from "vitest";

import type { AthleteProfileState } from "./athlete-profile-api";
import { classifyInjuryWithdrawalReadback } from "./injury-withdrawal-state";

function createState(
  injuryConstraints: string[] | null,
  healthConsentOnFile: boolean,
): AthleteProfileState {
  return {
    profile:
      injuryConstraints === null
        ? null
        : {
            goal: "strength",
            weeklyDays: 3,
            availableEquipment: ["barbell"],
            injuryConstraints,
            updatedAt: "2026-08-11T00:00:00.000Z",
          },
    healthConsentOnFile,
    withdrawableHealthConsent: healthConsentOnFile,
  };
}

describe("classifyInjuryWithdrawalReadback", () => {
  it("treats a missing profile as no stored injury data", () => {
    expect(classifyInjuryWithdrawalReadback(createState(null, false))).toEqual({
      kind: "withdrawn",
      healthConsentOnFile: false,
    });
  });

  it("preserves consent for other health categories after injury deletion", () => {
    expect(classifyInjuryWithdrawalReadback(createState([], true))).toEqual({
      kind: "withdrawn",
      healthConsentOnFile: true,
    });
  });

  it("reports the current stored count without claiming the deletion never ran", () => {
    expect(
      classifyInjuryWithdrawalReadback(createState(["knee", "shoulder"], true)),
    ).toEqual({
      kind: "still_stored",
      healthConsentOnFile: true,
      storedInjuryCount: 2,
    });
  });
});
