import { z } from "zod";

import {
  getAthleteProfileByUserId,
  type AthleteProfileRow,
} from "../db/athlete-profile-repository.js";
import {
  saveProfileWithHealthConsent,
  withdrawSensitiveHealthData,
} from "../db/user-health-data-repository.js";
import { CURRENT_PRIVACY_POLICY_VERSION } from "./auth/consent-service.js";
import { HttpError } from "../utils/http-error.js";

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
    // Art. 29 consent, required only when injury constraints are actually
    // being stored. Optional in the shape because a profile without them
    // stores no sensitive information and needs no separate consent; whether
    // it was required is decided below, not here.
    sensitiveHealthConsent: z
      .object({
        accepted: z.boolean(),
        policy_version: z.string().trim().min(1),
      })
      .optional(),
  })
  .strict();

export type AthleteProfileInput = z.infer<typeof athleteProfileInputSchema>;

interface AthleteProfileDependencies {
  getByUserId: typeof getAthleteProfileByUserId;
  saveWithConsent: typeof saveProfileWithHealthConsent;
}

const defaultDependencies: AthleteProfileDependencies = {
  getByUserId: getAthleteProfileByUserId,
  saveWithConsent: saveProfileWithHealthConsent,
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
 * @throws HttpError 422 CONSENT_REQUIRED when injury constraints are supplied
 *   without the separate health-data consent art. 29 requires
 *
 * @remarks
 * The consent check runs on the normalized list, after trimming and deduping,
 * so a payload whose injury tags all collapse to nothing is treated as the
 * empty list it effectively is rather than demanding consent for storing
 * nothing.
 *
 * The check and the write are handed to the repository as one unit rather than
 * being sequenced here. Doing it here meant two connections: the consent read
 * could see a live consent, a withdrawal could commit in the gap, and the
 * upsert would then restore injury data no live consent covered. The decision
 * has to be made under the same lock as the write, and only the repository can
 * hold that.
 */
export async function saveAthleteProfile(
  userId: string,
  input: AthleteProfileInput,
  dependencies: AthleteProfileDependencies = defaultDependencies,
): Promise<AthleteProfileDto> {
  const injuryConstraints = dedupe(
    input.injuryConstraints.map((tag) => tag.trim().toLowerCase()),
  );

  const result = await dependencies.saveWithConsent({
    userId,
    goal: input.goal,
    weeklyDays: input.weeklyDays,
    availableEquipment: dedupe(input.availableEquipment),
    injuryConstraints,
    policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    ...(input.sensitiveHealthConsent === undefined
      ? {}
      : { consentDecision: input.sensitiveHealthConsent }),
  });

  if (result.status === "consent_missing") {
    throw new HttpError(
      422,
      "CONSENT_REQUIRED",
      "Storing injury constraints requires separate consent to processing sensitive health information.",
      { consent_type: "sensitive_health_data" },
    );
  }

  if (result.status === "consent_stale") {
    throw new HttpError(
      422,
      "CONSENT_REQUIRED",
      "The privacy policy has changed since this page was loaded. Reload and read the current version before consenting.",
      {
        consent_type: "sensitive_health_data",
        expected_policy_version: CURRENT_PRIVACY_POLICY_VERSION,
      },
    );
  }

  return mapProfileRow(result.row);
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

/**
 * Deletes injury constraints and re-evaluates the shared health consent in one
 * transaction.
 *
 * @param userId - Owner user id
 * @param withdraw - Injectable repository function (for tests)
 * @returns Resolves once the injury constraints are deleted
 *
 * @remarks
 * The consent is revoked only when no other supported health record remains.
 * Menstrual and body-measurement tools share the same consent category, so an
 * injury-only delete must leave their lawful basis intact.
 *
 * Both writes commit together. As two separate statements, a failure in between
 * deleted the data, left the consent live, and returned an error — telling the
 * user nothing had changed when their sensitive data was already gone.
 *
 * @remarks
 * The third option this seam was missing. A user who declined the art. 29
 * health-data consent previously had only bad choices: agree anyway, log out
 * while the data stayed put, or delete the whole account including years of
 * training history. None of those is the withdrawal art. 15 requires, and the
 * last one is the "refuse service over an unrelated consent" that art. 16
 * prohibits.
 *
 * Removing the data settles the debt by removing its subject: once no injury
 * constraints are stored, `getPendingConsents` stops asking, because there is
 * no longer any sensitive information being processed to ask about.
 */
export async function withdrawInjuryConstraints(
  userId: string,
  withdraw: typeof withdrawSensitiveHealthData = withdrawSensitiveHealthData,
): Promise<void> {
  await withdraw(userId);
}
