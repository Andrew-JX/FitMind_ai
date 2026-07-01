import express from "express";
import { ZodError } from "zod";

import { assistantRouter } from "./routes/assistant.js";
import { athleteProfileRouter } from "./routes/athlete-profile.js";
import { authRouter } from "./routes/auth.js";
import { feedbackRouter } from "./routes/feedback.js";
import { healthRouter } from "./routes/health.js";
import { apiRouter } from "./routes/api.js";
import { plannedWorkoutsRouter } from "./routes/planned-workouts.js";
import { weeklyReportDigestRouter } from "./routes/weekly-report-digests.js";
import { workoutsRouter } from "./routes/workouts.js";
import { createErrorResponse } from "./utils/api-response.js";
import { HttpError, isHttpError } from "./utils/http-error.js";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.use("/api/auth", authRouter);
  app.use("/api/health", healthRouter);
  app.use("/api", apiRouter);
  app.use("/api", assistantRouter);
  app.use("/api", feedbackRouter);
  app.use("/api", athleteProfileRouter);
  app.use("/api", plannedWorkoutsRouter);
  app.use("/api", weeklyReportDigestRouter);
  app.use("/api", workoutsRouter);

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      void _next;

      if (isHttpError(error)) {
        return res
          .status(error.statusCode)
          .json(createErrorResponse(error.toApiError()));
      }

      if (error instanceof ZodError) {
        const validationError = new HttpError(
          400,
          "VALIDATION_ERROR",
          "Request validation failed.",
          {
            issues: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        );

        return res
          .status(validationError.statusCode)
          .json(createErrorResponse(validationError.toApiError()));
      }

      const fallbackError = new HttpError(
        500,
        "INTERNAL_ERROR",
        "Internal server error.",
      );

      return res
        .status(fallbackError.statusCode)
        .json(createErrorResponse(fallbackError.toApiError()));
    },
  );

  return app;
}
