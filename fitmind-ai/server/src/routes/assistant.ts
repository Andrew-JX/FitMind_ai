import { Router } from "express";

import {
  postAssistantStreamTurnController,
  postMockAssistantTurnController,
} from "../controllers/assistant-stream-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";

export const assistantRouter = Router();

assistantRouter.use(authMiddleware);

assistantRouter.post("/assistant/mock-turn", postMockAssistantTurnController);
assistantRouter.post("/assistant/stream-turn", postAssistantStreamTurnController);
