import { z } from "zod";

import {
  createTrainingMemo,
  deleteAllBodyMeasurements,
  deleteAllSensitiveHealthData,
  deleteBodyMeasurement,
  deleteMenstrualRecords,
  deleteTrainingMemo,
  getMenstrualOverview,
  listBodyMeasurements,
  listTrainingMemos,
  saveBodyMeasurement,
  setMenstrualDate,
  updateMenstrualSettings,
  updateTrainingMemo,
  type BodyMeasurementRow,
  type SensitiveWriteResult,
  type TrainingMemoRow,
} from "../db/personal-tools-repository.js";
import { getHealthConsentFlags } from "./auth/consent-service.js";
import { CURRENT_PRIVACY_POLICY_VERSION } from "./auth/consent-service.js";
import { HttpError } from "../utils/http-error.js";

interface BodyMeasurementValues {
  weightKg: number | null;
  targetWeightKg: number | null;
  bodyFatPercent: number | null;
  neckCm: number | null;
  shoulderCm: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  leftUpperArmCm: number | null;
  rightUpperArmCm: number | null;
  leftThighCm: number | null;
  rightThighCm: number | null;
  leftCalfCm: number | null;
  rightCalfCm: number | null;
}

interface BodyMeasurementDto extends BodyMeasurementValues {
  id: string;
  measuredOn: string;
  createdAt: string;
  updatedAt: string;
}

interface TrainingMemoDto {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine(isValidIsoDate, "Date must be a real calendar date.");

export const monthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/u),
});

const healthConsentSchema = z
  .object({
    accepted: z.boolean(),
    policy_version: z.string().trim().min(1),
  })
  .optional();

export const setMenstrualDateSchema = z
  .object({
    isPeriod: z.boolean(),
    sensitiveHealthConsent: healthConsentSchema,
  })
  .strict();

export const menstrualDateParamSchema = z.object({ date: isoDateSchema });

export const menstrualSettingsSchema = z
  .object({ showInHistory: z.boolean() })
  .strict();

const bodyValueSchema = z.number().positive().max(500).nullable().optional();
const bodyFatSchema = z.number().min(1).max(80).nullable().optional();

export const saveBodyMeasurementSchema = z
  .object({
    measuredOn: isoDateSchema,
    weightKg: bodyValueSchema,
    targetWeightKg: bodyValueSchema,
    bodyFatPercent: bodyFatSchema,
    neckCm: bodyValueSchema,
    shoulderCm: bodyValueSchema,
    chestCm: bodyValueSchema,
    waistCm: bodyValueSchema,
    hipCm: bodyValueSchema,
    leftUpperArmCm: bodyValueSchema,
    rightUpperArmCm: bodyValueSchema,
    leftThighCm: bodyValueSchema,
    rightThighCm: bodyValueSchema,
    leftCalfCm: bodyValueSchema,
    rightCalfCm: bodyValueSchema,
    sensitiveHealthConsent: healthConsentSchema,
  })
  .strict()
  .refine(
    (input) => BODY_KEYS.some((key) => input[key] != null),
    "At least one body measurement is required.",
  );

export const idParamSchema = z.object({ id: z.string().uuid() });

export const createTrainingMemoSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    content: z.string().trim().min(1).max(4000),
    isPinned: z.boolean().optional(),
  })
  .strict();

export const updateTrainingMemoSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    content: z.string().trim().min(1).max(4000).optional(),
    isPinned: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, "No changes supplied.");

const BODY_KEYS = [
  "weightKg",
  "targetWeightKg",
  "bodyFatPercent",
  "neckCm",
  "shoulderCm",
  "chestCm",
  "waistCm",
  "hipCm",
  "leftUpperArmCm",
  "rightUpperArmCm",
  "leftThighCm",
  "rightThighCm",
  "leftCalfCm",
  "rightCalfCm",
] as const satisfies readonly (keyof BodyMeasurementValues)[];

export async function readMenstrualOverview(userId: string, month: string) {
  const [overview, flags] = await Promise.all([
    getMenstrualOverview(userId, month),
    getHealthConsentFlags(userId),
  ]);

  return {
    dates: overview.dates,
    showInHistory: overview.show_in_history,
    healthConsentOnFile: flags.health_consent_on_file,
    withdrawableHealthConsent: flags.withdrawable_health_consent,
  };
}

export async function writeMenstrualDate(
  userId: string,
  date: string,
  input: z.infer<typeof setMenstrualDateSchema>,
) {
  const result = await setMenstrualDate({
    userId,
    date,
    isPeriod: input.isPeriod,
    policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    ...(input.sensitiveHealthConsent === undefined
      ? {}
      : { consentDecision: input.sensitiveHealthConsent }),
  });
  return unwrapSensitiveWrite(result);
}

export async function writeMenstrualSettings(
  userId: string,
  showInHistory: boolean,
) {
  return updateMenstrualSettings(userId, showInHistory);
}

export async function removeMenstrualRecords(userId: string) {
  await deleteMenstrualRecords(userId);
}

export async function readBodyMeasurements(userId: string) {
  const [rows, flags] = await Promise.all([
    listBodyMeasurements(userId),
    getHealthConsentFlags(userId),
  ]);
  return {
    items: rows.map(mapBodyMeasurement),
    healthConsentOnFile: flags.health_consent_on_file,
    withdrawableHealthConsent: flags.withdrawable_health_consent,
  };
}

export async function writeBodyMeasurement(
  userId: string,
  input: z.infer<typeof saveBodyMeasurementSchema>,
): Promise<BodyMeasurementDto> {
  const values = BODY_KEYS.map((key) => input[key] ?? null);
  const result = await saveBodyMeasurement({
    userId,
    measuredOn: input.measuredOn,
    values,
    policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    ...(input.sensitiveHealthConsent === undefined
      ? {}
      : { consentDecision: input.sensitiveHealthConsent }),
  });
  return mapBodyMeasurement(unwrapSensitiveWrite(result));
}

export async function removeBodyMeasurement(userId: string, id: string) {
  const removed = await deleteBodyMeasurement(userId, id);
  if (!removed) {
    throw new HttpError(404, "NOT_FOUND", "Body measurement not found.");
  }
}

export async function removeAllBodyMeasurements(userId: string) {
  await deleteAllBodyMeasurements(userId);
}

export async function readTrainingMemos(userId: string) {
  const rows = await listTrainingMemos(userId);
  return rows.map(mapTrainingMemo);
}

export async function addTrainingMemo(
  userId: string,
  input: z.infer<typeof createTrainingMemoSchema>,
) {
  return mapTrainingMemo(
    await createTrainingMemo({
      userId,
      title: input.title.trim(),
      content: input.content.trim(),
      isPinned: input.isPinned ?? false,
    }),
  );
}

export async function editTrainingMemo(
  userId: string,
  id: string,
  input: z.infer<typeof updateTrainingMemoSchema>,
) {
  const row = await updateTrainingMemo({
    userId,
    id,
    ...(input.title === undefined ? {} : { title: input.title.trim() }),
    ...(input.content === undefined ? {} : { content: input.content.trim() }),
    ...(input.isPinned === undefined ? {} : { isPinned: input.isPinned }),
  });

  if (row === null) {
    throw new HttpError(404, "NOT_FOUND", "Training memo not found.");
  }

  return mapTrainingMemo(row);
}

export async function removeTrainingMemo(userId: string, id: string) {
  const removed = await deleteTrainingMemo(userId, id);
  if (!removed) {
    throw new HttpError(404, "NOT_FOUND", "Training memo not found.");
  }
}

export async function withdrawAllSensitiveHealthData(userId: string) {
  await deleteAllSensitiveHealthData(userId);
}

function unwrapSensitiveWrite<T>(result: SensitiveWriteResult<T>): T {
  if (result.status === "consent_missing") {
    throw new HttpError(
      422,
      "CONSENT_REQUIRED",
      "Storing this health information requires separate consent.",
      { consent_type: "sensitive_health_data" },
    );
  }

  if (result.status === "consent_stale") {
    throw new HttpError(
      422,
      "CONSENT_REQUIRED",
      "The privacy policy has changed. Reload it before consenting.",
      {
        consent_type: "sensitive_health_data",
        expected_policy_version: CURRENT_PRIVACY_POLICY_VERSION,
      },
    );
  }

  return result.value;
}

function mapBodyMeasurement(row: BodyMeasurementRow): BodyMeasurementDto {
  return {
    id: row.id,
    measuredOn: row.measured_on,
    weightKg: toNumber(row.weight_kg),
    targetWeightKg: toNumber(row.target_weight_kg),
    bodyFatPercent: toNumber(row.body_fat_percent),
    neckCm: toNumber(row.neck_cm),
    shoulderCm: toNumber(row.shoulder_cm),
    chestCm: toNumber(row.chest_cm),
    waistCm: toNumber(row.waist_cm),
    hipCm: toNumber(row.hip_cm),
    leftUpperArmCm: toNumber(row.left_upper_arm_cm),
    rightUpperArmCm: toNumber(row.right_upper_arm_cm),
    leftThighCm: toNumber(row.left_thigh_cm),
    rightThighCm: toNumber(row.right_thigh_cm),
    leftCalfCm: toNumber(row.left_calf_cm),
    rightCalfCm: toNumber(row.right_calf_cm),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTrainingMemo(row: TrainingMemoRow): TrainingMemoDto {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    isPinned: row.is_pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toNumber(value: string | number | null): number | null {
  if (value === null) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isValidIsoDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
