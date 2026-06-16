import { createRequire } from "node:module";

import { loadServerEnv } from "../env.js";

interface DbPoolLike {
  query: (
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: unknown[] }>;
  end?: () => Promise<void>;
}

interface TrainingSummaryTotalsRow {
  workout_count: number;
  set_count: number;
  total_reps: number;
  total_volume: string | number;
  workout_ids: string[];
}

interface TrainingSummaryExerciseRow {
  exercise_id: string;
  exercise_name: string;
  set_count: number;
  total_reps: number;
  total_volume: string | number;
  max_weight_kg: string | number | null;
  estimated_1rm_kg: string | number | null;
}

export interface TrainingSummaryRepositoryResult {
  totals: TrainingSummaryTotalsRow;
  byExercise: TrainingSummaryExerciseRow[];
}

export interface TrainingSummaryFilters {
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
 * Load deterministic training summary aggregates for one authenticated user.
 *
 * @param filters - User id and inclusive date-only range.
 * @param pool - Optional shared database pool.
 * @returns Aggregated totals, grouped exercise rows, and included workout ids.
 */
export async function getTrainingSummary(
  filters: TrainingSummaryFilters,
  pool?: DbPoolLike,
): Promise<TrainingSummaryRepositoryResult> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  try {
    const totalsResult = await activePool.query(
      `
        WITH included_workouts AS (
          SELECT
            w.id,
            w.performed_at
          FROM workouts w
          WHERE w.user_id = $1
            AND w.performed_at >= $2::date
            AND w.performed_at < ($3::date + INTERVAL '1 day')
        ),
        included_sets AS (
          SELECT
            s.workout_id,
            s.exercise_id,
            COALESCE(s.reps, 0) AS reps,
            COALESCE(s.weight_kg, 0) AS weight_kg
          FROM sets s
          JOIN included_workouts w ON w.id = s.workout_id
        )
        SELECT
          (SELECT COUNT(*)::int FROM included_workouts) AS workout_count,
          (SELECT COUNT(*)::int FROM included_sets) AS set_count,
          (SELECT COALESCE(SUM(reps), 0)::int FROM included_sets) AS total_reps,
          (
            SELECT COALESCE(SUM(weight_kg * reps), 0)::numeric
            FROM included_sets
          ) AS total_volume,
          (
            SELECT COALESCE(
              ARRAY_AGG(id ORDER BY performed_at ASC, id ASC),
              ARRAY[]::uuid[]
            )
            FROM included_workouts
          ) AS workout_ids
      `,
      [filters.userId, filters.startDate, filters.endDate],
    );

    const byExerciseResult = await activePool.query(
      `
        SELECT
          s.exercise_id,
          COALESCE(NULLIF(e.name_zh, ''), e.name_en) AS exercise_name,
          COUNT(*)::int AS set_count,
          COALESCE(SUM(COALESCE(s.reps, 0)), 0)::int AS total_reps,
          COALESCE(
            SUM(COALESCE(s.weight_kg, 0) * COALESCE(s.reps, 0)),
            0
          )::numeric AS total_volume,
          MAX(COALESCE(s.weight_kg, 0))::numeric AS max_weight_kg,
          MAX(
            COALESCE(s.weight_kg, 0) * (1 + (COALESCE(s.reps, 0)::numeric / 30))
          )::numeric AS estimated_1rm_kg
        FROM workouts w
        JOIN sets s ON s.workout_id = w.id
        JOIN exercises e ON e.id = s.exercise_id
        WHERE w.user_id = $1
          AND w.performed_at >= $2::date
          AND w.performed_at < ($3::date + INTERVAL '1 day')
        GROUP BY s.exercise_id, e.name_en, e.name_zh
        ORDER BY total_volume DESC, set_count DESC, exercise_name ASC
      `,
      [filters.userId, filters.startDate, filters.endDate],
    );

    const totalsRow = totalsResult.rows[0] as TrainingSummaryTotalsRow | undefined;

    return {
      totals:
        totalsRow ?? {
          workout_count: 0,
          set_count: 0,
          total_reps: 0,
          total_volume: 0,
          workout_ids: [],
        },
      byExercise: byExerciseResult.rows as TrainingSummaryExerciseRow[],
    };
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}
