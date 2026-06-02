import { createDbPool } from "../pool.js";

/**
 * Search exercises by keyword and optional muscle code.
 *
 * @param {{ q?: string | undefined, muscleCode?: string | undefined }} filters
 *   Supported exercise filters.
 * @param {{ query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: unknown[] }> } | undefined} pool
 *   Optional shared database pool.
 * @returns {Promise<unknown[]>} Exercise rows with aggregated muscles.
 */
export async function searchExercises(filters = {}, pool) {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;
  const keyword = filters.q?.trim() ?? "";
  const keywordPattern = keyword === "" ? null : `%${keyword}%`;
  const muscleCode = filters.muscleCode?.trim() || null;

  try {
    const result = await activePool.query(
      `
        SELECT
          e.id,
          e.code,
          e.name_en AS "nameEn",
          e.name_zh AS "nameZh",
          e.movement_pattern AS "movementPattern",
          e.equipment,
          e.is_compound AS "isCompound",
          e.default_rest_seconds AS "defaultRestSeconds",
          COALESCE(
            json_agg(
              json_build_object(
                'code',
                mg.code,
                'contributionWeight',
                em.contribution_weight,
                'isPrimary',
                em.is_primary
              )
              ORDER BY em.is_primary DESC, em.contribution_weight DESC, mg.code ASC
            ) FILTER (WHERE mg.id IS NOT NULL),
            '[]'::json
          ) AS muscles
        FROM exercises e
        LEFT JOIN exercise_muscles em ON em.exercise_id = e.id
        LEFT JOIN muscle_groups mg ON mg.id = em.muscle_group_id
        WHERE
          ($1::text IS NULL OR e.code ILIKE $1 OR e.name_en ILIKE $1 OR e.name_zh ILIKE $1)
          AND (
            $2::text IS NULL
            OR EXISTS (
              SELECT 1
              FROM exercise_muscles em_filter
              JOIN muscle_groups mg_filter ON mg_filter.id = em_filter.muscle_group_id
              WHERE em_filter.exercise_id = e.id
                AND mg_filter.code = $2
            )
          )
        GROUP BY e.id
        ORDER BY COALESCE(NULLIF(e.name_zh, ''), e.name_en) ASC
      `,
      [keywordPattern, muscleCode],
    );

    return result.rows;
  } finally {
    if (ownsPool) {
      await activePool.end();
    }
  }
}
