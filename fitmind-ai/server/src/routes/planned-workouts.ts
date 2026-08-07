import { Router } from "express";

import {
  getCurrentPlannedWorkoutController,
  patchPlannedWorkoutStatusController,
  postAcceptPlanController,
} from "../controllers/planned-workout-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";

export const plannedWorkoutsRouter = Router();

plannedWorkoutsRouter.use("/planned-workouts", authMiddleware);
plannedWorkoutsRouter.post("/planned-workouts", postAcceptPlanController);
plannedWorkoutsRouter.get(
  "/planned-workouts/current",
  getCurrentPlannedWorkoutController,
);
plannedWorkoutsRouter.patch(
  "/planned-workouts/:id",
  patchPlannedWorkoutStatusController,
);
