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
export async function getAthleteProfile(
  token: string | null,
): Promise<AthleteProfile | null> {
  const data = await requestJson<{ profile: AthleteProfile | null }>(
    "/api/athlete-profile",
    { token },
  );

  return data.profile;
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
