/**
 * Exercises the consent repository against a real PostgreSQL instance.
 *
 * @remarks
 * The unit tests can only assert on SQL text. Two properties this batch depends
 * on are decided by PostgreSQL, not by the string we send it:
 *
 * - whether `ON CONFLICT (...) WHERE revoked_at IS NULL` actually infers the
 *   partial unique index, rather than erroring or matching something else;
 * - whether the withdrawal really rolls back across two tables.
 *
 * Requires a dedicated variable pointing at a LOCAL database that is on an
 * explicit allowlist. It deliberately does not read `DATABASE_URL`; see
 * {@link resolveTestDatabaseUrl}.
 *
 * ```bash
 * CONSENT_SQL_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/fitmind_migtest pnpm --filter @fitmind/server run verify:consent-sql
 * ```
 */
import { createRequire } from "node:module";

import type { TestDatabaseConfig } from "../src/db/test-database-url.js";
import { resolveTestDatabaseUrl } from "../src/db/test-database-url.js";
import type { DbPoolLike as TransactionalPool } from "../src/db/user-health-data-repository.js";
import {
  createUserWithConsents,
  getConsentStatus,
  recordUserConsent,
} from "../src/db/user-consent-repository.js";
import {
  saveProfileWithHealthConsent,
  withdrawSensitiveHealthData,
} from "../src/db/user-health-data-repository.js";

const require = createRequire(import.meta.url);
const { Pool } = require("pg") as {
  Pool: new (config: TestDatabaseConfig) => {
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

const POLICY = "2026-08-07";

let failures = 0;

function check(label: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
    return;
  }

  failures += 1;
  console.log(
    `  FAIL  ${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`,
  );
}

async function main(): Promise<void> {
  const pool = new Pool(resolveTestDatabaseUrl(process.env));
  // Everything this script creates hangs off one probe user, so cleanup can be
  // scoped to that id. It never deletes rows it did not create — the earlier
  // `DELETE FROM users` "cleanup" was the most dangerous line in the repo.
  let probeUserId: string | null = null;

  try {
    console.log("\n[1] registration writes user + consent atomically");
    const user = await createUserWithConsents(
      {
        email: `probe-${Date.now()}@example.com`,
        passwordHash: "hash",
        displayName: "Probe",
        consents: [
          {
            consentType: "cross_border_transfer",
            policyVersion: POLICY,
            source: "registration",
          },
        ],
      },
      pool,
    );
    probeUserId = user.id;
    const afterRegister = await getConsentStatus(user.id, POLICY, pool);
    check(
      "consent is live after registration",
      afterRegister.hasCrossBorderConsent,
    );

    console.log("\n[2] re-submitting a live consent does not restamp it");
    const first = await pool.query(
      "SELECT id, accepted_at FROM user_consents WHERE user_id = $1",
      [user.id],
    );
    const firstRow = first.rows[0] as { id: string; accepted_at: string };
    await new Promise((resolve) => setTimeout(resolve, 25));
    const resubmitted = await recordUserConsent(
      {
        userId: user.id,
        consentType: "cross_border_transfer",
        policyVersion: POLICY,
        source: "consent_catchup",
      },
      pool,
    );
    check("ON CONFLICT inferred the partial index (no error)", true);
    check("same row returned", resubmitted.id === firstRow.id, {
      before: firstRow.id,
      after: resubmitted.id,
    });
    check(
      "accepted_at unchanged",
      new Date(resubmitted.accepted_at).getTime() ===
        new Date(firstRow.accepted_at).getTime(),
      { before: firstRow.accepted_at, after: resubmitted.accepted_at },
    );
    const rowCountAfterResubmit = await pool.query(
      "SELECT count(*)::int AS n FROM user_consents WHERE user_id = $1",
      [user.id],
    );
    check(
      "still exactly one row",
      (rowCountAfterResubmit.rows[0] as { n: number }).n === 1,
      rowCountAfterResubmit.rows[0],
    );

    console.log("\n[3] two live consents for the same version are rejected");
    let rejected = false;
    try {
      await pool.query(
        `INSERT INTO user_consents (user_id, consent_type, policy_version, source)
         VALUES ($1, 'cross_border_transfer', $2, 'registration')`,
        [user.id, POLICY],
      );
    } catch (error) {
      rejected = (error as { code?: string }).code === "23505";
    }
    check("partial unique index enforced", rejected);

    console.log("\n[4] grant -> revoke -> grant keeps the full history");
    await pool.query(
      `INSERT INTO athlete_profiles (user_id, goal, weekly_days, injury_constraints)
       VALUES ($1, 'strength', 3, ARRAY['knee'])`,
      [user.id],
    );
    await recordUserConsent(
      {
        userId: user.id,
        consentType: "sensitive_health_data",
        policyVersion: POLICY,
        source: "profile_form",
      },
      pool,
    );
    const healthGrant = await pool.query(
      `SELECT id, accepted_at FROM user_consents
       WHERE user_id = $1 AND consent_type = 'sensitive_health_data'`,
      [user.id],
    );
    const grantRow = healthGrant.rows[0] as { id: string; accepted_at: string };

    await withdrawSensitiveHealthData(user.id, pool);

    const afterWithdraw = await getConsentStatus(user.id, POLICY, pool);
    check("health consent no longer counts", !afterWithdraw.hasHealthConsent);
    check("injury data cleared", !afterWithdraw.hasStoredInjuryData);

    await new Promise((resolve) => setTimeout(resolve, 25));
    await recordUserConsent(
      {
        userId: user.id,
        consentType: "sensitive_health_data",
        policyVersion: POLICY,
        source: "profile_form",
      },
      pool,
    );

    const history = await pool.query(
      `SELECT id, accepted_at, revoked_at FROM user_consents
       WHERE user_id = $1 AND consent_type = 'sensitive_health_data'
       ORDER BY accepted_at`,
      [user.id],
    );
    const rows = history.rows as {
      id: string;
      accepted_at: string;
      revoked_at: string | null;
    }[];
    check("two rows, not one rewritten row", rows.length === 2, rows);
    check(
      "the original grant is still there, unrewritten",
      rows[0]?.id === grantRow.id &&
        new Date(rows[0].accepted_at).getTime() ===
          new Date(grantRow.accepted_at).getTime(),
      { original: grantRow, stored: rows[0] },
    );
    check("the withdrawal is still recorded", rows[0]?.revoked_at !== null);
    check("the new grant is live", rows[1]?.revoked_at === null);

    console.log("\n[5] withdrawal rolls back across both tables on failure");
    await pool.query(
      `UPDATE athlete_profiles SET injury_constraints = ARRAY['shoulder'] WHERE user_id = $1`,
      [user.id],
    );
    const beforeRollback = await getConsentStatus(user.id, POLICY, pool);
    check(
      "precondition: data present and consent live",
      beforeRollback.hasStoredInjuryData && beforeRollback.hasHealthConsent,
    );

    // Wraps a real client and throws when the repository issues the second
    // UPDATE, so the statement never reaches the server. Everything before it —
    // BEGIN and the `athlete_profiles` update — is executed for real against
    // PostgreSQL, which is what makes the assertions below meaningful: they
    // check that a genuinely applied statement was undone, not that a stub
    // remembered not to apply it.
    const failingPool: TransactionalPool = {
      query: (sql, params) => pool.query(sql, params),
      connect: async () => {
        const client = await pool.connect();

        return {
          query: async (sql, params) => {
            if (sql.includes("UPDATE user_consents")) {
              throw new Error("simulated failure inside the transaction");
            }

            return client.query(sql, params);
          },
          release: () => {
            client.release();
          },
        };
      },
    };

    let rolledBack = false;
    try {
      await withdrawSensitiveHealthData(user.id, failingPool);
    } catch {
      rolledBack = true;
    }
    check("failure surfaced", rolledBack);

    const afterRollback = await getConsentStatus(user.id, POLICY, pool);
    check(
      "injury data still present after rollback",
      afterRollback.hasStoredInjuryData,
    );
    check(
      "health consent still live after rollback",
      afterRollback.hasHealthConsent,
    );

    console.log("\n[6] clearing the injury list through a profile save");
    // fitmind-lmy. The unit tests can only assert that the right SQL text was
    // sent; whether an empty save actually ends the consent, survives a repeat,
    // and forces the next non-empty save to ask again is decided here.
    await pool.query(
      `UPDATE athlete_profiles
          SET goal = 'endurance', weekly_days = 5,
              available_equipment = ARRAY['barbell'],
              injury_constraints = ARRAY['knee', 'shoulder']
        WHERE user_id = $1`,
      [user.id],
    );
    const beforeClear = await getConsentStatus(user.id, POLICY, pool);
    check(
      "precondition: injury data stored and health consent live",
      beforeClear.hasStoredInjuryData && beforeClear.hasHealthConsent,
      beforeClear,
    );

    const cleared = await saveProfileWithHealthConsent(
      {
        userId: user.id,
        goal: "endurance",
        weeklyDays: 5,
        availableEquipment: ["barbell"],
        injuryConstraints: [],
        policyVersion: POLICY,
      },
      pool,
    );
    check("the empty save is accepted", cleared.status === "saved", cleared);

    const afterClear = await getConsentStatus(user.id, POLICY, pool);
    check("injury data is gone", !afterClear.hasStoredInjuryData, afterClear);
    check(
      "the health consent is no longer live",
      !afterClear.hasHealthConsent,
      afterClear,
    );
    // The consent that lets the account exist at all must survive a health-data
    // withdrawal; revoking it here would log the user out of their own data.
    check(
      "the cross-border consent is untouched",
      afterClear.hasCrossBorderConsent,
      afterClear,
    );

    const profileAfterClear = await pool.query(
      `SELECT goal, weekly_days, available_equipment
         FROM athlete_profiles WHERE user_id = $1`,
      [user.id],
    );
    const keptFields = profileAfterClear.rows[0] as {
      goal: string;
      weekly_days: number;
      available_equipment: string[];
    };
    check(
      "the rest of the profile is preserved",
      keptFields.goal === "endurance" &&
        keptFields.weekly_days === 5 &&
        keptFields.available_equipment.join() === "barbell",
      keptFields,
    );

    const revokedStamp = await pool.query(
      `SELECT count(*)::int AS n, max(revoked_at) AS stamp FROM user_consents
        WHERE user_id = $1 AND consent_type = 'sensitive_health_data'`,
      [user.id],
    );
    const beforeRepeat = revokedStamp.rows[0] as { n: number; stamp: string };

    await new Promise((resolve) => setTimeout(resolve, 25));
    const repeated = await saveProfileWithHealthConsent(
      {
        userId: user.id,
        goal: "endurance",
        weeklyDays: 5,
        availableEquipment: ["barbell"],
        injuryConstraints: [],
        policyVersion: POLICY,
      },
      pool,
    );
    check("a repeat empty save still succeeds", repeated.status === "saved");

    const afterRepeat = (
      await pool.query(
        `SELECT count(*)::int AS n, max(revoked_at) AS stamp FROM user_consents
          WHERE user_id = $1 AND consent_type = 'sensitive_health_data'`,
        [user.id],
      )
    ).rows[0] as { n: number; stamp: string };
    check(
      "no consent row was added by the repeat",
      afterRepeat.n === beforeRepeat.n,
      { before: beforeRepeat.n, after: afterRepeat.n },
    );
    // When the withdrawal happened is the fact this row exists to record.
    check(
      "the revocation timestamp was not rewritten",
      new Date(afterRepeat.stamp).getTime() ===
        new Date(beforeRepeat.stamp).getTime(),
      { before: beforeRepeat.stamp, after: afterRepeat.stamp },
    );

    const refillWithoutConsent = await saveProfileWithHealthConsent(
      {
        userId: user.id,
        goal: "endurance",
        weeklyDays: 5,
        availableEquipment: ["barbell"],
        injuryConstraints: ["knee"],
        policyVersion: POLICY,
      },
      pool,
    );
    check(
      "refilling without a new decision is refused",
      refillWithoutConsent.status === "consent_missing",
      refillWithoutConsent,
    );
    const afterRefusedRefill = await getConsentStatus(user.id, POLICY, pool);
    check(
      "the refused refill stored nothing",
      !afterRefusedRefill.hasStoredInjuryData,
      afterRefusedRefill,
    );

    const refillWithConsent = await saveProfileWithHealthConsent(
      {
        userId: user.id,
        goal: "endurance",
        weeklyDays: 5,
        availableEquipment: ["barbell"],
        injuryConstraints: ["knee"],
        policyVersion: POLICY,
        consentDecision: { accepted: true, policy_version: POLICY },
      },
      pool,
    );
    check(
      "refilling with a fresh decision is accepted",
      refillWithConsent.status === "saved",
      refillWithConsent,
    );

    const lifecycle = (
      await pool.query(
        `SELECT revoked_at FROM user_consents
          WHERE user_id = $1 AND consent_type = 'sensitive_health_data'
          ORDER BY accepted_at`,
        [user.id],
      )
    ).rows as { revoked_at: string | null }[];
    check(
      "the withdrawn rows are kept as history and only the new one is live",
      lifecycle.length === beforeRepeat.n + 1 &&
        lifecycle.filter((row) => row.revoked_at === null).length === 1 &&
        lifecycle.at(-1)?.revoked_at === null,
      lifecycle,
    );

    console.log("\n[7] the clearing save rolls back from either side");
    // Both halves, separately. A boundary that is wrong in one direction
    // revokes a consent for data that is still stored; wrong in the other it
    // deletes the data and leaves the permission live. Each injection is
    // checked against the real committed state, not against a stub's memory.
    const beforeFailures = await getConsentStatus(user.id, POLICY, pool);
    check(
      "precondition: injury data stored and health consent live",
      beforeFailures.hasStoredInjuryData && beforeFailures.hasHealthConsent,
      beforeFailures,
    );

    async function clearingSaveFailingOn(
      statement: string,
    ): Promise<{ threw: boolean }> {
      const failing: TransactionalPool = {
        query: (sql, params) => pool.query(sql, params),
        connect: async () => {
          const client = await pool.connect();

          return {
            query: async (sql, params) => {
              if (sql.includes(statement)) {
                throw new Error("simulated failure inside the transaction");
              }

              return client.query(sql, params);
            },
            release: () => {
              client.release();
            },
          };
        },
      };

      try {
        await saveProfileWithHealthConsent(
          {
            userId: user.id,
            goal: "endurance",
            weeklyDays: 5,
            availableEquipment: ["barbell"],
            injuryConstraints: [],
            policyVersion: POLICY,
          },
          failing,
        );

        return { threw: false };
      } catch {
        return { threw: true };
      }
    }

    for (const statement of [
      "INSERT INTO athlete_profiles",
      "UPDATE user_consents",
    ]) {
      const failed = await clearingSaveFailingOn(statement);
      check(`failure on \`${statement}\` surfaced`, failed.threw);

      const afterFailure = await getConsentStatus(user.id, POLICY, pool);
      check(
        `injury data survives a failure on \`${statement}\``,
        afterFailure.hasStoredInjuryData,
        afterFailure,
      );
      check(
        `the consent stays live after a failure on \`${statement}\``,
        afterFailure.hasHealthConsent,
        afterFailure,
      );
    }

    console.log("\n[8] the explicit withdrawal touches only health data");
    const profileBeforeExplicit = (
      await pool.query(
        `SELECT goal, weekly_days, available_equipment
           FROM athlete_profiles WHERE user_id = $1`,
        [user.id],
      )
    ).rows[0] as {
      goal: string;
      weekly_days: number;
      available_equipment: string[];
    };

    await withdrawSensitiveHealthData(user.id, pool);

    const afterExplicit = await getConsentStatus(user.id, POLICY, pool);
    check(
      "injury data and health consent are both gone",
      !afterExplicit.hasStoredInjuryData && !afterExplicit.hasHealthConsent,
      afterExplicit,
    );
    // Withdrawing one category must not remove the consent the account depends
    // on, nor quietly reset settings the user did agree to.
    check(
      "the cross-border consent survives",
      afterExplicit.hasCrossBorderConsent,
      afterExplicit,
    );

    const profileAfterExplicit = (
      await pool.query(
        `SELECT goal, weekly_days, available_equipment
           FROM athlete_profiles WHERE user_id = $1`,
        [user.id],
      )
    ).rows[0] as {
      goal: string;
      weekly_days: number;
      available_equipment: string[];
    };
    check(
      "goal, weekly days and equipment are unchanged",
      profileAfterExplicit.goal === profileBeforeExplicit.goal &&
        profileAfterExplicit.weekly_days ===
          profileBeforeExplicit.weekly_days &&
        profileAfterExplicit.available_equipment.join() ===
          profileBeforeExplicit.available_equipment.join(),
      { before: profileBeforeExplicit, after: profileAfterExplicit },
    );

    console.log("\n[9] a superseded-version consent is still withdrawable");
    // The state that hid the withdrawal control: a live consent to wording no
    // longer served. The two flags must disagree here — that disagreement is
    // the whole point of having two — and the withdrawal must still reach it.
    // Asserted against real rows because the bug was precisely that one
    // version-scoped query stood in for a version-independent question.
    const supersededPolicy = "2025-01-01";
    await pool.query(
      `INSERT INTO user_consents (user_id, consent_type, policy_version, source)
       VALUES ($1, 'sensitive_health_data', $2, 'profile_form')`,
      [user.id, supersededPolicy],
    );

    const staleStatus = await getConsentStatus(user.id, POLICY, pool);
    check(
      "it does not count as consent to the current policy",
      !staleStatus.hasHealthConsent,
      staleStatus,
    );
    check(
      "it does count as something the user can withdraw",
      staleStatus.hasWithdrawableHealthConsent,
      staleStatus,
    );
    check(
      "no injury data is stored, so only the consent is left to withdraw",
      !staleStatus.hasStoredInjuryData,
      staleStatus,
    );

    await withdrawSensitiveHealthData(user.id, pool);

    const afterStaleWithdraw = await getConsentStatus(user.id, POLICY, pool);
    check(
      "the withdrawal reaches it despite the version mismatch",
      !afterStaleWithdraw.hasWithdrawableHealthConsent,
      afterStaleWithdraw,
    );
    const staleRow = (
      await pool.query(
        `SELECT revoked_at FROM user_consents
          WHERE user_id = $1 AND policy_version = $2`,
        [user.id, supersededPolicy],
      )
    ).rows[0] as { revoked_at: string | null };
    check("the row is revoked, not deleted", staleRow.revoked_at !== null);
    check(
      "the cross-border consent is still untouched",
      afterStaleWithdraw.hasCrossBorderConsent,
      afterStaleWithdraw,
    );

    console.log("\n[10] deleting the user cascades to consents and profile");
    await pool.query("DELETE FROM users WHERE id = $1", [user.id]);
    const leftovers = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM user_consents WHERE user_id = $1) AS consents,
         (SELECT count(*)::int FROM athlete_profiles WHERE user_id = $1) AS profiles`,
      [user.id],
    );
    const counts = leftovers.rows[0] as { consents: number; profiles: number };
    check("no consent rows left", counts.consents === 0, counts);
    check("no profile rows left", counts.profiles === 0, counts);
    probeUserId = null;
  } finally {
    // Scoped to the one row this run created, so a mid-run failure leaves the
    // database tidy without ever touching anything else in it.
    if (probeUserId !== null) {
      await pool.query("DELETE FROM users WHERE id = $1", [probeUserId]);
    }

    await pool.end();
  }

  console.log(
    `\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`,
  );

  if (failures > 0) {
    process.exitCode = 1;
  }
}

await main();
