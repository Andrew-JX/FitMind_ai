import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import type { DraftExercise, DraftSet } from "./training-session-draft";
import * as setState from "./training-session-set-state";

function createSet(overrides: Partial<DraftSet> = {}): DraftSet {
  return {
    completed: false,
    effort: "normal",
    id: "set-1",
    isWarmup: false,
    persistedSetId: "persisted-set-1",
    reps: "8",
    restSeconds: 90,
    weightKg: "60",
    ...overrides,
  };
}

function createExercise(overrides: Partial<DraftExercise> = {}): DraftExercise {
  return {
    candidateExercises: [],
    categoryLabel: "胸",
    exercise: null,
    exerciseId: "bench-press",
    id: "exercise-1",
    inputName: null,
    isExpanded: false,
    loadType: "weighted",
    matchStatus: "matched",
    name: "杠铃卧推",
    sets: [createSet()],
    ...overrides,
  };
}

describe("training-session-set-state", () => {
  it("appends a generated set from the target's final set and expands it", () => {
    const previousSet = createSet({ id: "set-2", reps: "10" });
    const input = [
      createExercise({ sets: [createSet(), previousSet] }),
      createExercise({ id: "exercise-2", name: "深蹲" }),
    ];
    const original = structuredClone(input);
    const generatedSet = createSet({
      id: "set-generated",
      persistedSetId: undefined,
    });
    const createSetFactory = vi.fn(() => generatedSet);

    expect(setState.addDraftSet(input, "exercise-1", createSetFactory)).toEqual(
      [
        {
          ...input[0],
          isExpanded: true,
          sets: [input[0]!.sets[0], previousSet, generatedSet],
        },
        input[1],
      ],
    );
    expect(createSetFactory).toHaveBeenCalledOnce();
    expect(createSetFactory).toHaveBeenCalledWith(previousSet);
    expect(input).toEqual(original);

    const emptyExercise = createExercise({ sets: [] });
    const emptyFactory = vi.fn(() => generatedSet);
    expect(
      setState.addDraftSet([emptyExercise], "exercise-1", emptyFactory),
    ).toEqual([{ ...emptyExercise, isExpanded: true, sets: [generatedSet] }]);
    expect(emptyFactory).toHaveBeenCalledWith(undefined);
  });

  it("copies only a source set inside the target exercise", () => {
    const sourceSet = createSet({ id: "set-source", reps: "12" });
    const copiedSet = createSet({
      id: "set-copy",
      persistedSetId: undefined,
      reps: "12",
    });
    const input = [
      createExercise({ sets: [createSet(), sourceSet] }),
      createExercise({
        id: "exercise-2",
        sets: [createSet({ id: "set-source", reps: "20" })],
      }),
    ];
    const factory = vi.fn(() => copiedSet);

    expect(
      setState.copyDraftSet(input, "exercise-1", "set-source", factory),
    ).toEqual([
      { ...input[0], sets: [input[0]!.sets[0], sourceSet, copiedSet] },
      input[1],
    ]);
    expect(factory).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledWith(sourceSet);

    const missingFactory = vi.fn(() => copiedSet);
    expect(
      setState.copyDraftSet(input, "exercise-1", "missing-set", missingFactory),
    ).toEqual(input);
    expect(
      setState.copyDraftSet(
        input,
        "missing-exercise",
        "set-source",
        missingFactory,
      ),
    ).toEqual(input);
    expect(missingFactory).not.toHaveBeenCalled();
  });

  it("keeps a final set and otherwise deletes only the requested set", () => {
    const onlySet = createSet();
    const single = createExercise({ sets: [onlySet] });
    expect(setState.deleteDraftSet([single], "exercise-1", onlySet.id)).toEqual(
      [single],
    );

    const keptSet = createSet({ id: "set-kept" });
    const multiple = createExercise({ sets: [onlySet, keptSet] });
    expect(
      setState.deleteDraftSet([multiple], "exercise-1", onlySet.id),
    ).toEqual([{ ...multiple, sets: [keptSet] }]);
    expect(
      setState.deleteDraftSet([multiple], "exercise-1", "missing-set"),
    ).toEqual([multiple]);
  });

  it("resets completion and rest only for weight or rep edits", () => {
    const persisted = createSet({ completed: true, restSeconds: 120 });
    const exercise = createExercise({ sets: [persisted] });

    expect(
      setState.updateDraftSet(
        [exercise],
        "exercise-1",
        "set-1",
        "weightKg",
        "62.5",
      ),
    ).toEqual([
      {
        ...exercise,
        sets: [
          {
            ...persisted,
            completed: false,
            restSeconds: null,
            weightKg: "62.5",
          },
        ],
      },
    ]);
    expect(
      setState.updateDraftSet([exercise], "exercise-1", "set-1", "reps", "9"),
    ).toEqual([
      {
        ...exercise,
        sets: [
          { ...persisted, completed: false, reps: "9", restSeconds: null },
        ],
      },
    ]);
    expect(
      setState.updateDraftSet(
        [exercise],
        "exercise-1",
        "set-1",
        "effort",
        "hard",
      ),
    ).toEqual([{ ...exercise, sets: [{ ...persisted, effort: "hard" }] }]);
    expect(
      setState.updateDraftSet(
        [exercise],
        "exercise-1",
        "missing-set",
        "reps",
        "1",
      ),
    ).toEqual([exercise]);
  });

  it("toggles valid weighted sets and normalizes invalid ones", () => {
    const incomplete = createSet({ completed: false, restSeconds: 90 });
    const completed = createSet({ completed: true, restSeconds: 90 });
    const invalid = createSet({
      completed: true,
      reps: "",
      restSeconds: 90,
    });

    expect(
      setState.toggleDraftSetCompleted(
        [createExercise({ sets: [incomplete] })],
        "exercise-1",
        "set-1",
      ),
    ).toEqual([createExercise({ sets: [{ ...incomplete, completed: true }] })]);
    expect(
      setState.toggleDraftSetCompleted(
        [createExercise({ sets: [completed] })],
        "exercise-1",
        "set-1",
      ),
    ).toEqual([
      createExercise({
        sets: [{ ...completed, completed: false, restSeconds: null }],
      }),
    ]);
    expect(
      setState.toggleDraftSetCompleted(
        [createExercise({ sets: [invalid] })],
        "exercise-1",
        "set-1",
      ),
    ).toEqual([
      createExercise({
        sets: [{ ...invalid, completed: false, restSeconds: null }],
      }),
    ]);
  });

  it("accepts a bodyweight set with reps and zero external load", () => {
    const bodyweightSet = createSet({
      completed: false,
      reps: "10",
      weightKg: "0",
    });
    const bodyweightExercise = createExercise({
      loadType: "bodyweight",
      sets: [bodyweightSet],
    });

    expect(
      setState.toggleDraftSetCompleted(
        [bodyweightExercise],
        "exercise-1",
        "set-1",
      ),
    ).toEqual([
      {
        ...bodyweightExercise,
        sets: [{ ...bodyweightSet, completed: true }],
      },
    ]);
  });

  it("gives the set-state module sole ownership of the five transitions", () => {
    const composerSource = readFileSync(
      new URL("./TrainingSessionComposer.tsx", import.meta.url),
      "utf8",
    );
    const moduleSource = readFileSync(
      new URL("./training-session-set-state.ts", import.meta.url),
      "utf8",
    );

    expect(Object.keys(setState).sort()).toEqual([
      "addDraftSet",
      "copyDraftSet",
      "deleteDraftSet",
      "toggleDraftSetCompleted",
      "updateDraftSet",
    ]);
    expect(composerSource).toContain('from "./training-session-set-state"');
    expect(composerSource).not.toContain("createDraftSet");
    expect(composerSource).not.toContain("function canCompleteSet");
    expect(composerSource).toContain("addDraftSet(currentValue, exerciseId)");
    expect(composerSource).toContain(
      "copyDraftSet(currentValue, exerciseId, setId)",
    );
    expect(composerSource).toContain(
      "deleteDraftSet(currentValue, exerciseId, setId)",
    );
    expect(composerSource).toContain(
      "updateDraftSet(currentValue, exerciseId, setId, field, value)",
    );
    expect(composerSource).toContain(
      "toggleDraftSetCompleted(currentValue, exerciseId, setId)",
    );
    expect(moduleSource).not.toContain("TrainingSessionComposer");
  });
});
