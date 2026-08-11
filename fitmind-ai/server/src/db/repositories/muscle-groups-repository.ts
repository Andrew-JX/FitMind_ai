import { createDbPool, type DbPool } from "../pool.js";

type DbPoolLike = Pick<DbPool, "query"> & Partial<Pick<DbPool, "end">>;

export interface MuscleGroupRow {
  id: string;
  code: string;
  nameEn: string;
  nameZh: string;
  parentId: string | null;
  recoveryHours: number;
  createdAt: unknown;
}

/**
 * List all muscle groups ordered by hierarchy and code.
 *
 * @param {{ query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: unknown[] }> } | undefined} pool
 *   Optional shared database pool.
 * @returns {Promise<unknown[]>} Muscle group rows.
 */
export async function listMuscleGroups(
  pool?: DbPoolLike,
): Promise<MuscleGroupRow[]> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT
          id,
          code,
          name_en AS "nameEn",
          name_zh AS "nameZh",
          parent_id AS "parentId",
          recovery_hours AS "recoveryHours",
          created_at AS "createdAt"
        FROM muscle_groups
        ORDER BY
          parent_id NULLS FIRST,
          code ASC
      `,
    );

    return result.rows as MuscleGroupRow[];
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}
