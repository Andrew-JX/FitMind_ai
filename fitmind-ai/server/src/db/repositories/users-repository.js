import { createDbPool } from "../pool.js";

/**
 * Find a user row by normalized email address.
 *
 * @param {string} email
 *   Normalized email address.
 * @param {{ query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: unknown[] }> } | undefined} pool
 *   Optional shared database pool.
 * @returns {Promise<unknown | null>} Matching user row or null.
 */
export async function findUserByEmail(email, pool) {
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

    return result.rows[0] ?? null;
  } finally {
    if (ownsPool) {
      await activePool.end();
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
export async function findUserById(userId, pool) {
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

    return result.rows[0] ?? null;
  } finally {
    if (ownsPool) {
      await activePool.end();
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
export async function createUser(input, pool) {
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

    return result.rows[0];
  } finally {
    if (ownsPool) {
      await activePool.end();
    }
  }
}
