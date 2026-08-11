import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import * as exercisesRepository from "./exercises-repository.js";
import * as repositories from "./index.js";
import * as muscleGroupsRepository from "./muscle-groups-repository.js";
import * as usersRepository from "./users-repository.js";
import * as workoutsRepository from "./workouts-repository.js";

const repositoryDirectory = dirname(fileURLToPath(import.meta.url));

const implementationFiles = [
  "exercises-repository.ts",
  "index.ts",
  "muscle-groups-repository.ts",
  "users-repository.ts",
  "workouts-repository.ts",
] as const;

const sqlBaselines = {
  "exercises-repository.ts": {
    blocks: 1,
    sha256: "934c5561488e07b845f590885a086ce2cf649cb4c71abb12aaf70d6c5f854e29",
  },
  "muscle-groups-repository.ts": {
    blocks: 1,
    sha256: "4ab254edd6aff56fd880744bd7143977c762a36ec866be886993937d5d47481c",
  },
  "users-repository.ts": {
    blocks: 5,
    sha256: "447324abdfda0e05941f8c07c0c041e4b725796f9ac9c29609d9218e6d06a175",
  },
  "workouts-repository.ts": {
    blocks: 12,
    sha256: "6ae5da687276a765804f5bab3362efa5825f515420cbeb1718e3050ea64e671f",
  },
} as const;

function runtimeExports(module: object): string[] {
  return Object.keys(module).sort();
}

function sqlFingerprint(source: string): { blocks: number; sha256: string } {
  const blocks = Array.from(source.matchAll(/`([^`]*)`/gs))
    .map((match) => match[1] ?? "")
    .filter((literal) =>
      /\b(?:SELECT|INSERT|UPDATE|DELETE|BEGIN|COMMIT|ROLLBACK)\b/.test(literal),
    )
    .map((literal) => literal.replaceAll("\r\n", "\n"));
  const joined = blocks.join("\n-- SQL BLOCK --\n");

  return {
    blocks: blocks.length,
    sha256: createHash("sha256").update(joined, "utf8").digest("hex"),
  };
}

describe("repository TypeScript source contract", () => {
  it("has exactly five TypeScript implementations and no handwritten declarations", () => {
    const productionFiles = readdirSync(repositoryDirectory)
      .filter((name) => !name.includes(".test."))
      .sort();

    expect(productionFiles).toEqual([...implementationFiles].sort());
    expect(productionFiles.some((name) => name.endsWith(".js"))).toBe(false);
    expect(productionFiles.some((name) => name.endsWith(".d.ts"))).toBe(false);
  });

  it("preserves the implementation and barrel runtime export sets", () => {
    expect(runtimeExports(exercisesRepository)).toEqual(["searchExercises"]);
    expect(runtimeExports(muscleGroupsRepository)).toEqual([
      "listMuscleGroups",
    ]);
    expect(runtimeExports(usersRepository)).toEqual([
      "createUser",
      "deleteUserById",
      "findUserByEmail",
      "findUserById",
    ]);
    expect(runtimeExports(workoutsRepository)).toEqual([
      "addSetToWorkoutForUser",
      "createWorkoutWithSets",
      "decodeWorkoutCursor",
      "deleteSetByIdForUser",
      "deleteWorkoutByIdForUser",
      "encodeWorkoutCursor",
      "findWorkoutByIdForUser",
      "hasSetById",
      "hasWorkoutById",
      "listWorkoutsByUser",
      "updateSetByIdForUser",
      "updateWorkoutByIdForUser",
    ]);
    expect(runtimeExports(repositories)).toEqual([
      "addSetToWorkoutForUser",
      "createUser",
      "createWorkoutWithSets",
      "decodeWorkoutCursor",
      "deleteSetByIdForUser",
      "deleteUserById",
      "deleteWorkoutByIdForUser",
      "encodeWorkoutCursor",
      "findUserByEmail",
      "findUserById",
      "findWorkoutByIdForUser",
      "listMuscleGroups",
      "listWorkoutsByUser",
      "searchExercises",
      "updateSetByIdForUser",
      "updateWorkoutByIdForUser",
    ]);
  });

  it("keeps every SQL template byte-stable after newline normalization", () => {
    for (const [fileName, expected] of Object.entries(sqlBaselines)) {
      const source = readFileSync(join(repositoryDirectory, fileName), "utf8");
      expect(sqlFingerprint(source), fileName).toEqual(expected);
    }
  });

  it("does not hide migrated contracts behind broad type escapes", () => {
    for (const fileName of implementationFiles) {
      const source = readFileSync(join(repositoryDirectory, fileName), "utf8");
      expect(source, fileName).not.toMatch(/\bany\b/);
      expect(source, fileName).not.toContain("as unknown as");
    }
  });
});
