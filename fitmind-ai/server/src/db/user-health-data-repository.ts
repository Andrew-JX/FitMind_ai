import { createRequire } from "node:module";

import type { AthleteProfileRow } from "./athlete-profile-repository.js";
import { LIVE_HEALTH_CONSENT_PREDICATE } from "./user-consent-repository.js";
import { loadServerEnv } from "../env.js";

interface DbQueryable {
  query: (
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: unknown[]; rowCount?: number | null }>;
}

interface DbClientLike extends DbQueryable {
  release: () => void;
}

export interface DbPoolLike extends DbQueryable {
  connect?: () => Promise<DbClientLike>;
  end?: () => Promise<void>;
}

export interface HealthConsentDecision {
  accepted: boolean;
  policy_version: string;
}

export interface SaveProfileInput {
  userId: string;
  goal: string;
  weeklyDays: number;
  availableEquipment: string[];
  injuryConstraints: string[];
  policyVersion: string;
  consentDecision?: HealthConsentDecision | undefined;
}

/**
 * Why a save was refused, so the service can raise the same errors it always
 * has without the repository knowing about HTTP.
 */
export type SaveProfileResult =
  | { status: "saved"; row: AthleteProfileRow }
  | { status: "consent_missing" }
  | { status: "consent_stale" };

const require = createRequire(import.meta.url);

const PROFILE_COLUMNS = `
  user_id,
  goal,
  weekly_days,
  available_equipment,
  injury_constraints,
  created_at,
  updated_at
`;

async function createRepositoryPool(): Promise<DbPoolLike> {
  const env = loadServerEnv();

  if (env.databaseUrl === undefined) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  const { Pool } = require("pg") as {
    Pool: new (config: { connectionString: string }) => DbPoolLike;
  };

  return new Pool({ connectionString: env.databaseUrl });
}

/**
 * Take the per-user write lock that every mutation in this module shares.
 *
 * @param client - Client already inside a transaction
 * @param userId - User whose health data is about to change
 * @throws When the user does not exist, rather than proceeding unlocked
 *
 * @remarks
 * This is the whole serialization protocol, in one function, so the lock order
 * is a single reviewable fact rather than something to reconstruct from two
 * call sites. Both mutations take this lock **first** and hold it across the
 * consent read and the data write.
 *
 * A transaction alone does not fix the race it exists for. Postgres's default
 * READ COMMITTED lets a save read "consent is live", a withdrawal commit in the
 * gap, and the save then write injury data back — both transactions perfectly
 * atomic, the combined result invalid. Serializing on the `users` row is what
 * makes "check consent, then write" indivisible.
 *
 * A missing row throws instead of falling through: `FOR UPDATE` on zero rows
 * locks nothing and would silently restore exactly the behaviour being fixed.
 */
async function lockUserRow(client: DbQueryable, userId: string): Promise<void> {
  const lock = await client.query(
    "SELECT id FROM users WHERE id = $1 FOR UPDATE",
    [userId],
  );

  if (lock.rows.length === 0) {
    throw new Error(
      "Cannot change health data for a user that does not exist: nothing to lock.",
    );
  }
}

/**
 * Close every still-live health consent for a user, on the caller's client.
 *
 * @param client - Client already holding the per-user lock in a transaction
 * @returns Resolves once the rows are stamped
 *
 * @remarks
 * Takes the client rather than a pool, which is the whole point: both
 * withdrawal entry points — clearing the field through a profile save, and the
 * explicit `DELETE` endpoint — must revoke on the connection that already holds
 * the lock. Anything that opened its own connection here would be a second lock
 * order and an unlocked bypass of {@link lockUserRow}.
 *
 * Not filtered by policy version, and sharing
 * {@link LIVE_HEALTH_CONSENT_PREDICATE} with the check that decides whether
 * there is anything to withdraw. The user is withdrawing the *category*, not
 * their agreement to one particular wording.
 *
 * A live row under a superseded version would not let the next save through —
 * that recheck is version-scoped, by design. What it would do is leave a
 * standing permission on record after the user asked for it to be gone, which
 * is the thing art. 15 is about.
 *
 * `revoked_at IS NULL` makes it idempotent: an already-revoked row keeps its
 * original timestamp, so repeated empty saves cannot rewrite when the
 * withdrawal happened.
 */
export async function revokeLiveHealthConsentsIfNoStoredData(
  client: DbQueryable,
  userId: string,
): Promise<void> {
  await client.query(
    `
      UPDATE user_consents
      SET revoked_at = now()
      WHERE user_id = $1
        AND ${LIVE_HEALTH_CONSENT_PREDICATE}
        AND NOT EXISTS (
          SELECT 1 FROM athlete_profiles
          WHERE user_id = $1
            AND coalesce(array_length(injury_constraints, 1), 0) > 0
        )
        AND NOT EXISTS (
          SELECT 1 FROM menstrual_records
          WHERE user_id = $1
        )
        AND NOT EXISTS (
          SELECT 1 FROM body_measurements
          WHERE user_id = $1
        )
    `,
    [userId],
  );
}

export async function withLockedUser<T>(
  userId: string,
  pool: DbPoolLike | undefined,
  work: (client: DbQueryable) => Promise<T>,
): Promise<T> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  if (typeof activePool.connect !== "function") {
    throw new Error(
      "Changing health data requires a transactional pool that provides connect().",
    );
  }

  const client = await activePool.connect();

  try {
    await client.query("BEGIN");
    await lockUserRow(client, userId);

    const result = await work(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();

    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

export type EnsureHealthConsentResult =
  | { status: "available" }
  | { status: "consent_missing" }
  | { status: "consent_stale" };

/** Check or collect the current health consent while the caller holds the user lock. */
export async function ensureCurrentHealthConsent(
  client: DbQueryable,
  input: {
    userId: string;
    policyVersion: string;
    source: "profile_form" | "health_tool";
    consentDecision?: HealthConsentDecision | undefined;
  },
): Promise<EnsureHealthConsentResult> {
  const existing = await client.query(
    `
      SELECT 1 FROM user_consents
      WHERE user_id = $1
        AND consent_type = 'sensitive_health_data'
        AND policy_version = $2
        AND revoked_at IS NULL
      LIMIT 1
    `,
    [input.userId, input.policyVersion],
  );

  if (existing.rows.length > 0) {
    return { status: "available" };
  }

  const decision = input.consentDecision;

  if (decision === undefined || !decision.accepted) {
    return { status: "consent_missing" };
  }

  if (decision.policy_version !== input.policyVersion) {
    return { status: "consent_stale" };
  }

  await client.query(
    `
      INSERT INTO user_consents (
        user_id,
        consent_type,
        policy_version,
        source
      )
      VALUES ($1, 'sensitive_health_data', $2, $3)
      ON CONFLICT (user_id, consent_type, policy_version)
        WHERE revoked_at IS NULL
      DO UPDATE SET source = user_consents.source
    `,
    [input.userId, input.policyVersion, input.source],
  );

  return { status: "available" };
}

/**
 * Save an athlete profile, taking any required health consent with it.
 *
 * @param input - Normalized profile fields, policy version, and consent decision
 * @param pool - Optional injected pool (owns and closes its own pool otherwise)
 * @returns The saved row, or why the save was refused
 *
 * @remarks
 * The consent read, the consent insert and the profile write all happen on one
 * client inside one transaction, under the lock from {@link lockUserRow}. That
 * ordering is the fix: previously the consent check ran through its own
 * connection and the upsert through another, so a withdrawal could commit in
 * between and the save would restore injury data that no live consent covered.
 *
 * The consent is re-read **inside** the lock rather than trusted from earlier
 * in the request, which is what makes a save that started before a withdrawal
 * still see that withdrawal.
 *
 * A save whose normalized injury list is empty clears that sensitive field.
 * The live health consent is revoked in the same transaction only when no
 * menstrual or body-measurement data remains. Clearing one health category
 * must not silently revoke permission still needed by another category.
 *
 * No consent is *requested* on that path, though: nothing sensitive is being
 * stored, so there is nothing to have permission for.
 */
export async function saveProfileWithHealthConsent(
  input: SaveProfileInput,
  pool?: DbPoolLike,
): Promise<SaveProfileResult> {
  return withLockedUser(input.userId, pool, async (client) => {
    const needsConsent = input.injuryConstraints.length > 0;

    if (needsConsent) {
      const consent = await ensureCurrentHealthConsent(client, {
        userId: input.userId,
        policyVersion: input.policyVersion,
        source: "profile_form",
        ...(input.consentDecision === undefined
          ? {}
          : { consentDecision: input.consentDecision }),
      });

      if (consent.status !== "available") {
        return consent;
      }
    }

    const saved = await client.query(
      `
        INSERT INTO athlete_profiles (
          user_id,
          goal,
          weekly_days,
          available_equipment,
          injury_constraints,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, now())
        ON CONFLICT (user_id) DO UPDATE SET
          goal = EXCLUDED.goal,
          weekly_days = EXCLUDED.weekly_days,
          available_equipment = EXCLUDED.available_equipment,
          injury_constraints = EXCLUDED.injury_constraints,
          updated_at = now()
        RETURNING ${PROFILE_COLUMNS}
      `,
      [
        input.userId,
        input.goal,
        input.weeklyDays,
        input.availableEquipment,
        input.injuryConstraints,
      ],
    );

    if (!needsConsent) {
      await revokeLiveHealthConsentsIfNoStoredData(client, input.userId);
    }

    return {
      status: "saved",
      row: saved.rows[0] as AthleteProfileRow,
    } as const;
  });
}

/**
 * Clear a user's injury constraints and conditionally close health consent.
 *
 * @param userId - Owner user id
 * @param pool - Optional injected pool (owns and closes its own pool otherwise)
 * @returns Resolves once the data deletion and consent re-evaluation commit
 *
 * @remarks
 * Takes the same lock, in the same order, as
 * {@link saveProfileWithHealthConsent}. Making each side internally atomic was
 * not enough — the two could still interleave — so they serialize against each
 * other on the `users` row.
 *
 * Shares {@link revokeLiveHealthConsentsIfNoStoredData} with the empty-list
 * save path. The helper checks every supported sensitive health table before
 * stamping consent rows, so deleting injury data cannot affect body or cycle
 * records.
 */
export async function withdrawSensitiveHealthData(
  userId: string,
  pool?: DbPoolLike,
): Promise<void> {
  await withLockedUser(userId, pool, async (client) => {
    await client.query(
      `
        UPDATE athlete_profiles
        SET injury_constraints = '{}'::text[], updated_at = now()
        WHERE user_id = $1
      `,
      [userId],
    );

    await revokeLiveHealthConsentsIfNoStoredData(client, userId);
  });
}
