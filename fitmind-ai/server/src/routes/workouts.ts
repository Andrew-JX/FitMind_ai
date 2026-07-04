import { Router } from "express";

import {
  addWorkoutSetController,
  createWorkoutController,
  deleteSetController,
  deleteWorkoutController,
  getAssistantInsightsController,
  getExerciseProgressController,
  getMuscleLoadController,
  getRecommendationContextController,
  getWorkoutController,
  getTrainingSummaryController,
  getWeeklyTrainingReportController,
  listWorkoutsController,
  parseWorkoutIntakeController,
  updateSetController,
  updateWorkoutController,
} from "../controllers/workout-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";

export const workoutsRouter = Router();

workoutsRouter.use(authMiddleware);

workoutsRouter.get("/workouts", listWorkoutsController);
workoutsRouter.get(
  "/training/assistant-insights",
  getAssistantInsightsController,
);
workoutsRouter.get(
  "/training/exercise-progress",
  getExerciseProgressController,
);
workoutsRouter.get("/training/muscle-load", getMuscleLoadController);
workoutsRouter.get(
  "/training/recommendation-context",
  getRecommendationContextController,
);
workoutsRouter.get(
  "/training/weekly-report",
  getWeeklyTrainingReportController,
);
workoutsRouter.post(
  "/training/workout-intake/parse",
  parseWorkoutIntakeController,
);
workoutsRouter.get("/training/summary", getTrainingSummaryController);
workoutsRouter.get("/workouts/:id", getWorkoutController);
workoutsRouter.post("/workouts", createWorkoutController);
workoutsRouter.patch("/workouts/:id", updateWorkoutController);
workoutsRouter.delete("/workouts/:id", deleteWorkoutController);
workoutsRouter.post("/workouts/:id/sets", addWorkoutSetController);
workoutsRouter.patch("/sets/:id", updateSetController);
workoutsRouter.delete("/sets/:id", deleteSetController);
