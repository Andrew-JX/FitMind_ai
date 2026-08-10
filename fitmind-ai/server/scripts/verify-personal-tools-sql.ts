/**
 * Exercises personal-tool repositories against an allowlisted local PostgreSQL.
 * It deliberately ignores DATABASE_URL and deletes only the probe user it creates.
 */
import { createRequire } from "node:module";

import {
  createTrainingMemo,
  deleteAllSensitiveHealthData,
  deleteBodyMeasurement,
  deleteMenstrualRecords,
  deleteTrainingMemo,
  getMenstrualOverview,
  listBodyMeasurements,
  listTrainingMemos,
  saveBodyMeasurement,
  setMenstrualDate,
  updateMenstrualSettings,
  updateTrainingMemo,
} from "../src/db/personal-tools-repository.js";
import { resolveTestDatabaseUrl } from "../src/db/test-database-url.js";
import { getConsentStatus } from "../src/db/user-consent-repository.js";

const require = createRequire(import.meta.url);
const { Pool } = require("pg") as {
  Pool: new (config: ReturnType<typeof resolveTestDatabaseUrl>) => {
    query: (
      sql: string,
      params?: readonly unknown[],
    ) => Promise<{ rows: unknown[]; rowCount?: number | null }>;
    connect: () => Promise<{
      query: (
        sql: string,
        params?: readonly unknown[],
      ) => Promise<{ rows: unknown[]; rowCount?: number | null }>;
      release: () => void;
    }>;
    end: () => Promise<void>;
  };
};

const POLICY = "2026-08-09";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  console.log(`  PASS  ${message}`);
}

async function main() {
  const pool = new Pool(resolveTestDatabaseUrl(process.env));
  let userId: string | null = null;

  try {
    const user = await pool.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, 'hash', 'Personal tools probe') RETURNING id`,
      [`personal-tools-probe-${Date.now()}@example.com`],
    );
    userId = (user.rows[0] as { id: string }).id;

    console.log("\n[1] menstrual date and settings persist");
    const menstrual = await setMenstrualDate(
      {
        userId,
        date: "2026-08-10",
        isPeriod: true,
        policyVersion: POLICY,
        consentDecision: { accepted: true, policy_version: POLICY },
      },
      pool,
    );
    assert(menstrual.status === "saved", "menstrual date saved with consent");
    assert(
      await updateMenstrualSettings(userId, true, pool),
      "history visibility setting saved",
    );
    const overview = await getMenstrualOverview(userId, "2026-08", pool);
    assert(
      overview.dates.join() === "2026-08-10" && overview.show_in_history,
      "menstrual overview reads the persisted date and setting",
    );

    console.log("\n[2] body measurement upserts and reads");
    const body = await saveBodyMeasurement(
      {
        userId,
        measuredOn: "2026-08-10",
        values: [70, 68, 18, 36, 48, 100, 82, 96, 34, 34, 56, 56, 37, 37],
        policyVersion: POLICY,
      },
      pool,
    );
    assert(body.status === "saved", "body measurement saved");
    const bodyRows = await listBodyMeasurements(userId, pool);
    assert(
      bodyRows.length === 1 && Number(bodyRows[0]?.weight_kg) === 70,
      "body measurement reads from PostgreSQL",
    );

    console.log("\n[3] memo create, update, list, and delete persist");
    const memo = await createTrainingMemo(
      {
        userId,
        title: "Chest day",
        content: "Bench press 5 x 8",
        isPinned: false,
      },
      pool,
    );
    const updatedMemo = await updateTrainingMemo(
      { userId, id: memo.id, isPinned: true },
      pool,
    );
    assert(updatedMemo?.is_pinned, "memo update persisted");
    assert(
      (await listTrainingMemos(userId, pool))[0]?.id === memo.id,
      "memo list returns the owned row",
    );

    console.log(
      "\n[4] category deletion preserves consent until all health data is gone",
    );
    await deleteMenstrualRecords(userId, pool);
    let status = await getConsentStatus(userId, POLICY, pool);
    assert(
      status.hasStoredHealthData && status.hasHealthConsent,
      "deleting menstrual data keeps consent while body data remains",
    );
    assert(
      await deleteBodyMeasurement(userId, bodyRows[0]!.id, pool),
      "owned body measurement deleted",
    );
    status = await getConsentStatus(userId, POLICY, pool);
    assert(
      !status.hasStoredHealthData && !status.hasHealthConsent,
      "last health category deletion revokes live health consent",
    );

    console.log(
      "\n[5] full withdrawal deletes health data but preserves memos",
    );
    await pool.query(
      `INSERT INTO athlete_profiles (user_id, goal, weekly_days, injury_constraints)
       VALUES ($1, 'strength', 3, ARRAY['knee'])`,
      [userId],
    );
    await setMenstrualDate(
      {
        userId,
        date: "2026-08-11",
        isPeriod: true,
        policyVersion: POLICY,
        consentDecision: { accepted: true, policy_version: POLICY },
      },
      pool,
    );
    await deleteAllSensitiveHealthData(userId, pool);
    status = await getConsentStatus(userId, POLICY, pool);
    assert(
      !status.hasStoredHealthData && !status.hasHealthConsent,
      "full withdrawal clears health data and revokes consent",
    );
    assert(
      (await listTrainingMemos(userId, pool)).length === 1,
      "full health withdrawal preserves training memos",
    );
    assert(
      await deleteTrainingMemo(userId, memo.id, pool),
      "memo cleanup succeeds",
    );

    console.log("\nALL PERSONAL-TOOLS SQL CHECKS PASSED\n");
  } finally {
    if (userId !== null) {
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    }
    await pool.end();
  }
}

await main();
