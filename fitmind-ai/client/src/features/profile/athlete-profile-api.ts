import { requestJson } from "../../services/http-client";

export const TRAINING_GOALS = [
  "strength",
  "hypertrophy",
  "endurance",
  "general_fitness",
] as const;
export type TrainingGoal = (typeof TRAINING_GOALS)[number];

export const EQUIPMENT_OPTIONS = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "kettlebell",
] as const;
export type Equipment = (typeof EQUIPMENT_OPTIONS)[number];

/** Mirrors the server bounds on the free-form injury tag list. */
const MAX_INJURY_TAGS = 10;
const MAX_INJURY_TAG_LENGTH = 40;

export interface AthleteProfile {
  goal: TrainingGoal;
  weeklyDays: number;
  availableEquipment: Equipment[];
  injuryConstraints: string[];
  updatedAt: string;
}

export interface AthleteProfileInput {
  goal: TrainingGoal;
  weeklyDays: number;
  availableEquipment: Equipment[];
  injuryConstraints: string[];
  /**
   * Art. 29 consent for the injury constraints, required by the server
   * whenever the list is non-empty and no consent is already on file for the
   * current policy version.
   */
  sensitiveHealthConsent?:
    | { accepted: boolean; policy_version: string }
    | undefined;
}

/**
 * Parses a free-form injury input string into a clean tag list (split on commas
 * / spaces, trimmed, lowercased, de-duplicated, and capped).
 *
 * @param input - Raw user text such as "膝盖, 肩"
 * @returns The normalized injury tag list
 */
export function parseInjuryTags(input: string): string[] {
  const parts = input
    .split(/[,，、\s]+/u)
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0)
    .map((tag) => tag.slice(0, MAX_INJURY_TAG_LENGTH));

  return [...new Set(parts)].slice(0, MAX_INJURY_TAGS);
}

/**
 * Loads the athlete profile, or null when none has been saved.
 *
 * @param token - In-memory auth token
 * @returns The profile, or null
 */
export interface AthleteProfileState {
  profile: AthleteProfile | null;
  /**
   * Whether the user already consented to health-data processing under the
   * current policy version, so the form knows whether to ask.
   */
  healthConsentOnFile: boolean;
  /**
   * Whether any live health consent exists, at any policy version, and so
   * whether there is a permission the user could withdraw.
   *
   * @remarks
   * Not the same question as `healthConsentOnFile`, and the difference is
   * load-bearing: a consent to superseded wording does not let the form skip
   * asking, but it is still a standing permission the user is entitled to take
   * back. Driving the withdrawal control off `healthConsentOnFile` hid it from
   * exactly those users.
   */
  withdrawableHealthConsent: boolean;
}

export async function getAthleteProfile(
  token: string | null,
): Promise<AthleteProfileState> {
  const data = await requestJson<{
    profile: AthleteProfile | null;
    health_consent_on_file: boolean;
    withdrawable_health_consent: boolean;
  }>("/api/athlete-profile", { token });

  return {
    profile: data.profile,
    healthConsentOnFile: data.health_consent_on_file,
    withdrawableHealthConsent: data.withdrawable_health_consent,
  };
}

/**
 * Deletes only the stored injury constraints, leaving the rest of the profile.
 *
 * @param token - In-memory auth token, when the caller holds one
 * @returns Resolves once the sensitive health data is gone
 *
 * @remarks
 * The withdrawal path for the one sensitive category this app stores. Callable
 * while the health-data consent is outstanding — without it, a user who
 * declines can only consent anyway, log out while the data stays stored, or
 * delete their whole account including years of training history.
 *
 * The token is optional because the catch-up screen calls this before the app
 * shell exists and relies on the session cookie. Inside the profile sheet the
 * token is available and passed, matching every other call on this page.
 */
export async function withdrawInjuryConstraints(
  token?: string | null,
): Promise<unknown> {
  return requestJson<unknown>("/api/athlete-profile/injury-constraints", {
    method: "DELETE",
    token,
  });
}

/**
 * Validates and saves (upserts) the athlete profile.
 *
 * @param token - In-memory auth token
 * @param input - The profile fields to persist
 * @returns The persisted profile
 */
export async function saveAthleteProfile(
  token: string | null,
  input: AthleteProfileInput,
): Promise<AthleteProfile> {
  const data = await requestJson<
    { profile: AthleteProfile },
    AthleteProfileInput
  >("/api/athlete-profile", { method: "PUT", body: input, token });

  return data.profile;
}
