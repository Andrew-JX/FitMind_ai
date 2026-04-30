import { createRequire } from "node:module";

import { loadServerEnv } from "../env.js";

interface DbPoolLike {
  query: (
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: unknown[] }>;
  end?: () => Promise<void>;
}

interface RecentWorkoutRow {
  workout_id: string;
  performed_at: string | Date;
  notes: string | null;
  set_count: number;
  total_volume: string | number;
}

export interface RecommendationContextRecentWorkoutFilters {
  userId: string;
  startDate: string;
  endDate: string;
}

const require = createRequire(import.meta.url);

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
 * Load the latest workouts in range for the authenticated user.
 *
 * @param filters - Authenticated user and inclusive date-only range.
 * @param pool - Optional shared database pool.
 * @returns Latest five workouts with lightweight deterministic totals.
 */
export async function getRecentWorkoutsForRecommendationContext(
  filters: RecommendationContextRecentWorkoutFilters,
  pool?: DbPoolLike,
): Promise<RecentWorkoutRow[]> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT
          w.id AS workout_id,
          w.performed_at,
          w.notes,
          COUNT(s.id)::int AS set_count,
          COALESCE(
            SUM(COALESCE(s.weight_kg, 0) * COALESCE(s.reps, 0)),
            0
          )::numeric AS total_volume
        FROM workouts w
        LEFT JOIN sets s ON s.workout_id = w.id
        WHERE w.user_id = $1
          AND w.performed_at >= $2::date
          AND w.performed_at < ($3::date + INTERVAL '1 day')
        GROUP BY w.id, w.performed_at, w.notes
        ORDER BY w.performed_at DESC, w.id DESC
        LIMIT 5
      `,
      [filters.userId, filters.startDate, filters.endDate],
    );

    return result.rows as RecentWorkoutRow[];
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}
