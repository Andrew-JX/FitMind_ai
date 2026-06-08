import { Router } from "express";

import {
  deleteAssistantSavedInsightController,
  getAssistantSavedInsightController,
  listAssistantSavedInsightsController,
  postAssistantSavedInsightController,
} from "../controllers/assistant-saved-insights-controller.js";
import {
  postAssistantStreamTurnController,
  postMockAssistantTurnController,
} from "../controllers/assistant-stream-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";

export const assistantRouter = Router();

assistantRouter.use(authMiddleware);

assistantRouter.post("/assistant/insights", postAssistantSavedInsightController);
assistantRouter.get("/assistant/insights", listAssistantSavedInsightsController);
assistantRouter.get("/assistant/insights/:id", getAssistantSavedInsightController);
assistantRouter.delete(
  "/assistant/insights/:id",
  deleteAssistantSavedInsightController,
);
assistantRouter.post("/assistant/mock-turn", postMockAssistantTurnController);
assistantRouter.post("/assistant/stream-turn", postAssistantStreamTurnController);
