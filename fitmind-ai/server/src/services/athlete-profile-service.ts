import { z } from "zod";

import {
  getAthleteProfileByUserId,
  upsertAthleteProfile,
  type AthleteProfileRow,
} from "../db/athlete-profile-repository.js";

/** Training goals drive the rep/intensity scheme injected into the planner. */
export const TRAINING_GOALS = [
  "strength",
  "hypertrophy",
  "endurance",
  "general_fitness",
] as const;
export type TrainingGoal = (typeof TRAINING_GOALS)[number];

/** Controlled equipment vocabulary (kept small and explicit). */
export const AVAILABLE_EQUIPMENT = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "kettlebell",
] as const;
export type Equipment = (typeof AVAILABLE_EQUIPMENT)[number];

/** Upper bounds on the free-form injury tag list. */
const MAX_INJURY_TAGS = 10;
const MAX_INJURY_TAG_LENGTH = 40;

export interface AthleteProfileDto {
  goal: TrainingGoal;
  weeklyDays: number;
  availableEquipment: Equipment[];
  injuryConstraints: string[];
  updatedAt: string;
}

export const athleteProfileInputSchema = z
  .object({
    goal: z.enum(TRAINING_GOALS),
    weeklyDays: z.number().int().min(1).max(7),
    availableEquipment: z
      .array(z.enum(AVAILABLE_EQUIPMENT))
      .max(AVAILABLE_EQUIPMENT.length),
    injuryConstraints: z
      .array(z.string().trim().min(1).max(MAX_INJURY_TAG_LENGTH))
      .max(MAX_INJURY_TAGS),
  })
  .strict();

export type AthleteProfileInput = z.infer<typeof athleteProfileInputSchema>;

interface AthleteProfileDependencies {
  getByUserId: typeof getAthleteProfileByUserId;
  upsert: typeof upsertAthleteProfile;
}

const defaultDependencies: AthleteProfileDependencies = {
  getByUserId: getAthleteProfileByUserId,
  upsert: upsertAthleteProfile,
};

/**
 * Returns the athlete profile for a user, or null when none has been saved.
 *
 * @param userId - Owner user id
 * @param dependencies - Injectable repository functions (for tests)
 * @returns The profile DTO, or null
 */
export async function getAthleteProfile(
  userId: string,
  dependencies: AthleteProfileDependencies = defaultDependencies,
): Promise<AthleteProfileDto | null> {
  const row = await dependencies.getByUserId(userId);

  return row === null ? null : mapProfileRow(row);
}

/**
 * Validates and saves (upserts) the athlete profile for a user.
 *
 * @param userId - Owner user id
 * @param input - Profile fields (already-parsed shape; normalized here)
 * @param dependencies - Injectable repository functions (for tests)
 * @returns The persisted profile DTO
 */
export async function saveAthleteProfile(
  userId: string,
  input: AthleteProfileInput,
  dependencies: AthleteProfileDependencies = defaultDependencies,
): Promise<AthleteProfileDto> {
  const row = await dependencies.upsert({
    userId,
    goal: input.goal,
    weeklyDays: input.weeklyDays,
    availableEquipment: dedupe(input.availableEquipment),
    injuryConstraints: dedupe(
      input.injuryConstraints.map((tag) => tag.trim().toLowerCase()),
    ),
  });

  return mapProfileRow(row);
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function mapProfileRow(row: AthleteProfileRow): AthleteProfileDto {
  return {
    goal: normalizeGoal(row.goal),
    weeklyDays: row.weekly_days,
    availableEquipment: normalizeEquipment(row.available_equipment),
    injuryConstraints: row.injury_constraints,
    updatedAt: row.updated_at,
  };
}

function normalizeGoal(value: string): TrainingGoal {
  return isTrainingGoal(value) ? value : "general_fitness";
}

function isTrainingGoal(value: string): value is TrainingGoal {
  return (TRAINING_GOALS as readonly string[]).includes(value);
}

function normalizeEquipment(values: string[]): Equipment[] {
  return values.filter((value): value is Equipment =>
    (AVAILABLE_EQUIPMENT as readonly string[]).includes(value),
  );
}
