import { Router } from "express";

import {
  addWorkoutSetController,
  createWorkoutController,
  deleteSetController,
  deleteWorkoutController,
  getExerciseProgressController,
  getRecommendationContextController,
  getWorkoutController,
  getTrainingSummaryController,
  listWorkoutsController,
  updateSetController,
  updateWorkoutController,
} from "../controllers/workout-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";

export const workoutsRouter = Router();

workoutsRouter.use(authMiddleware);

workoutsRouter.get("/workouts", listWorkoutsController);
workoutsRouter.get("/training/exercise-progress", getExerciseProgressController);
workoutsRouter.get(
  "/training/recommendation-context",
  getRecommendationContextController,
);
workoutsRouter.get("/training/summary", getTrainingSummaryController);
workoutsRouter.get("/workouts/:id", getWorkoutController);
workoutsRouter.post("/workouts", createWorkoutController);
workoutsRouter.patch("/workouts/:id", updateWorkoutController);
workoutsRouter.delete("/workouts/:id", deleteWorkoutController);
workoutsRouter.post("/workouts/:id/sets", addWorkoutSetController);
workoutsRouter.patch("/sets/:id", updateSetController);
workoutsRouter.delete("/sets/:id", deleteSetController);
