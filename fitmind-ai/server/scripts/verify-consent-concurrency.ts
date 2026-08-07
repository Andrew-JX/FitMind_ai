/**
 * Two-contender concurrency check for the per-user health-data lock.
 *
 * @remarks
 * Nothing mocked can decide this. The race in fitmind-9yz needs the two real
 * production write paths — `saveProfileWithHealthConsent` and
 * `withdrawSensitiveHealthData` — contending for the same user row in a real
 * PostgreSQL, in both orderings. A stub can only replay an ordering someone
 * already imagined.
 *
 * The earlier version of this script did not do that. Scenario A ran the
 * production save against a hand-written `UPDATE ... ; UPDATE ...` pair, and
 * scenario B was labelled "save wins" while never calling the save at all — it
 * held the lock with a bare `SELECT ... FOR UPDATE`. Both passed, and what they
 * proved was "a production function waits for a lock someone else holds", not
 * "these two functions serialize against each other". Verifying one thing and
 * shipping a claim about another is the failure this file exists to avoid.
 *
 * How both production functions are made to contend without editing either:
 * a third connection pins the `athlete_profiles` row first. The production
 * function that goes first takes the `users` lock, then blocks on that pinned
 * row — so it sits inside its transaction holding the `users` lock, with no
 * cooperation from its own code. The second production function is then started
 * and blocks on the `users` lock. Releasing the pin lets the pair drain in the
 * intended order.
 *
 * Barriers rather than sleeps, and scoped to specific backends. Waiting is
 * confirmed with `pg_blocking_pids` against the exact backend PID expected to
 * be doing the blocking, not "some ungranted lock exists somewhere in this
 * database" — which any unrelated session could have satisfied.
 *
 * ```bash
 * CONSENT_SQL_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/fitmind_migtest \
 *   pnpm --filter @fitmind/server run verify:consent-concurrency
 * ```
 */
import { createRequire } from "node:module";

import { resolveTestDatabaseUrl } from "../src/db/test-database-url.js";
import type { TestDatabaseConfig } from "../src/db/test-database-url.js";
import {
  saveProfileWithHealthConsent,
  withdrawSensitiveHealthData,
} from "../src/db/user-health-data-repository.js";

interface QueryResult {
  rows: unknown[];
  rowCount?: number | null;
}

interface Client {
  query: (sql: string, params?: readonly unknown[]) => Promise<QueryResult>;
  release: () => void;
}

interface Pool {
  query: (sql: string, params?: readonly unknown[]) => Promise<QueryResult>;
  connect: () => Promise<Client>;
  end: () => Promise<void>;
}

type PoolConfig = TestDatabaseConfig & {
  max?: number;
  options?: string;
  application_name?: string;
};

const require = createRequire(import.meta.url);
const { Pool } = require("pg") as {
  Pool: new (config: PoolConfig) => Pool;
};

const POLICY = "2026-08-07";
const CONSENT = { accepted: true, policy_version: POLICY };
/** Barrier ceiling: exceeding it is a failure, never a pass. */
const BARRIER_TIMEOUT_MS = 5_000;
/**
 * Server-side ceiling on any single wait, set well above the barrier so it only
 * fires when something is genuinely stuck.
 *
 * Found by running an earlier version against a build with the shared lock
 * removed: instead of failing, it hung — nobody can tell a hang from a slow
 * machine, so a gate that hangs when the thing it guards is removed is not a
 * gate. `lock_timeout` turns waiting into a loud, bounded error.
 */
const LOCK_TIMEOUT_MS = 15_000;
const SERVER_OPTIONS = `-c lock_timeout=${LOCK_TIMEOUT_MS} -c statement_timeout=${LOCK_TIMEOUT_MS * 3}`;

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

/**
 * A pool dedicated to one production call, identifiable in `pg_stat_activity`.
 *
 * @param config - Resolved test database configuration
 * @param name - Unique `application_name` for this contender
 * @returns A single-connection pool tagged with that name
 *
 * @remarks
 * One connection, one name, one scenario. That is what makes it possible to ask
 * PostgreSQL about *this* backend rather than about the database in general.
 */
function contenderPool(config: TestDatabaseConfig, name: string): Pool {
  return new Pool({
    ...config,
    max: 1,
    application_name: name,
    options: SERVER_OPTIONS,
  });
}

/**
 * Resolve the backend PID a contender pool is using.
 *
 * @param observer - Connection used only to look, never to contend
 * @param name - The contender's unique `application_name`
 * @returns That backend's PID
 * @throws When no such backend appears within the barrier ceiling
 */
async function backendPid(observer: Pool, name: string): Promise<number> {
  const deadline = Date.now() + BARRIER_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const found = await observer.query(
      "SELECT pid FROM pg_stat_activity WHERE application_name = $1",
      [name],
    );

    if (found.rows.length > 0) {
      return (found.rows[0] as { pid: number }).pid;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`No backend ever connected as "${name}".`);
}

/** The statement both production paths must be serialized on. */
const USER_LOCK_STATEMENT = /FROM users WHERE id = \$1 FOR UPDATE/;

/**
 * Wait until `waiter` is blocked specifically by `holder`.
 *
 * @param observer - Connection used only to look
 * @param waiter - PID expected to be waiting
 * @param holder - PID expected to be the reason
 * @param onStatement - Statement the waiter must be stalled inside, if given
 * @returns Whether that exact relationship was observed, with evidence
 *
 * @remarks
 * This is the assertion, not a pause before one. The predecessor asked whether
 * any ungranted lock existed anywhere, which an unrelated session — or the
 * harness's own bookkeeping — could satisfy while the two paths under test were
 * not serialized at all. `pg_blocking_pids` names who is waiting for whom.
 *
 * `onStatement` exists because "who blocks whom" turned out not to be enough on
 * its own. Removing the shared `users` lock and re-running left this check
 * green: without it the save simply queued behind the withdrawal on the profile
 * row instead, and `pg_blocking_pids` reports transactions ahead in a wait
 * queue just the same. Two paths that happen to touch one row in the same order
 * are not two paths that serialize; only the state assertions caught the
 * difference. Naming the statement the waiter must be stalled inside is what
 * makes this check about the shared lock rather than about incidental queueing.
 *
 * Returns rather than throws so a missing wait is reported as a failed check
 * with the observed evidence attached, and the scenario continues to its state
 * assertions instead of unwinding at the first surprise.
 */
async function waitForBlockedBy(
  observer: Pool,
  waiter: number,
  holder: number,
  onStatement?: RegExp,
): Promise<{ blocked: boolean; blockers: number[]; query: string }> {
  const deadline = Date.now() + BARRIER_TIMEOUT_MS;
  let blockers: number[] = [];
  let query = "";

  while (Date.now() < deadline) {
    const observed = await observer.query(
      `SELECT pg_blocking_pids(pid) AS blockers, query
         FROM pg_stat_activity WHERE pid = $1`,
      [waiter],
    );
    const row = observed.rows[0] as
      | { blockers: number[]; query: string | null }
      | undefined;

    blockers = row?.blockers ?? [];
    query = row?.query ?? "";

    if (
      blockers.includes(holder) &&
      (onStatement === undefined || onStatement.test(query))
    ) {
      return { blocked: true, blockers, query };
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  return { blocked: false, blockers, query };
}

async function seedUser(pool: Pool): Promise<string> {
  const created = await pool.query(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, 'hash', 'Race Probe') RETURNING id`,
    [
      `race-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    ],
  );
  const userId = (created.rows[0] as { id: string }).id;

  await pool.query(
    `INSERT INTO athlete_profiles (user_id, goal, weekly_days, injury_constraints)
     VALUES ($1, 'strength', 3, ARRAY['knee'])`,
    [userId],
  );
  await pool.query(
    `INSERT INTO user_consents (user_id, consent_type, policy_version, source)
     VALUES ($1, 'sensitive_health_data', $2, 'profile_form')`,
    [userId, POLICY],
  );

  return userId;
}

async function readState(
  pool: Pool,
  userId: string,
): Promise<{ injuries: number; liveConsents: number }> {
  const state = await pool.query(
    `SELECT
       (SELECT coalesce(array_length(injury_constraints, 1), 0)
          FROM athlete_profiles WHERE user_id = $1) AS injuries,
       (SELECT count(*)::int FROM user_consents
          WHERE user_id = $1
            AND consent_type = 'sensitive_health_data'
            AND policy_version = $2
            AND revoked_at IS NULL) AS "liveConsents"`,
    [userId, POLICY],
  );

  return state.rows[0] as { injuries: number; liveConsents: number };
}

/**
 * Pin the profile row so whichever production function runs first stalls there
 * — inside its transaction, still holding the `users` lock.
 *
 * @param pool - Observer pool; the pin gets its own connection from it
 * @param userId - User whose profile row is pinned
 * @returns The pin's backend PID and a release that commits and disconnects
 *
 * @remarks
 * The pin never touches the `users` row. It exists only to stop the clock at a
 * point *after* the production function has taken the real lock, so that the
 * lock being tested is always the production one.
 */
async function pinProfileRow(pool: Pool, userId: string) {
  const client = await pool.connect();
  let released = false;

  await client.query("BEGIN");
  await client.query(`SET LOCAL lock_timeout = ${LOCK_TIMEOUT_MS}`);
  await client.query(
    "SELECT user_id FROM athlete_profiles WHERE user_id = $1 FOR UPDATE",
    [userId],
  );

  const pid = (
    (await client.query("SELECT pg_backend_pid() AS pid")).rows[0] as {
      pid: number;
    }
  ).pid;

  return {
    pid,
    async release() {
      if (released) {
        return;
      }

      released = true;
      await client.query("COMMIT");
      client.release();
    },
  };
}

/**
 * Run both production paths against each other in one ordering.
 *
 * @param options - Which path goes first, and the connections to run them on
 * @returns Both results once the pair has drained
 *
 * @remarks
 * `first` and `second` are the production functions themselves. Neither is
 * given a hook, a flag, or a stand-in: the only thing the harness controls is
 * *when* each is started and when the pin is released.
 */
async function contend<A, B>(options: {
  observer: Pool;
  userId: string;
  firstName: string;
  secondName: string;
  first: () => Promise<A>;
  second: () => Promise<B>;
}): Promise<{ first: A; second: B }> {
  const pin = await pinProfileRow(options.observer, options.userId);

  try {
    const first = options.first();
    const firstPid = await backendPid(options.observer, options.firstName);
    const firstStalled = await waitForBlockedBy(
      options.observer,
      firstPid,
      pin.pid,
    );
    check(
      `${options.firstName} holds the user lock and is stalled on the pinned row`,
      firstStalled.blocked,
      firstStalled,
    );

    const second = options.second();
    const secondPid = await backendPid(options.observer, options.secondName);
    const secondBlocked = await waitForBlockedBy(
      options.observer,
      secondPid,
      firstPid,
      USER_LOCK_STATEMENT,
    );
    check(
      `${options.secondName} waits for ${options.firstName} inside the shared user lock`,
      secondBlocked.blocked,
      { ...secondBlocked, expectedHolder: firstPid },
    );

    await pin.release();

    return { first: await first, second: await second };
  } finally {
    await pin.release();
  }
}

async function main(): Promise<void> {
  const config = resolveTestDatabaseUrl(process.env);
  const observer = new Pool({ ...config, max: 4, options: SERVER_OPTIONS });
  const created: string[] = [];
  const pools: Pool[] = [];

  function contender(name: string): Pool {
    const pool = contenderPool(config, name);
    pools.push(pool);
    return pool;
  }

  try {
    console.log(
      "\n[A] withdrawal wins the lock; the concurrent save must not undo it",
    );
    {
      const userId = await seedUser(observer);
      created.push(userId);

      const withdrawPool = contender("race-a-withdraw");
      const savePool = contender("race-a-save");

      // The save carries no consent decision and starts while the consent it
      // would have read is still live — the interleaving that used to win.
      const results = await contend({
        observer,
        userId,
        firstName: "race-a-withdraw",
        secondName: "race-a-save",
        first: () => withdrawSensitiveHealthData(userId, withdrawPool),
        second: () =>
          saveProfileWithHealthConsent(
            {
              userId,
              goal: "strength",
              weeklyDays: 3,
              availableEquipment: [],
              injuryConstraints: ["knee"],
              policyVersion: POLICY,
            },
            savePool,
          ),
      });

      check(
        "the save is refused after re-reading consent under the lock",
        results.second.status === "consent_missing",
        results.second,
      );

      const state = await readState(observer, userId);
      check(
        "no injury data was restored",
        state.injuries === 0 && state.liveConsents === 0,
        state,
      );
    }

    console.log("\n[B] save wins the lock; the withdrawal still ends last");
    {
      const userId = await seedUser(observer);
      created.push(userId);

      const savePool = contender("race-b-save");
      const withdrawPool = contender("race-b-withdraw");

      const results = await contend({
        observer,
        userId,
        firstName: "race-b-save",
        secondName: "race-b-withdraw",
        first: () =>
          saveProfileWithHealthConsent(
            {
              userId,
              goal: "strength",
              weeklyDays: 3,
              availableEquipment: [],
              injuryConstraints: ["knee", "shoulder"],
              policyVersion: POLICY,
            },
            savePool,
          ),
        second: () => withdrawSensitiveHealthData(userId, withdrawPool),
      });

      // Asserted so that "the withdrawal won" cannot be satisfied by a save
      // that simply failed. It committed injury data; the withdrawal removed it.
      check(
        "the save committed first",
        results.first.status === "saved",
        results.first,
      );

      const state = await readState(observer, userId);
      check(
        "final state has neither injury data nor a live consent",
        state.injuries === 0 && state.liveConsents === 0,
        state,
      );
    }

    console.log(
      "\n[C] the invariant holds after a save that does carry consent",
    );
    {
      const userId = await seedUser(observer);
      created.push(userId);

      await withdrawSensitiveHealthData(userId, observer);

      const result = await saveProfileWithHealthConsent(
        {
          userId,
          goal: "strength",
          weeklyDays: 3,
          availableEquipment: [],
          injuryConstraints: ["shoulder"],
          policyVersion: POLICY,
          consentDecision: CONSENT,
        },
        observer,
      );

      check("the save succeeds", result.status === "saved", result);

      const state = await readState(observer, userId);
      check(
        "injury data implies a live consent",
        state.injuries > 0 && state.liveConsents === 1,
        state,
      );
    }
  } finally {
    for (const pool of pools) {
      await pool.end();
    }

    for (const userId of created) {
      await observer.query("DELETE FROM users WHERE id = $1", [userId]);
    }

    await observer.end();
  }

  console.log(
    `\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`,
  );

  if (failures > 0) {
    process.exitCode = 1;
  }
}

await main();
