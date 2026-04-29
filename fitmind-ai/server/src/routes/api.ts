import { Router } from "express";

import {
  listMuscleGroupsController,
  searchExercisesController,
} from "../controllers/dictionaries-controller.js";

export const apiRouter = Router();

apiRouter.get("/muscle-groups", listMuscleGroupsController);
apiRouter.get("/exercises", searchExercisesController);
