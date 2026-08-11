import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { setMenstrualDate } from "./personal-tools-repository.js";
import { createPlannedWorkoutSupersedingActive } from "./planned-workout-repository.js";
import { createWorkoutWithSets } from "./repositories/workouts-repository.js";
import { createTransactionRoutingTestProbe } from "./transaction-routing-test-probe.js";
import type { TransactionRoutingTestProbe } from "./transaction-routing-test-probe.js";
import { createUserWithConsents } from "./user-consent-repository.js";
import { saveProfileWithHealthConsent } from "./user-health-data-repository.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const POLICY_VERSION = "2026-08-09";
const dbDirectory = dirname(fileURLToPath(import.meta.url));

interface TransactionScenario {
  name: string;
  sourceFile: string;
  run: () => Promise<TransactionRoutingTestProbe>;
}

function assertCommittedOnConnectedClient(probe: TransactionRoutingTestProbe) {
  expect(probe.pool.query).not.toBe(probe.client.query);
  expect(probe.connectCallCount).toBe(1);
  expect(probe.poolQueryCalls).toEqual([]);
  expect(probe.clientStatements[0]).toBe("BEGIN");
  expect(probe.clientStatements.at(-1)).toBe("COMMIT");
  expect(probe.releaseCallCount).toBe(1);
}

function createConsentScenario(): TransactionScenario {
  return {
    name: "user consent registration",
    sourceFile: "user-consent-repository.ts",
    run: async () => {
      const probe = createTransactionRoutingTestProbe((sql) => ({
        rows: sql.includes("INSERT INTO users")
          ? [
              {
                id: USER_ID,
                email: "user@example.com",
                passwordHash: "hash",
                displayName: null,
                createdAt: "2026-08-11T00:00:00.000Z",
                updatedAt: "2026-08-11T00:00:00.000Z",
              },
            ]
          : [],
      }));

      await createUserWithConsents(
        {
          email: "user@example.com",
          passwordHash: "hash",
          consents: [
            {
              consentType: "cross_border_transfer",
              policyVersion: POLICY_VERSION,
              source: "registration",
            },
          ],
        },
        probe.pool,
      );
      return probe;
    },
  };
}

function createHealthScenario(): TransactionScenario {
  return {
    name: "health profile save",
    sourceFile: "user-health-data-repository.ts",
    run: async () => {
      const profileRow = {
        user_id: USER_ID,
        goal: "strength",
        weekly_days: 3,
        available_equipment: [],
        injury_constraints: ["knee"],
        created_at: "2026-08-11T00:00:00.000Z",
        updated_at: "2026-08-11T00:00:00.000Z",
      };
      const probe = createTransactionRoutingTestProbe((sql) => {
        if (sql.includes("FOR UPDATE")) {
          return { rows: [{ id: USER_ID }] };
        }
        if (sql.includes("INSERT INTO athlete_profiles")) {
          return { rows: [profileRow] };
        }
        return { rows: [] };
      });

      await saveProfileWithHealthConsent(
        {
          userId: USER_ID,
          goal: "strength",
          weeklyDays: 3,
          availableEquipment: [],
          injuryConstraints: ["knee"],
          policyVersion: POLICY_VERSION,
          consentDecision: {
            accepted: true,
            policy_version: POLICY_VERSION,
          },
        },
        probe.pool,
      );
      return probe;
    },
  };
}

function createPlannedWorkoutScenario(): TransactionScenario {
  return {
    name: "planned workout supersession",
    sourceFile: "planned-workout-repository.ts",
    run: async () => {
      const probe = createTransactionRoutingTestProbe((sql) => {
        if (sql.includes("FOR UPDATE")) {
          return { rows: [{ id: USER_ID }] };
        }
        if (sql.includes("INSERT INTO planned_workouts")) {
          return {
            rows: [
              {
                id: "plan-1",
                user_id: USER_ID,
                status: "active",
                start_date: "2026-08-11",
                end_date: "2026-08-17",
                plan: {},
                source_message_id: null,
                created_at: "2026-08-11T00:00:00.000Z",
                updated_at: "2026-08-11T00:00:00.000Z",
              },
            ],
          };
        }
        return { rows: [] };
      });

      await createPlannedWorkoutSupersedingActive(
        {
          userId: USER_ID,
          startDate: "2026-08-11",
          endDate: "2026-08-17",
          planJson: "{}",
        },
        probe.pool,
      );
      return probe;
    },
  };
}

function createWorkoutScenario(): TransactionScenario {
  return {
    name: "workout and sets creation",
    sourceFile: "repositories/workouts-repository.ts",
    run: async () => {
      const workoutDetail = {
        id: "workout-1",
        performed_at: "2026-08-11",
        started_at: null,
        ended_at: null,
        duration_minutes: null,
        notes: null,
        sets: [],
      };
      const probe = createTransactionRoutingTestProbe((sql) => {
        if (sql.includes("INSERT INTO workouts")) {
          return { rows: [{ id: workoutDetail.id }] };
        }
        if (sql.includes("FROM workouts w")) {
          return { rows: [workoutDetail] };
        }
        return { rows: [] };
      });

      await createWorkoutWithSets(
        USER_ID,
        {
          performed_at: "2026-08-11",
          sets: [
            {
              exercise_id: "exercise-1",
              set_index: 1,
              reps: 8,
              weight_kg: 60,
              is_warmup: false,
            },
          ],
        },
        probe.pool,
      );
      return probe;
    },
  };
}

const directTransactionScenarios = [
  createConsentScenario(),
  createHealthScenario(),
  createPlannedWorkoutScenario(),
  createWorkoutScenario(),
];

async function findTransactionRepositoryFiles(): Promise<string[]> {
  const roots = [
    { directory: dbDirectory, prefix: "" },
    {
      directory: resolve(dbDirectory, "repositories"),
      prefix: "repositories/",
    },
  ];
  const transactionFiles: string[] = [];

  for (const root of roots) {
    const entries = await readdir(root.directory, { withFileTypes: true });
    for (const entry of entries) {
      if (
        !entry.isFile() ||
        !/\.(?:js|ts)$/u.test(entry.name) ||
        entry.name.includes(".test.") ||
        entry.name === "transaction-routing-test-probe.ts"
      ) {
        continue;
      }
      const source = await readFile(
        resolve(root.directory, entry.name),
        "utf8",
      );
      if (/\.query\(\s*["'`]BEGIN["'`]\s*\)/u.test(source)) {
        transactionFiles.push(`${root.prefix}${entry.name}`);
      }
    }
  }

  return transactionFiles.sort();
}

function assertExactTransactionCoverage(
  transactionFiles: readonly string[],
  scenarioFiles: readonly string[],
) {
  expect([...new Set(scenarioFiles)].sort()).toEqual(
    [...transactionFiles].sort(),
  );
}

describe("transaction query routing", () => {
  it.each(directTransactionScenarios)(
    "$name keeps every query on connect()'s client",
    async ({ run }) => {
      assertCommittedOnConnectedClient(await run());
    },
  );

  it("keeps the personal-tools consumer inside the shared health transaction", async () => {
    const probe = createTransactionRoutingTestProbe((sql) => {
      if (sql.includes("FOR UPDATE")) {
        return { rows: [{ id: USER_ID }] };
      }
      return { rows: [] };
    });

    await setMenstrualDate(
      {
        userId: USER_ID,
        date: "2026-08-11",
        isPeriod: true,
        policyVersion: POLICY_VERSION,
        consentDecision: {
          accepted: true,
          policy_version: POLICY_VERSION,
        },
      },
      probe.pool,
    );

    assertCommittedOnConnectedClient(probe);
  });

  it("rolls a failed workout write back on the client without escaping", async () => {
    const probe = createTransactionRoutingTestProbe((sql) => {
      if (sql.includes("INSERT INTO workouts")) {
        return { rows: [{ id: "workout-1" }] };
      }
      if (sql.includes("INSERT INTO sets")) {
        throw new Error("set insert failed");
      }
      return { rows: [] };
    });

    await expect(
      createWorkoutWithSets(
        USER_ID,
        {
          performed_at: "2026-08-11",
          sets: [
            {
              exercise_id: "exercise-1",
              set_index: 1,
              reps: 8,
              weight_kg: 60,
              is_warmup: false,
            },
          ],
        },
        probe.pool,
      ),
    ).rejects.toThrow("set insert failed");

    expect(probe.poolQueryCalls).toEqual([]);
    expect(probe.clientStatements).toContain("ROLLBACK");
    expect(probe.clientStatements).not.toContain("COMMIT");
    expect(probe.releaseCallCount).toBe(1);
  });

  it("makes a direct pool query fail loudly", async () => {
    const probe = createTransactionRoutingTestProbe();

    expect(probe.pool.query).not.toBe(probe.client.query);
    await expect(probe.pool.query("SELECT escaped")).rejects.toThrow(
      "Transaction query escaped the connected client.",
    );
    expect(probe.poolQueryCalls).toEqual([
      { sql: "SELECT escaped", params: undefined },
    ]);
    expect(probe.clientQueryCalls).toEqual([]);
  });

  it("discovers every transactional repository and rejects an uncovered fifth file", async () => {
    const transactionFiles = await findTransactionRepositoryFiles();
    const scenarioFiles = directTransactionScenarios.map(
      ({ sourceFile }) => sourceFile,
    );

    assertExactTransactionCoverage(transactionFiles, scenarioFiles);
    expect(() =>
      assertExactTransactionCoverage(
        [...transactionFiles, "new-transaction-repository.ts"],
        scenarioFiles,
      ),
    ).toThrow();
  });

  it("types the injectable pool on every workouts runtime function", async () => {
    const runtime = await readFile(
      resolve(dbDirectory, "repositories/workouts-repository.ts"),
      "utf8",
    );
    const injectableFunctions = [
      ...runtime.matchAll(
        /^export async function ([a-zA-Z0-9_]+)\(([^)]*)\)/gmu,
      ),
    ].map((match) => ({
      name: match[1] ?? "",
      parameters: match[2] ?? "",
    }));

    expect(injectableFunctions).toHaveLength(10);
    for (const { name, parameters } of injectableFunctions) {
      expect(parameters, name).toMatch(/\bpool\?: DbPoolLike\b/);
    }
    expect(runtime).toContain("export interface DbPoolLike");
    expect(runtime).not.toContain("as unknown as");
  });
});
