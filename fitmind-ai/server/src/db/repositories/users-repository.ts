import { createDbPool, type DbPool } from "../pool.js";

type DbPoolLike = Pick<DbPool, "query"> & Partial<Pick<DbPool, "end">>;

export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName?: string | null | undefined;
}

/**
 * Find a user row by normalized email address.
 *
 * @param {string} email
 *   Normalized email address.
 * @param {{ query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: unknown[] }> } | undefined} pool
 *   Optional shared database pool.
 * @returns {Promise<unknown | null>} Matching user row or null.
 */
export async function findUserByEmail(
  email: string,
  pool?: DbPoolLike,
): Promise<UserRow | null> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT
          id,
          email,
          password_hash AS "passwordHash",
          display_name AS "displayName",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      [email],
    );

    return (result.rows[0] as UserRow | undefined) ?? null;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Find a user row by id.
 *
 * @param {string} userId
 *   User id.
 * @param {{ query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: unknown[] }> } | undefined} pool
 *   Optional shared database pool.
 * @returns {Promise<unknown | null>} Matching user row or null.
 */
export async function findUserById(
  userId: string,
  pool?: DbPoolLike,
): Promise<UserRow | null> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT
          id,
          email,
          password_hash AS "passwordHash",
          display_name AS "displayName",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
    );

    return (result.rows[0] as UserRow | undefined) ?? null;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Create a user row and return the inserted record.
 *
 * @param {{ email: string, passwordHash: string, displayName?: string | null | undefined }} input
 *   User creation payload.
 * @param {{ query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: unknown[] }> } | undefined} pool
 *   Optional shared database pool.
 * @returns {Promise<unknown>} Inserted user row.
 */
export async function createUser(
  input: CreateUserInput,
  pool?: DbPoolLike,
): Promise<UserRow> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
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

    return result.rows[0] as UserRow;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Delete a user row, cascading to everything that references it.
 *
 * @param {string} userId
 *   User id.
 * @param {{ query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: unknown[], rowCount?: number | null }> } | undefined} pool
 *   Optional shared database pool.
 * @returns {Promise<boolean>} True when a row was deleted, false when the id was already gone.
 *
 * @remarks
 * Every table that references `users` is `ON DELETE CASCADE`, so this single
 * statement removes the workouts, chat, profile, feedback and consent rows too.
 * That includes `user_consents`: once the person and their data are gone there
 * is nothing left for a consent record to be evidence about.
 *
 * Returns a boolean rather than throwing on a missing row so a double-submit
 * from the client is idempotent instead of a 500.
 */
export async function deleteUserById(
  userId: string,
  pool?: DbPoolLike,
): Promise<boolean> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(`DELETE FROM users WHERE id = $1`, [
      userId,
    ]);

    return (result.rowCount ?? 0) > 0;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}
