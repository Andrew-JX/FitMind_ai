import { Router } from "express";

import { postProductFeedbackController } from "../controllers/product-feedback-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";

export const feedbackRouter = Router();

feedbackRouter.use("/feedback", authMiddleware);
feedbackRouter.post("/feedback", postProductFeedbackController);
