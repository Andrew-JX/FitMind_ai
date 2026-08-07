import express from "express";
import { ZodError } from "zod";

import { assistantRouter } from "./routes/assistant.js";
import {
  athleteProfileRouter,
  injuryWithdrawalRouter,
} from "./routes/athlete-profile.js";
import { createAuthRouter } from "./routes/auth.js";
import { feedbackRouter } from "./routes/feedback.js";
import { healthRouter } from "./routes/health.js";
import { apiRouter } from "./routes/api.js";
import { plannedWorkoutsRouter } from "./routes/planned-workouts.js";
import { weeklyReportDigestRouter } from "./routes/weekly-report-digests.js";
import { workoutsRouter } from "./routes/workouts.js";
import type { AiRateLimiter } from "./services/assistant/ai-rate-limiter.js";
import { createErrorResponse } from "./utils/api-response.js";
import { HttpError, isHttpError } from "./utils/http-error.js";

export interface CreateAppOptions {
  authRateLimiter?: AiRateLimiter;
  unknownErrorLogger?: (entry: UnknownRequestErrorLog) => void;
}

export interface UnknownRequestErrorLog {
  event: "unhandled_request_error";
  method: string;
  path: string;
  errorType: string;
  errorCode?: string;
}

function getSafeErrorToken(value: unknown, fallback: string) {
  return typeof value === "string" && /^[a-z0-9_.-]{1,64}$/i.test(value)
    ? value
    : fallback;
}

function createUnknownRequestErrorLog(
  error: unknown,
  req: express.Request,
): UnknownRequestErrorLog {
  const errorRecord =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : undefined;
  const errorType =
    error instanceof Error
      ? getSafeErrorToken(error.name, "Error")
      : typeof error;
  const errorCode = errorRecord?.code;

  return {
    event: "unhandled_request_error",
    method: req.method,
    path: req.path,
    errorType,
    ...(typeof errorCode === "string" && /^[a-z0-9_.-]{1,64}$/i.test(errorCode)
      ? { errorCode }
      : {}),
  };
}

/**
 * Creates the Express app and wires production middleware and routers.
 *
 * @param options - Optional injectable auth limiter for isolated tests
 * @returns Configured Express application
 */
export function createApp(options?: CreateAppOptions) {
  const app = express();
  const unknownErrorLogger =
    options?.unknownErrorLogger ??
    ((entry: UnknownRequestErrorLog) => {
      console.error(JSON.stringify(entry));
    });

  app.set("trust proxy", 1);
  app.use(express.json());

  app.use(
    "/api/auth",
    createAuthRouter({ authRateLimiter: options?.authRateLimiter }),
  );
  app.use("/api/health", healthRouter);

  // Mount order matters here. Every router below gates itself with a path-less
  // `router.use(authMiddleware)`, which Express runs for *all* requests routed
  // into it — including ones it has no handler for. So a consent-exempt route
  // has to be reached before any of them, or the first router in the chain
  // returns 403 and the exemption never applies. Covered by an HTTP test.
  app.use("/api", injuryWithdrawalRouter);

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
      req: express.Request,
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

      try {
        unknownErrorLogger(createUnknownRequestErrorLog(error, req));
      } catch {
        // Observability must never replace the original API response.
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
