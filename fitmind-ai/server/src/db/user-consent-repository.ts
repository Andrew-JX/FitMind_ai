import { createRequire } from "node:module";

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

/**
 * Exported so callers that build a stand-in pool — the real-Postgres
 * verification script injects one to force a mid-transaction failure — can be
 * typed against it instead of reaching for a cast.
 */
export interface DbPoolLike extends DbQueryable {
  /** Present on real pools; required only by the transactional write below. */
  connect?: () => Promise<DbClientLike>;
  end?: () => Promise<void>;
}

/**
 * Consents tracked separately because they are asked separately: art. 39
 * cross-border storage at registration, art. 28/29 health data when the injury
 * field or personal health tool is first saved. Mirrors
 * `shared/src/consent.ts`, which the server does not import — see
 * `utils/http-error.ts` for the same deliberate duplication.
 */
export type ConsentType = "cross_border_transfer" | "sensitive_health_data";

/** Where a consent was collected. Mirrors the `source` column's check. */
export type ConsentSource =
  | "registration"
  | "profile_form"
  | "health_tool"
  | "consent_catchup";

export interface UserConsentRow {
  id: string;
  user_id: string;
  consent_type: ConsentType;
  policy_version: string;
  accepted_at: string;
  revoked_at: string | null;
  source: ConsentSource;
}

export interface ConsentToRecord {
  consentType: ConsentType;
  policyVersion: string;
  source: ConsentSource;
}

export interface CreateUserWithConsentsInput {
  email: string;
  passwordHash: string;
  displayName?: string | null | undefined;
  consents: readonly ConsentToRecord[];
}

export interface CreatedUserRow {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

const require = createRequire(import.meta.url);

const CONSENT_COLUMNS = `
  id,
  user_id,
  consent_type,
  policy_version,
  accepted_at,
  revoked_at,
  source
`;

async function createRepositoryPool(): Promise<DbPoolLike> {
  const env = loadServerEnv();

  if (env.databaseUrl === undefined) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  const { Pool } = require("pg") as {
    Pool: new (config: { connectionString: string }) => DbPoolLike;
  };

  return new Pool({
    connectionString: env.databaseUrl,
  });
}

/**
 * Create a user and their registration consents in a single transaction.
 *
 * @param input - User fields plus the consents collected alongside them
 * @param pool - Optional injected pool (owns and closes its own pool otherwise)
 * @returns The inserted user row
 *
 * @remarks
 * The transaction is the requirement, not an optimization. Two separate writes
 * can leave an account that exists with no record of the consent that legally
 * permitted creating it — and that failure is invisible, because the user is
 * signed in and everything looks fine. Either both rows land or neither does.
 *
 * Requires a pool that can `connect()`. A queryable-only stub would run the
 * statements outside any transaction while appearing to succeed, so this
 * throws rather than silently degrading to the behaviour it exists to prevent.
 */
export async function createUserWithConsents(
  input: CreateUserWithConsentsInput,
  pool?: DbPoolLike,
): Promise<CreatedUserRow> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  if (typeof activePool.connect !== "function") {
    throw new Error(
      "Registering a user requires a transactional pool that provides connect().",
    );
  }

  const client = await activePool.connect();

  try {
    await client.query("BEGIN");

    const created = await client.query(
      `
        INSERT INTO users (email, password_hash, display_name)
        VALUES ($1, $2, $3)
        RETURNING
          id,
          email,
          password_hash AS "passwordHash",
          display_name AS "displayName",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [input.email, input.passwordHash, input.displayName ?? null],
    );

    const createdUser = created.rows[0] as CreatedUserRow;

    for (const consent of input.consents) {
      await client.query(
        `
          INSERT INTO user_consents (
            user_id,
            consent_type,
            policy_version,
            source
          )
          VALUES ($1, $2, $3, $4)
        `,
        [
          createdUser.id,
          consent.consentType,
          consent.policyVersion,
          consent.source,
        ],
      );
    }

    await client.query("COMMIT");

    return createdUser;
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

/**
 * Record a consent given outside the registration flow.
 *
 * @param input - Consent to persist, keyed by user id
 * @param pool - Optional injected pool (owns and closes its own pool otherwise)
 * @returns The stored consent row
 *
 * @remarks
 * Append-only. Re-submitting a consent that is currently live returns the
 * existing row untouched — the conflict target is the partial unique index over
 * live rows, and the `DO UPDATE` is a deliberate no-op that exists only so
 * `RETURNING` yields that row. Refreshing `accepted_at` there would overwrite
 * when they actually agreed with when they last loaded the page.
 *
 * Consenting again after a withdrawal inserts a **new** row instead of reviving
 * the old one. That matters: an earlier version reused the row, so grant →
 * revoke → grant left only the last grant, and both the first permission window
 * and the withdrawal itself vanished. A table whose stated purpose is answering
 * "was this processing permitted at time T" cannot rewrite its own history.
 */
export async function recordUserConsent(
  input: ConsentToRecord & { userId: string },
  pool?: DbPoolLike,
): Promise<UserConsentRow> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        INSERT INTO user_consents (
          user_id,
          consent_type,
          policy_version,
          source
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, consent_type, policy_version)
          WHERE revoked_at IS NULL
        DO UPDATE SET source = user_consents.source
        RETURNING ${CONSENT_COLUMNS}
      `,
      [input.userId, input.consentType, input.policyVersion, input.source],
    );

    return result.rows[0] as UserConsentRow;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * The rows a health-data withdrawal would revoke, as one SQL predicate.
 *
 * @remarks
 * Exported so the withdrawal and the "is there anything to withdraw" check are
 * the *same* condition rather than two conditions someone keeps in agreement by
 * hand. They had already drifted once: the revocation deliberately ignores
 * `policy_version` (the user is taking back the category, not one version's
 * wording), while the flag driving the UI control was version-scoped. A live
 * consent to superseded wording was therefore revocable by the server and
 * invisible to the user — a permission nobody could reach.
 *
 * Written without a `user_id` term so both call sites keep it as `$1` and this
 * stays a fragment about *which consents are live*, not about whose.
 */
export const LIVE_HEALTH_CONSENT_PREDICATE = `
  consent_type = 'sensitive_health_data'
  AND revoked_at IS NULL
`;

export interface ConsentStatus {
  hasCrossBorderConsent: boolean;
  hasHealthConsent: boolean;
  /**
   * Whether any live health consent exists, at any policy version.
   *
   * @remarks
   * Distinct from `hasHealthConsent` on purpose, and the two must not be
   * merged. `hasHealthConsent` answers "may we store injury data under the
   * text we serve today", so it stays version-scoped — a stale consent must
   * still make a health form ask again. This one answers "is there a permission on
   * file the user could take back", which is version-independent.
   */
  hasWithdrawableHealthConsent: boolean;
  /** Whether the user actually has injury constraints stored right now. */
  hasStoredInjuryData: boolean;
  /** Whether any supported sensitive health record is stored right now. */
  hasStoredHealthData?: boolean | undefined;
}

/**
 * Read everything needed to decide what a user still owes, in one round trip.
 *
 * @param userId - Owner user id
 * @param policyVersion - Policy version to match exactly
 * @param pool - Optional injected pool (owns and closes its own pool otherwise)
 * @returns The three facts the consent gate and the catch-up flow both need
 *
 * @remarks
 * One query rather than three because this runs on every authenticated request:
 * the consent gate has to know whether the caller owes anything before it lets
 * a business endpoint run, and a compliance check that costs three round trips
 * per request is one that someone will eventually be tempted to remove.
 *
 * Consents are matched on the exact policy version. A consent to superseded
 * wording is evidence of what the user agreed to then, not permission under the
 * text being served now.
 *
 * `hasWithdrawableHealthConsent` is the one exception, and for the opposite
 * reason: a permission the user can no longer act under is still a permission
 * they are entitled to take back. It shares
 * {@link LIVE_HEALTH_CONSENT_PREDICATE} with the revocation itself, so "what
 * the UI offers to revoke" and "what the revocation revokes" cannot drift.
 *
 * `hasStoredInjuryData` is deliberately about what is in the table right now,
 * not about what a request claims. It is what makes "you owe a health consent"
 * a statement about this account rather than something a caller can assert.
 */
export async function getConsentStatus(
  userId: string,
  policyVersion: string,
  pool?: DbPoolLike,
): Promise<ConsentStatus> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT
          EXISTS (
            SELECT 1 FROM user_consents
            WHERE user_id = $1
              AND policy_version = $2
              AND consent_type = 'cross_border_transfer'
              AND revoked_at IS NULL
          ) AS "hasCrossBorderConsent",
          EXISTS (
            SELECT 1 FROM user_consents
            WHERE user_id = $1
              AND policy_version = $2
              AND consent_type = 'sensitive_health_data'
              AND revoked_at IS NULL
          ) AS "hasHealthConsent",
          EXISTS (
            SELECT 1 FROM user_consents
            WHERE user_id = $1
              AND ${LIVE_HEALTH_CONSENT_PREDICATE}
          ) AS "hasWithdrawableHealthConsent",
          EXISTS (
            SELECT 1 FROM athlete_profiles
            WHERE user_id = $1
              AND coalesce(array_length(injury_constraints, 1), 0) > 0
          ) AS "hasStoredInjuryData",
          (
            EXISTS (
              SELECT 1 FROM athlete_profiles
              WHERE user_id = $1
                AND coalesce(array_length(injury_constraints, 1), 0) > 0
            )
            OR EXISTS (
              SELECT 1 FROM menstrual_records
              WHERE user_id = $1
            )
            OR EXISTS (
              SELECT 1 FROM body_measurements
              WHERE user_id = $1
            )
          ) AS "hasStoredHealthData"
      `,
      [userId, policyVersion],
    );

    return result.rows[0] as ConsentStatus;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}
