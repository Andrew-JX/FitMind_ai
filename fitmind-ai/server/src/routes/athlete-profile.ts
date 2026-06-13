import { Router } from "express";

import {
  getAthleteProfileController,
  putAthleteProfileController,
} from "../controllers/athlete-profile-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";

export const athleteProfileRouter = Router();

athleteProfileRouter.use(authMiddleware);
athleteProfileRouter.get("/athlete-profile", getAthleteProfileController);
athleteProfileRouter.put("/athlete-profile", putAthleteProfileController);
