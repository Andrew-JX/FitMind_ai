import type { CreateWorkoutRequest } from "../../../../shared/src/training";
import type {
  DraftExercise,
  TrainingSessionInitialDraft,
} from "./training-session-draft";
import type { WorkoutEditPlan } from "./workout-to-session-draft";

export type TrainingSessionSaveMode =
  | "create_active"
  | "create_from_intake"
  | "edit_existing";

export interface TrainingSessionSavePreparationInput {
  draftDurationMin: number | null;
  draftEndedAt: string | null;
  draftExercises: DraftExercise[];
  draftNote: string;
  draftPerformedAt: string | null;
  draftStartedAt: string | null;
  elapsedSeconds: number;
  initialDraft?: TrainingSessionInitialDraft | null | undefined;
  mode: TrainingSessionSaveMode;
  now: Date;
}

export type TrainingSessionSavePlan =
  | { kind: "create"; request: CreateWorkoutRequest }
  | {
      editPlan: WorkoutEditPlan;
      kind: "edit";
      workoutId: string;
    };

export interface TrainingSessionSaveApi {
  addWorkoutSet: (
    token: string,
    workoutId: string,
    input: WorkoutEditPlan["setAdds"][number],
  ) => Promise<unknown>;
  createWorkout: (
    token: string,
    input: CreateWorkoutRequest,
  ) => Promise<unknown>;
  deleteWorkoutSet: (token: string, setId: string) => Promise<unknown>;
  updateWorkout: (
    token: string,
    workoutId: string,
    input: NonNullable<WorkoutEditPlan["workoutPatch"]>,
  ) => Promise<unknown>;
  updateWorkoutSet: (
    token: string,
    setId: string,
    input: WorkoutEditPlan["setPatches"][number]["input"],
  ) => Promise<unknown>;
}

export function prepareTrainingSessionSave(
  _input: TrainingSessionSavePreparationInput,
): TrainingSessionSavePlan | null {
  throw new Error("Not implemented");
}

export async function executeTrainingSessionSave(
  _token: string,
  _plan: TrainingSessionSavePlan,
  _api?: TrainingSessionSaveApi,
): Promise<void> {
  throw new Error("Not implemented");
}
