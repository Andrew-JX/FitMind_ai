import type { ConsentDecision } from "./consent";

export interface HealthConsentStateDto {
  healthConsentOnFile: boolean;
  withdrawableHealthConsent: boolean;
}

export interface MenstrualOverviewDto extends HealthConsentStateDto {
  dates: string[];
  showInHistory: boolean;
}

export interface SetMenstrualDateRequest {
  isPeriod: boolean;
  sensitiveHealthConsent?: ConsentDecision | undefined;
}

export interface UpdateMenstrualSettingsRequest {
  showInHistory: boolean;
}

export interface BodyMeasurementValues {
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

export interface BodyMeasurementDto extends BodyMeasurementValues {
  id: string;
  measuredOn: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveBodyMeasurementRequest extends Partial<BodyMeasurementValues> {
  measuredOn: string;
  sensitiveHealthConsent?: ConsentDecision | undefined;
}

export interface BodyMeasurementsDto extends HealthConsentStateDto {
  items: BodyMeasurementDto[];
}

export interface TrainingMemoDto {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveTrainingMemoRequest {
  title: string;
  content: string;
  isPinned?: boolean | undefined;
}

export interface UpdateTrainingMemoRequest {
  title?: string | undefined;
  content?: string | undefined;
  isPinned?: boolean | undefined;
}
