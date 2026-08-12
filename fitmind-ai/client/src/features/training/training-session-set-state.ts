import type { DraftExercise, DraftSet } from "./training-session-draft";

export type DraftSetFactory = (previousSet?: DraftSet) => DraftSet;

function notImplemented(): never {
  throw new Error("Not implemented");
}

export function addDraftSet(
  draftExercises: DraftExercise[],
  exerciseId: string,
  createSet?: DraftSetFactory,
): DraftExercise[] {
  void draftExercises;
  void exerciseId;
  void createSet;
  return notImplemented();
}

export function copyDraftSet(
  draftExercises: DraftExercise[],
  exerciseId: string,
  setId: string,
  createSet?: DraftSetFactory,
): DraftExercise[] {
  void draftExercises;
  void exerciseId;
  void setId;
  void createSet;
  return notImplemented();
}

export function deleteDraftSet(
  draftExercises: DraftExercise[],
  exerciseId: string,
  setId: string,
): DraftExercise[] {
  void draftExercises;
  void exerciseId;
  void setId;
  return notImplemented();
}

export function updateDraftSet<TField extends keyof DraftSet>(
  draftExercises: DraftExercise[],
  exerciseId: string,
  setId: string,
  field: TField,
  value: DraftSet[TField],
): DraftExercise[] {
  void draftExercises;
  void exerciseId;
  void setId;
  void field;
  void value;
  return notImplemented();
}

export function toggleDraftSetCompleted(
  draftExercises: DraftExercise[],
  exerciseId: string,
  setId: string,
): DraftExercise[] {
  void draftExercises;
  void exerciseId;
  void setId;
  return notImplemented();
}
