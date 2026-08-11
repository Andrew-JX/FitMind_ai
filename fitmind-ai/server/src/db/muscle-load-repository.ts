import { createDbPool } from "./pool.js";

interface DbPoolLike {
  query: (
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: unknown[] }>;
  end?: () => Promise<void>;
}

interface MuscleLoadTotalsRow {
  workout_count: number;
  set_count: number;
  total_reps: number;
  total_raw_volume: string | number;
  total_weighted_volume: string | number;
  muscle_group_count: number;
  workout_ids: string[];
  set_ids: string[];
}

interface MuscleLoadGroupRow {
  muscle_group_id: string;
  muscle_group_name: string;
  set_count: number;
  total_reps: number;
  raw_volume: string | number;
  weighted_volume: string | number;
}

interface MuscleLoadExerciseRow {
  muscle_group_id: string;
  exercise_id: string;
  exercise_name: string;
  weighted_volume: string | number;
  set_count: number;
}

export interface MuscleLoadRepositoryResult {
  totals: MuscleLoadTotalsRow;
  byMuscleGroup: MuscleLoadGroupRow[];
  topExercises: MuscleLoadExerciseRow[];
}

export interface MuscleLoadFilters {
  userId: string;
  startDate: string;
  endDate: string;
}

/**
 * Load deterministic muscle-load aggregates for one authenticated user.
 *
 * @param filters - User id and inclusive date-only range.
 * @param pool - Optional shared database pool.
 * @returns Muscle-load totals, grouped muscle rows, and top exercise rows.
 */
export async function getMuscleLoad(
  filters: MuscleLoadFilters,
  pool?: DbPoolLike,
): Promise<MuscleLoadRepositoryResult> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;
  const params = [filters.userId, filters.startDate, filters.endDate] as const;

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
            s.id,
            s.workout_id,
            s.exercise_id,
            COALESCE(s.reps, 0) AS reps,
            COALESCE(s.weight_kg, 0) AS weight_kg,
            COALESCE(s.weight_kg, 0) * COALESCE(s.reps, 0) AS raw_volume
          FROM sets s
          JOIN included_workouts w ON w.id = s.workout_id
        ),
        exercise_weight_totals AS (
          SELECT
            em.exercise_id,
            SUM(em.contribution_weight)::numeric AS total_weight
          FROM exercise_muscles em
          GROUP BY em.exercise_id
        ),
        weighted_set_muscles AS (
          SELECT
            included_sets.id AS set_id,
            included_sets.workout_id,
            included_sets.exercise_id,
            included_sets.raw_volume,
            included_sets.raw_volume
              * (
                em.contribution_weight::numeric
                / NULLIF(exercise_weight_totals.total_weight, 0)
              ) AS weighted_volume,
            em.muscle_group_id
          FROM included_sets
          JOIN exercise_muscles em ON em.exercise_id = included_sets.exercise_id
          JOIN exercise_weight_totals
            ON exercise_weight_totals.exercise_id = included_sets.exercise_id
          WHERE exercise_weight_totals.total_weight > 0
        )
        SELECT
          (SELECT COUNT(*)::int FROM included_workouts) AS workout_count,
          (SELECT COUNT(*)::int FROM included_sets) AS set_count,
          (SELECT COALESCE(SUM(reps), 0)::int FROM included_sets) AS total_reps,
          (
            SELECT COALESCE(SUM(raw_volume), 0)::numeric
            FROM included_sets
          ) AS total_raw_volume,
          (
            SELECT COALESCE(SUM(weighted_volume), 0)::numeric
            FROM weighted_set_muscles
          ) AS total_weighted_volume,
          (
            SELECT COUNT(DISTINCT muscle_group_id)::int
            FROM weighted_set_muscles
          ) AS muscle_group_count,
          (
            SELECT COALESCE(
              ARRAY_AGG(id ORDER BY performed_at ASC, id ASC),
              ARRAY[]::uuid[]
            )
            FROM included_workouts
          ) AS workout_ids,
          (
            SELECT COALESCE(
              ARRAY_AGG(id ORDER BY workout_id ASC, id ASC),
              ARRAY[]::uuid[]
            )
            FROM included_sets
          ) AS set_ids
      `,
      params,
    );

    const byMuscleGroupResult = await activePool.query(
      `
        WITH included_workouts AS (
          SELECT w.id
          FROM workouts w
          WHERE w.user_id = $1
            AND w.performed_at >= $2::date
            AND w.performed_at < ($3::date + INTERVAL '1 day')
        ),
        included_sets AS (
          SELECT
            s.id,
            s.workout_id,
            s.exercise_id,
            COALESCE(s.reps, 0) AS reps,
            COALESCE(s.weight_kg, 0) * COALESCE(s.reps, 0) AS raw_volume
          FROM sets s
          JOIN included_workouts w ON w.id = s.workout_id
        ),
        exercise_weight_totals AS (
          SELECT
            em.exercise_id,
            SUM(em.contribution_weight)::numeric AS total_weight
          FROM exercise_muscles em
          GROUP BY em.exercise_id
        ),
        weighted_set_muscles AS (
          SELECT
            included_sets.id AS set_id,
            included_sets.reps,
            included_sets.raw_volume,
            included_sets.raw_volume
              * (
                em.contribution_weight::numeric
                / NULLIF(exercise_weight_totals.total_weight, 0)
              ) AS weighted_volume,
            mg.id AS muscle_group_id,
            COALESCE(NULLIF(mg.name_zh, ''), mg.name_en) AS muscle_group_name
          FROM included_sets
          JOIN exercise_muscles em ON em.exercise_id = included_sets.exercise_id
          JOIN muscle_groups mg ON mg.id = em.muscle_group_id
          JOIN exercise_weight_totals
            ON exercise_weight_totals.exercise_id = included_sets.exercise_id
          WHERE exercise_weight_totals.total_weight > 0
        )
        SELECT
          muscle_group_id,
          muscle_group_name,
          COUNT(DISTINCT set_id)::int AS set_count,
          COALESCE(SUM(reps), 0)::int AS total_reps,
          COALESCE(SUM(raw_volume), 0)::numeric AS raw_volume,
          COALESCE(SUM(weighted_volume), 0)::numeric AS weighted_volume
        FROM weighted_set_muscles
        GROUP BY muscle_group_id, muscle_group_name
        ORDER BY weighted_volume DESC, set_count DESC, muscle_group_name ASC
      `,
      params,
    );

    const topExercisesResult = await activePool.query(
      `
        WITH included_workouts AS (
          SELECT w.id
          FROM workouts w
          WHERE w.user_id = $1
            AND w.performed_at >= $2::date
            AND w.performed_at < ($3::date + INTERVAL '1 day')
        ),
        included_sets AS (
          SELECT
            s.id,
            s.workout_id,
            s.exercise_id,
            COALESCE(s.weight_kg, 0) * COALESCE(s.reps, 0) AS raw_volume
          FROM sets s
          JOIN included_workouts w ON w.id = s.workout_id
        ),
        exercise_weight_totals AS (
          SELECT
            em.exercise_id,
            SUM(em.contribution_weight)::numeric AS total_weight
          FROM exercise_muscles em
          GROUP BY em.exercise_id
        ),
        grouped_exercises AS (
          SELECT
            mg.id AS muscle_group_id,
            e.id AS exercise_id,
            COALESCE(NULLIF(e.name_zh, ''), e.name_en) AS exercise_name,
            COALESCE(
              SUM(
                included_sets.raw_volume
                  * (
                    em.contribution_weight::numeric
                    / NULLIF(exercise_weight_totals.total_weight, 0)
                  )
              ),
              0
            )::numeric AS weighted_volume,
            COUNT(DISTINCT included_sets.id)::int AS set_count
          FROM included_sets
          JOIN exercises e ON e.id = included_sets.exercise_id
          JOIN exercise_muscles em ON em.exercise_id = included_sets.exercise_id
          JOIN muscle_groups mg ON mg.id = em.muscle_group_id
          JOIN exercise_weight_totals
            ON exercise_weight_totals.exercise_id = included_sets.exercise_id
          WHERE exercise_weight_totals.total_weight > 0
          GROUP BY mg.id, e.id, e.name_en, e.name_zh
        ),
        ranked_exercises AS (
          SELECT
            grouped_exercises.*,
            ROW_NUMBER() OVER (
              PARTITION BY muscle_group_id
              ORDER BY weighted_volume DESC, set_count DESC, exercise_name ASC
            ) AS rank
          FROM grouped_exercises
        )
        SELECT
          muscle_group_id,
          exercise_id,
          exercise_name,
          weighted_volume,
          set_count
        FROM ranked_exercises
        WHERE rank <= 3
        ORDER BY muscle_group_id ASC, weighted_volume DESC, exercise_name ASC
      `,
      params,
    );

    const totalsRow = totalsResult.rows[0] as MuscleLoadTotalsRow | undefined;

    return {
      totals: totalsRow ?? {
        workout_count: 0,
        set_count: 0,
        total_reps: 0,
        total_raw_volume: 0,
        total_weighted_volume: 0,
        muscle_group_count: 0,
        workout_ids: [],
        set_ids: [],
      },
      byMuscleGroup: byMuscleGroupResult.rows as MuscleLoadGroupRow[],
      topExercises: topExercisesResult.rows as MuscleLoadExerciseRow[],
    };
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}
