import type {
  BodyMeasurementDto,
  BodyMeasurementsDto,
  MenstrualOverviewDto,
  SaveBodyMeasurementRequest,
  SaveTrainingMemoRequest,
  SetMenstrualDateRequest,
  TrainingMemoDto,
  UpdateMenstrualSettingsRequest,
  UpdateTrainingMemoRequest,
} from "../../../../shared/src/personal-tools";

import { requestJson } from "../../services/http-client";

export async function getMenstrualOverview(
  token: string | null,
  month: string,
): Promise<MenstrualOverviewDto> {
  return requestJson<MenstrualOverviewDto>(
    `/api/menstrual-records?month=${encodeURIComponent(month)}`,
    { token },
  );
}

export async function setMenstrualDate(
  token: string | null,
  date: string,
  input: SetMenstrualDateRequest,
) {
  return requestJson<
    { date: string; isPeriod: boolean },
    SetMenstrualDateRequest
  >(`/api/menstrual-records/${date}`, { method: "PUT", body: input, token });
}

export async function updateMenstrualSettings(
  token: string | null,
  input: UpdateMenstrualSettingsRequest,
) {
  return requestJson<
    { showInHistory: boolean },
    UpdateMenstrualSettingsRequest
  >("/api/menstrual-records/settings", {
    method: "PATCH",
    body: input,
    token,
  });
}

export async function deleteMenstrualRecords(token: string | null) {
  return requestJson<{ success: boolean }>("/api/menstrual-records", {
    method: "DELETE",
    token,
  });
}

export async function getBodyMeasurements(
  token: string | null,
): Promise<BodyMeasurementsDto> {
  return requestJson<BodyMeasurementsDto>("/api/body-measurements", { token });
}

export async function saveBodyMeasurement(
  token: string | null,
  input: SaveBodyMeasurementRequest,
): Promise<BodyMeasurementDto> {
  const data = await requestJson<
    { measurement: BodyMeasurementDto },
    SaveBodyMeasurementRequest
  >("/api/body-measurements", { method: "PUT", body: input, token });
  return data.measurement;
}

export async function deleteBodyMeasurement(token: string | null, id: string) {
  return requestJson<{ success: boolean }>(`/api/body-measurements/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function deleteAllBodyMeasurements(token: string | null) {
  return requestJson<{ success: boolean }>("/api/body-measurements", {
    method: "DELETE",
    token,
  });
}

export async function getTrainingMemos(
  token: string | null,
): Promise<TrainingMemoDto[]> {
  const data = await requestJson<{ items: TrainingMemoDto[] }>(
    "/api/training-memos",
    { token },
  );
  return data.items;
}

export async function createTrainingMemo(
  token: string | null,
  input: SaveTrainingMemoRequest,
): Promise<TrainingMemoDto> {
  const data = await requestJson<
    { memo: TrainingMemoDto },
    SaveTrainingMemoRequest
  >("/api/training-memos", { method: "POST", body: input, token });
  return data.memo;
}

export async function updateTrainingMemo(
  token: string | null,
  id: string,
  input: UpdateTrainingMemoRequest,
): Promise<TrainingMemoDto> {
  const data = await requestJson<
    { memo: TrainingMemoDto },
    UpdateTrainingMemoRequest
  >(`/api/training-memos/${id}`, { method: "PATCH", body: input, token });
  return data.memo;
}

export async function deleteTrainingMemo(token: string | null, id: string) {
  return requestJson<{ success: boolean }>(`/api/training-memos/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function withdrawAllHealthData(token?: string | null) {
  return requestJson<{ success: boolean }>("/api/personal-health-data", {
    method: "DELETE",
    token,
  });
}
