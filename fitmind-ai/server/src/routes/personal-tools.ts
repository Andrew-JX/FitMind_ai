import { Router } from "express";

import {
  deleteAllBodyMeasurementsController,
  deleteAllSensitiveHealthDataController,
  deleteBodyMeasurementController,
  deleteMenstrualRecordsController,
  deleteTrainingMemoController,
  getBodyMeasurementsController,
  getMenstrualOverviewController,
  getTrainingMemosController,
  patchMenstrualSettingsController,
  patchTrainingMemoController,
  postTrainingMemoController,
  putBodyMeasurementController,
  putMenstrualDateController,
} from "../controllers/personal-tools-controller.js";
import {
  authMiddleware,
  authMiddlewareAllowingPendingConsents,
} from "../middleware/auth-middleware.js";

/** Consent-exempt deletion so declining health-data processing is actionable. */
export const personalHealthWithdrawalRouter = Router();
personalHealthWithdrawalRouter.delete(
  "/personal-health-data",
  authMiddlewareAllowingPendingConsents,
  deleteAllSensitiveHealthDataController,
);

export const personalToolsRouter = Router();
personalToolsRouter.use(
  ["/menstrual-records", "/body-measurements", "/training-memos"],
  authMiddleware,
);

personalToolsRouter.get("/menstrual-records", getMenstrualOverviewController);
personalToolsRouter.put("/menstrual-records/:date", putMenstrualDateController);
personalToolsRouter.patch(
  "/menstrual-records/settings",
  patchMenstrualSettingsController,
);
personalToolsRouter.delete(
  "/menstrual-records",
  deleteMenstrualRecordsController,
);

personalToolsRouter.get("/body-measurements", getBodyMeasurementsController);
personalToolsRouter.put("/body-measurements", putBodyMeasurementController);
personalToolsRouter.delete(
  "/body-measurements/:id",
  deleteBodyMeasurementController,
);
personalToolsRouter.delete(
  "/body-measurements",
  deleteAllBodyMeasurementsController,
);

personalToolsRouter.get("/training-memos", getTrainingMemosController);
personalToolsRouter.post("/training-memos", postTrainingMemoController);
personalToolsRouter.patch("/training-memos/:id", patchTrainingMemoController);
personalToolsRouter.delete("/training-memos/:id", deleteTrainingMemoController);
