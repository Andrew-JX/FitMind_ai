import type { AthleteProfileState } from "./athlete-profile-api";

export type InjuryWithdrawalReadback =
  | { kind: "withdrawn"; healthConsentOnFile: boolean }
  | {
      kind: "still_stored";
      healthConsentOnFile: boolean;
      storedInjuryCount: number;
    };

/** Classify a post-withdrawal server read without making claims about history. */
export function classifyInjuryWithdrawalReadback(
  state: AthleteProfileState,
): InjuryWithdrawalReadback {
  const storedInjuryCount = state.profile?.injuryConstraints.length ?? 0;

  if (storedInjuryCount === 0) {
    return {
      kind: "withdrawn",
      healthConsentOnFile: state.healthConsentOnFile,
    };
  }

  return {
    kind: "still_stored",
    healthConsentOnFile: state.healthConsentOnFile,
    storedInjuryCount,
  };
}
