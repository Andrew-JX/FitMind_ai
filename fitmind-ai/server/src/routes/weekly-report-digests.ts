import { Router } from "express";

import {
  getWeeklyReportDigestController,
  patchWeeklyReportDigestController,
  postWeeklyReportCronController,
} from "../controllers/weekly-report-digest-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";

export const weeklyReportDigestRouter = Router();

weeklyReportDigestRouter.post(
  "/cron/weekly-reports",
  postWeeklyReportCronController,
);
weeklyReportDigestRouter.get(
  "/training/weekly-report-digest",
  authMiddleware,
  getWeeklyReportDigestController,
);
weeklyReportDigestRouter.patch(
  "/training/weekly-report-digests/:id",
  authMiddleware,
  patchWeeklyReportDigestController,
);
