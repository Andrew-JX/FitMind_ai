import express from "express";

import { healthRouter } from "./routes/health.js";

export function createApp() {
  const app = express();

  app.use("/api/health", healthRouter);

  return app;
}
