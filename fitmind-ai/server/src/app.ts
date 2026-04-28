import express from "express";

import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { createErrorResponse } from "./utils/api-response.js";
import { HttpError, isHttpError } from "./utils/http-error.js";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.use("/api/auth", authRouter);
  app.use("/api/health", healthRouter);

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
