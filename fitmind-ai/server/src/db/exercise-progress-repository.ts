import { createRequire } from "node:module";

import { loadServerEnv } from "../env.js";

interface DbPoolLike {
  query: (
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: unknown[] }>;
  end?: () => Promise<void>;
}

interface ExerciseProgressTotalsRow {
  exercise_name: string | null;
  workout_count: number;
  set_count: number;
  total_reps: number;
  total_volume: string | number;
  max_weight_kg: string | number | null;
  estimated_1rm_kg: string | number | null;
  workout_ids: string[];
  set_ids: string[];
}

interface ExerciseProgressSessionRow {
  workout_id: string;
  performed_at: string | Date;
  set_count: number;
  total_reps: number;
  total_volume: string | number;
  max_weight_kg: string | number | null;
  estimated_1rm_kg: string | number | null;
  set_ids: string[];
}

export interface ExerciseProgressRepositoryFilters {
  userId: string;
  exerciseId: string;
  startDate: string;
  endDate: string;
}

export interface ExerciseProgressRepositoryResult {
  totals: ExerciseProgressTotalsRow;
  sessions: ExerciseProgressSessionRow[];
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
 * Load deterministic exercise progress aggregates for one authenticated user.
 *
 * @param filters - Authenticated user, exercise, and inclusive date-only range.
 * @param pool - Optional shared database pool.
 * @returns Overall totals plus per-session rollups for the requested exercise.
 */
export async function getExerciseProgress(
  filters: ExerciseProgressRepositoryFilters,
  pool?: DbPoolLike,
): Promise<ExerciseProgressRepositoryResult> {
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
            AND w.performed_at >= $3::date
            AND w.performed_at < ($4::date + INTERVAL '1 day')
        ),
        included_sets AS (
          SELECT
            s.id,
            s.workout_id,
            COALESCE(s.reps, 0) AS reps,
            COALESCE(s.weight_kg, 0) AS weight_kg
          FROM sets s
          JOIN included_workouts w ON w.id = s.workout_id
          WHERE s.exercise_id = $2
        )
        SELECT
          COALESCE(NULLIF(e.name_zh, ''), e.name_en) AS exercise_name,
          (SELECT COUNT(DISTINCT workout_id)::int FROM included_sets) AS workout_count,
          (SELECT COUNT(*)::int FROM included_sets) AS set_count,
          (SELECT COALESCE(SUM(reps), 0)::int FROM included_sets) AS total_reps,
          (
            SELECT COALESCE(SUM(weight_kg * reps), 0)::numeric
            FROM included_sets
          ) AS total_volume,
          (
            SELECT MAX(weight_kg)::numeric
            FROM included_sets
          ) AS max_weight_kg,
          (
            SELECT MAX(weight_kg * (1 + (reps::numeric / 30)))::numeric
            FROM included_sets
          ) AS estimated_1rm_kg,
          (
            SELECT COALESCE(
              ARRAY_AGG(DISTINCT workout_id ORDER BY workout_id ASC),
              ARRAY[]::uuid[]
            )
            FROM included_sets
          ) AS workout_ids,
          (
            SELECT COALESCE(
              ARRAY_AGG(id ORDER BY workout_id ASC, id ASC),
              ARRAY[]::uuid[]
            )
            FROM included_sets
          ) AS set_ids
        FROM exercises e
        WHERE e.id = $2
      `,
      [
        filters.userId,
        filters.exerciseId,
        filters.startDate,
        filters.endDate,
      ],
    );

    const sessionsResult = await activePool.query(
      `
        SELECT
          w.id AS workout_id,
          w.performed_at,
          COUNT(*)::int AS set_count,
          COALESCE(SUM(COALESCE(s.reps, 0)), 0)::int AS total_reps,
          COALESCE(
            SUM(COALESCE(s.weight_kg, 0) * COALESCE(s.reps, 0)),
            0
          )::numeric AS total_volume,
          MAX(COALESCE(s.weight_kg, 0))::numeric AS max_weight_kg,
          MAX(
            COALESCE(s.weight_kg, 0) * (1 + (COALESCE(s.reps, 0)::numeric / 30))
          )::numeric AS estimated_1rm_kg,
          COALESCE(
            ARRAY_AGG(s.id ORDER BY s.set_index ASC, s.created_at ASC, s.id ASC),
            ARRAY[]::uuid[]
          ) AS set_ids
        FROM workouts w
        JOIN sets s ON s.workout_id = w.id
        WHERE w.user_id = $1
          AND s.exercise_id = $2
          AND w.performed_at >= $3::date
          AND w.performed_at < ($4::date + INTERVAL '1 day')
        GROUP BY w.id, w.performed_at
        ORDER BY w.performed_at ASC, w.id ASC
      `,
      [
        filters.userId,
        filters.exerciseId,
        filters.startDate,
        filters.endDate,
      ],
    );

    const totalsRow = totalsResult.rows[0] as ExerciseProgressTotalsRow | undefined;

    return {
      totals:
        totalsRow ?? {
          exercise_name: null,
          workout_count: 0,
          set_count: 0,
          total_reps: 0,
          total_volume: 0,
          max_weight_kg: null,
          estimated_1rm_kg: null,
          workout_ids: [],
          set_ids: [],
        },
      sessions: sessionsResult.rows as ExerciseProgressSessionRow[],
    };
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}
