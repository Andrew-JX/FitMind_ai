import type { CreateWorkoutRequest } from "../../../../shared/src/training";
import {
  addWorkoutSet,
  createWorkout,
  deleteWorkoutSet,
  updateWorkout,
  updateWorkoutSet,
} from "./workout-api";
import {
  buildWorkoutRequestFromDraft,
  type DraftExercise,
  type TrainingSessionInitialDraft,
} from "./training-session-draft";
import {
  buildWorkoutEditPlan,
  type WorkoutEditPlan,
} from "./workout-to-session-draft";

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

const productionSaveApi: TrainingSessionSaveApi = {
  addWorkoutSet,
  createWorkout,
  deleteWorkoutSet,
  updateWorkout,
  updateWorkoutSet,
};

export function prepareTrainingSessionSave(
  input: TrainingSessionSavePreparationInput,
): TrainingSessionSavePlan | null {
  if (input.mode === "edit_existing") {
    const originalWorkout = input.initialDraft?.originalWorkout;

    if (!input.initialDraft || !originalWorkout) {
      return null;
    }

    const editDraft: TrainingSessionInitialDraft = {
      ...input.initialDraft,
      durationMin: input.draftDurationMin,
      endedAt: input.draftEndedAt,
      exercises: input.draftExercises,
      note: input.draftNote,
      performedAt: input.draftPerformedAt ?? input.initialDraft.performedAt,
      startedAt: input.draftStartedAt,
    };

    return {
      editPlan: buildWorkoutEditPlan(originalWorkout, editDraft),
      kind: "edit",
      workoutId: originalWorkout.id,
    };
  }

  const activeStartedAt =
    input.mode === "create_active" ? input.draftStartedAt : null;
  const request = buildWorkoutRequestFromDraft({
    draftExercises: input.draftExercises,
    durationMinutes:
      input.mode === "create_from_intake" ? input.draftDurationMin : undefined,
    elapsedSeconds: input.elapsedSeconds,
    endedAt: activeStartedAt ? input.now.toISOString() : input.draftEndedAt,
    notes: input.draftNote,
    performedAt:
      input.mode === "create_from_intake" && input.draftPerformedAt
        ? new Date(input.draftPerformedAt)
        : activeStartedAt
          ? new Date(activeStartedAt)
          : input.now,
    startedAt: activeStartedAt ?? input.draftStartedAt,
  });

  return request ? { kind: "create", request } : null;
}

export async function executeTrainingSessionSave(
  token: string,
  plan: TrainingSessionSavePlan,
  api: TrainingSessionSaveApi = productionSaveApi,
): Promise<void> {
  if (plan.kind === "create") {
    await api.createWorkout(token, plan.request);
    return;
  }

  if (plan.editPlan.workoutPatch) {
    await api.updateWorkout(token, plan.workoutId, plan.editPlan.workoutPatch);
  }

  for (const setId of plan.editPlan.setDeletes) {
    await api.deleteWorkoutSet(token, setId);
  }

  for (const patch of plan.editPlan.setPatches) {
    await api.updateWorkoutSet(token, patch.setId, patch.input);
  }

  for (const add of plan.editPlan.setAdds) {
    await api.addWorkoutSet(token, plan.workoutId, add);
  }
}
