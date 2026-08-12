import {
  createDraftSet as createDefaultDraftSet,
  isDraftSetValid,
  type DraftExercise,
  type DraftSet,
} from "./training-session-draft";

export type DraftSetFactory = (previousSet?: DraftSet) => DraftSet;

export function addDraftSet(
  draftExercises: DraftExercise[],
  exerciseId: string,
  createSet: DraftSetFactory = createDefaultDraftSet,
): DraftExercise[] {
  return draftExercises.map((draftExercise) => {
    if (draftExercise.id !== exerciseId) {
      return draftExercise;
    }

    return {
      ...draftExercise,
      isExpanded: true,
      sets: [...draftExercise.sets, createSet(draftExercise.sets.at(-1))],
    };
  });
}

export function copyDraftSet(
  draftExercises: DraftExercise[],
  exerciseId: string,
  setId: string,
  createSet: DraftSetFactory = createDefaultDraftSet,
): DraftExercise[] {
  return draftExercises.map((draftExercise) => {
    if (draftExercise.id !== exerciseId) {
      return draftExercise;
    }

    const sourceSet = draftExercise.sets.find(
      (setDraft) => setDraft.id === setId,
    );

    if (!sourceSet) {
      return draftExercise;
    }

    return {
      ...draftExercise,
      sets: [...draftExercise.sets, createSet(sourceSet)],
    };
  });
}

export function deleteDraftSet(
  draftExercises: DraftExercise[],
  exerciseId: string,
  setId: string,
): DraftExercise[] {
  return draftExercises.map((draftExercise) => {
    if (draftExercise.id !== exerciseId) {
      return draftExercise;
    }

    if (draftExercise.sets.length <= 1) {
      return draftExercise;
    }

    return {
      ...draftExercise,
      sets: draftExercise.sets.filter((setDraft) => setDraft.id !== setId),
    };
  });
}

export function updateDraftSet<TField extends keyof DraftSet>(
  draftExercises: DraftExercise[],
  exerciseId: string,
  setId: string,
  field: TField,
  value: DraftSet[TField],
): DraftExercise[] {
  return draftExercises.map((draftExercise) => {
    if (draftExercise.id !== exerciseId) {
      return draftExercise;
    }

    return {
      ...draftExercise,
      sets: draftExercise.sets.map((setDraft) => {
        if (setDraft.id !== setId) {
          return setDraft;
        }

        return {
          ...setDraft,
          completed:
            field === "weightKg" || field === "reps"
              ? false
              : setDraft.completed,
          restSeconds:
            field === "weightKg" || field === "reps"
              ? null
              : setDraft.restSeconds,
          [field]: value,
        };
      }),
    };
  });
}

export function toggleDraftSetCompleted(
  draftExercises: DraftExercise[],
  exerciseId: string,
  setId: string,
): DraftExercise[] {
  return draftExercises.map((draftExercise) => {
    if (draftExercise.id !== exerciseId) {
      return draftExercise;
    }

    return {
      ...draftExercise,
      sets: draftExercise.sets.map((setDraft) => {
        if (setDraft.id !== setId) {
          return setDraft;
        }

        if (!isDraftSetValid(setDraft, draftExercise)) {
          return {
            ...setDraft,
            completed: false,
            restSeconds: null,
          };
        }

        return {
          ...setDraft,
          completed: !setDraft.completed,
          restSeconds: setDraft.completed ? null : setDraft.restSeconds,
        };
      }),
    };
  });
}
