import type { Request, Response } from "express";

import {
  addTrainingMemo,
  createTrainingMemoSchema,
  editTrainingMemo,
  idParamSchema,
  menstrualDateParamSchema,
  menstrualSettingsSchema,
  monthQuerySchema,
  readBodyMeasurements,
  readMenstrualOverview,
  readTrainingMemos,
  removeAllBodyMeasurements,
  removeBodyMeasurement,
  removeMenstrualRecords,
  removeTrainingMemo,
  saveBodyMeasurementSchema,
  setMenstrualDateSchema,
  updateTrainingMemoSchema,
  withdrawAllSensitiveHealthData,
  writeBodyMeasurement,
  writeMenstrualDate,
  writeMenstrualSettings,
} from "../services/personal-tools-service.js";
import { createSuccessResponse } from "../utils/api-response.js";

type AuthLocals = { userId: string };

export async function getMenstrualOverviewController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const query = monthQuerySchema.parse(req.query);
  const overview = await readMenstrualOverview(res.locals.userId, query.month);
  return res.status(200).json(createSuccessResponse(overview));
}

export async function putMenstrualDateController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const { date } = menstrualDateParamSchema.parse(req.params);
  const body = setMenstrualDateSchema.parse(req.body);
  const result = await writeMenstrualDate(res.locals.userId, date, body);
  return res.status(200).json(createSuccessResponse(result));
}

export async function patchMenstrualSettingsController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const body = menstrualSettingsSchema.parse(req.body);
  const showInHistory = await writeMenstrualSettings(
    res.locals.userId,
    body.showInHistory,
  );
  return res.status(200).json(createSuccessResponse({ showInHistory }));
}

export async function deleteMenstrualRecordsController(
  _req: Request,
  res: Response<unknown, AuthLocals>,
) {
  await removeMenstrualRecords(res.locals.userId);
  return res.status(200).json(createSuccessResponse({ success: true }));
}

export async function getBodyMeasurementsController(
  _req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const result = await readBodyMeasurements(res.locals.userId);
  return res.status(200).json(createSuccessResponse(result));
}

export async function putBodyMeasurementController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const body = saveBodyMeasurementSchema.parse(req.body);
  const measurement = await writeBodyMeasurement(res.locals.userId, body);
  return res.status(200).json(createSuccessResponse({ measurement }));
}

export async function deleteBodyMeasurementController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const { id } = idParamSchema.parse(req.params);
  await removeBodyMeasurement(res.locals.userId, id);
  return res.status(200).json(createSuccessResponse({ success: true }));
}

export async function deleteAllBodyMeasurementsController(
  _req: Request,
  res: Response<unknown, AuthLocals>,
) {
  await removeAllBodyMeasurements(res.locals.userId);
  return res.status(200).json(createSuccessResponse({ success: true }));
}

export async function getTrainingMemosController(
  _req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const items = await readTrainingMemos(res.locals.userId);
  return res.status(200).json(createSuccessResponse({ items }));
}

export async function postTrainingMemoController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const body = createTrainingMemoSchema.parse(req.body);
  const memo = await addTrainingMemo(res.locals.userId, body);
  return res.status(201).json(createSuccessResponse({ memo }));
}

export async function patchTrainingMemoController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const { id } = idParamSchema.parse(req.params);
  const body = updateTrainingMemoSchema.parse(req.body);
  const memo = await editTrainingMemo(res.locals.userId, id, body);
  return res.status(200).json(createSuccessResponse({ memo }));
}

export async function deleteTrainingMemoController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const { id } = idParamSchema.parse(req.params);
  await removeTrainingMemo(res.locals.userId, id);
  return res.status(200).json(createSuccessResponse({ success: true }));
}

export async function deleteAllSensitiveHealthDataController(
  _req: Request,
  res: Response<unknown, AuthLocals>,
) {
  await withdrawAllSensitiveHealthData(res.locals.userId);
  return res.status(200).json(createSuccessResponse({ success: true }));
}
