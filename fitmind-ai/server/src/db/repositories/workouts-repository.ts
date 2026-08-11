import { Buffer } from "node:buffer";

import { createDbPool } from "../pool.js";

export interface WorkoutCursor {
  performed_at: string;
  id: string;
}

export interface DbQueryResult {
  rows: unknown[];
  rowCount?: number | null;
}

export interface DbClientLike {
  query: (sql: string, params?: readonly unknown[]) => Promise<DbQueryResult>;
  release: () => void;
}

export interface DbPoolLike {
  query: DbClientLike["query"];
  connect?: () => Promise<DbClientLike>;
  end?: () => Promise<void>;
}

export interface WorkoutSetRow {
  id: string;
  exercise_id: string;
  set_index: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
  is_warmup: boolean;
  notes: string | null;
  created_at: string;
}

export interface WorkoutSummaryRow {
  id: string;
  performed_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  sets_count: number;
  total_volume: number;
  muscle_groups: string[];
}

export interface WorkoutDetailRow {
  id: string;
  performed_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  sets: WorkoutSetRow[];
}

export interface ListWorkoutsFilters {
  userId: string;
  from?: string | undefined;
  to?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}

export interface SetInput {
  exercise_id: string;
  set_index: number;
  reps: number;
  weight_kg: number;
  rpe?: number | undefined;
  is_warmup: boolean;
  notes?: string | undefined;
}

export interface CreateWorkoutInput {
  performed_at: string;
  started_at?: string | null | undefined;
  ended_at?: string | null | undefined;
  duration_minutes?: number | undefined;
  notes?: string | undefined;
  sets: SetInput[];
}

export interface UpdateWorkoutInput {
  performed_at?: string | undefined;
  started_at?: string | null | undefined;
  ended_at?: string | null | undefined;
  duration_minutes?: number | undefined;
  notes?: string | undefined;
}

export interface UpdateSetInput {
  exercise_id?: string | undefined;
  set_index?: number | undefined;
  reps?: number | undefined;
  weight_kg?: number | undefined;
  rpe?: number | undefined;
  is_warmup?: boolean | undefined;
  notes?: string | undefined;
}

/**
 * Encode a composite workout cursor.
 *
 * @param {WorkoutCursor} cursor
 *   Cursor payload ordered by performed_at DESC, id DESC.
 * @returns {string} Base64-encoded cursor string.
 */
export function encodeWorkoutCursor(cursor: WorkoutCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64");
}

/**
 * Decode a composite workout cursor.
 *
 * @param {string} cursor
 *   Base64-encoded cursor string.
 * @returns {WorkoutCursor} Decoded cursor payload.
 */
export function decodeWorkoutCursor(cursor: string): WorkoutCursor {
  const rawValue = Buffer.from(cursor, "base64").toString("utf8");
  const parsedValue = JSON.parse(rawValue) as unknown;

  if (
    typeof parsedValue !== "object" ||
    parsedValue === null ||
    !("performed_at" in parsedValue) ||
    typeof parsedValue.performed_at !== "string" ||
    !("id" in parsedValue) ||
    typeof parsedValue.id !== "string"
  ) {
    throw new Error("Invalid workout cursor.");
  }

  return {
    performed_at: parsedValue.performed_at,
    id: parsedValue.id,
  };
}

/**
 * List workouts for a user using composite cursor pagination.
 *
 * @param {{
 *   userId: string;
 *   from?: string | undefined;
 *   to?: string | undefined;
 *   cursor?: string | undefined;
 *   limit?: number | undefined;
 * }} filters
 *   Supported list filters.
 * @param {DbPoolLike | undefined} pool
 *   Optional shared database pool.
 * @returns {Promise<{ items: WorkoutSummaryRow[]; nextCursor: string | null }>}
 *   Paginated workout summaries.
 */
export async function listWorkoutsByUser(
  filters: ListWorkoutsFilters,
  pool?: DbPoolLike,
): Promise<{ items: WorkoutSummaryRow[]; nextCursor: string | null }> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;
  const limit = filters.limit ?? 20;
  const decodedCursor =
    filters.cursor === undefined ? null : decodeWorkoutCursor(filters.cursor);

  try {
    const result = await activePool.query(
      `
        SELECT
          w.id,
          w.performed_at,
          w.started_at,
          w.ended_at,
          w.duration_minutes,
          w.notes,
          COUNT(DISTINCT s.id)::int AS sets_count,
          COALESCE(
            (
              SELECT SUM(workout_set.weight_kg * workout_set.reps)::float8
              FROM sets workout_set
              WHERE workout_set.workout_id = w.id
            ),
            0::float8
          ) AS total_volume,
          COALESCE(
            ARRAY_AGG(DISTINCT mg.code) FILTER (WHERE mg.code IS NOT NULL),
            ARRAY[]::text[]
          ) AS muscle_groups
        FROM workouts w
        LEFT JOIN sets s ON s.workout_id = w.id
        LEFT JOIN exercise_muscles em ON em.exercise_id = s.exercise_id
        LEFT JOIN muscle_groups mg ON mg.id = em.muscle_group_id
        WHERE w.user_id = $1
          AND ($2::timestamptz IS NULL OR w.performed_at >= $2::timestamptz)
          AND ($3::timestamptz IS NULL OR w.performed_at <= $3::timestamptz)
          AND (
            $4::timestamptz IS NULL
            OR w.performed_at < $4::timestamptz
            OR (w.performed_at = $4::timestamptz AND w.id < $5::uuid)
          )
        GROUP BY w.id
        ORDER BY w.performed_at DESC, w.id DESC
        LIMIT $6
      `,
      [
        filters.userId,
        filters.from ?? null,
        filters.to ?? null,
        decodedCursor?.performed_at ?? null,
        decodedCursor?.id ?? null,
        limit + 1,
      ],
    );

    const rows = result.rows as WorkoutSummaryRow[];
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = hasNextPage ? (items[items.length - 1] ?? null) : null;

    return {
      items,
      nextCursor:
        lastItem === null
          ? null
          : encodeWorkoutCursor({
              performed_at: lastItem.performed_at,
              id: lastItem.id,
            }),
    };
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Find a workout detail row for a user.
 *
 * @param {string} workoutId
 *   Workout id.
 * @param {string} userId
 *   Owner user id.
 * @param {DbPoolLike | undefined} pool
 *   Optional shared database pool.
 * @returns {Promise<WorkoutDetailRow | null>} Workout detail or null.
 */
export async function findWorkoutByIdForUser(
  workoutId: string,
  userId: string,
  pool?: DbPoolLike,
): Promise<WorkoutDetailRow | null> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    return await loadWorkoutDetail(activePool, workoutId, userId);
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Check whether a workout id exists regardless of ownership.
 *
 * @param {string} workoutId
 *   Workout id.
 * @param {DbPoolLike | undefined} pool
 *   Optional shared database pool.
 * @returns {Promise<boolean>} True when the workout exists.
 */
export async function hasWorkoutById(
  workoutId: string,
  pool?: DbPoolLike,
): Promise<boolean> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT 1
        FROM workouts
        WHERE id = $1
        LIMIT 1
      `,
      [workoutId],
    );

    return result.rows.length > 0;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Create a workout and all requested sets inside one transaction.
 *
 * @param {string} userId
 *   Owner user id.
 * @param {{
 *   performed_at: string;
 *   started_at?: string | null | undefined;
 *   ended_at?: string | null | undefined;
 *   duration_minutes?: number | undefined;
 *   notes?: string | undefined;
 *   sets: Array<{
 *     exercise_id: string;
 *     set_index: number;
 *     reps: number;
 *     weight_kg: number;
 *     rpe?: number | undefined;
 *     is_warmup: boolean;
 *     notes?: string | undefined;
 *   }>;
 * }} input
 *   Workout creation payload.
 * @param {DbPoolLike | undefined} pool
 *   Optional shared database pool.
 * @returns {Promise<WorkoutDetailRow>} Inserted workout detail.
 */
export async function createWorkoutWithSets(
  userId: string,
  input: CreateWorkoutInput,
  pool?: DbPoolLike,
): Promise<WorkoutDetailRow> {
  return withTransaction(pool, async (client) => {
    const workoutResult = await client.query(
      `
        INSERT INTO workouts (user_id, performed_at, started_at, ended_at, duration_minutes, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `,
      [
        userId,
        input.performed_at,
        input.started_at ?? null,
        input.ended_at ?? null,
        input.duration_minutes ?? null,
        input.notes ?? null,
      ],
    );

    const workoutId = (workoutResult.rows[0] as { id: string }).id;

    for (const set of input.sets) {
      await client.query(
        `
          INSERT INTO sets (
            workout_id,
            exercise_id,
            set_index,
            reps,
            weight_kg,
            rpe,
            is_warmup,
            notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          workoutId,
          set.exercise_id,
          set.set_index,
          set.reps,
          set.weight_kg,
          set.rpe ?? null,
          set.is_warmup,
          set.notes ?? null,
        ],
      );
    }

    const workout = await loadWorkoutDetail(client, workoutId, userId);

    if (workout === null) {
      throw new Error("Created workout could not be reloaded.");
    }

    return workout;
  });
}

/**
 * Update workout metadata for a user-owned workout.
 *
 * @param {string} workoutId
 *   Workout id.
 * @param {string} userId
 *   Owner user id.
 * @param {{
 *   performed_at?: string | undefined;
 *   started_at?: string | null | undefined;
 *   ended_at?: string | null | undefined;
 *   duration_minutes?: number | undefined;
 *   notes?: string | undefined;
 * }} input
 *   Workout patch payload.
 * @param {DbPoolLike | undefined} pool
 *   Optional shared database pool.
 * @returns {Promise<WorkoutDetailRow | null>} Updated workout detail or null.
 */
export async function updateWorkoutByIdForUser(
  workoutId: string,
  userId: string,
  input: UpdateWorkoutInput,
  pool?: DbPoolLike,
): Promise<WorkoutDetailRow | null> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.performed_at !== undefined) {
      fields.push(`performed_at = $${fields.length + 3}`);
      values.push(input.performed_at);
    }

    if (input.started_at !== undefined) {
      fields.push(`started_at = $${fields.length + 3}`);
      values.push(input.started_at);
    }

    if (input.ended_at !== undefined) {
      fields.push(`ended_at = $${fields.length + 3}`);
      values.push(input.ended_at);
    }

    if (input.duration_minutes !== undefined) {
      fields.push(`duration_minutes = $${fields.length + 3}`);
      values.push(input.duration_minutes);
    }

    if (input.notes !== undefined) {
      fields.push(`notes = $${fields.length + 3}`);
      values.push(input.notes);
    }

    if (fields.length === 0) {
      return await loadWorkoutDetail(activePool, workoutId, userId);
    }

    await activePool.query(
      `
        UPDATE workouts
        SET ${fields.join(", ")}
        WHERE id = $1 AND user_id = $2
      `,
      [workoutId, userId, ...values],
    );

    return await loadWorkoutDetail(activePool, workoutId, userId);
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Delete a user-owned workout.
 *
 * @param {string} workoutId
 *   Workout id.
 * @param {string} userId
 *   Owner user id.
 * @param {DbPoolLike | undefined} pool
 *   Optional shared database pool.
 * @returns {Promise<{ id: string } | null>} Deleted workout id or null.
 */
export async function deleteWorkoutByIdForUser(
  workoutId: string,
  userId: string,
  pool?: DbPoolLike,
): Promise<{ id: string } | null> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        DELETE FROM workouts
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `,
      [workoutId, userId],
    );

    return (result.rows[0] as { id: string } | undefined) ?? null;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Add a set to a user-owned workout.
 *
 * @param {string} workoutId
 *   Workout id.
 * @param {string} userId
 *   Owner user id.
 * @param {{
 *   exercise_id: string;
 *   set_index: number;
 *   reps: number;
 *   weight_kg: number;
 *   rpe?: number | undefined;
 *   is_warmup: boolean;
 *   notes?: string | undefined;
 * }} input
 *   Set creation payload.
 * @param {DbPoolLike | undefined} pool
 *   Optional shared database pool.
 * @returns {Promise<WorkoutSetRow | null>} Inserted set row or null.
 */
export async function addSetToWorkoutForUser(
  workoutId: string,
  userId: string,
  input: SetInput,
  pool?: DbPoolLike,
): Promise<WorkoutSetRow | null> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        INSERT INTO sets (
          workout_id,
          exercise_id,
          set_index,
          reps,
          weight_kg,
          rpe,
          is_warmup,
          notes
        )
        SELECT
          w.id,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9
        FROM workouts w
        WHERE w.id = $1 AND w.user_id = $2
        RETURNING
          id,
          exercise_id,
          set_index,
          reps,
          weight_kg,
          rpe,
          is_warmup,
          notes,
          created_at
      `,
      [
        workoutId,
        userId,
        input.exercise_id,
        input.set_index,
        input.reps,
        input.weight_kg,
        input.rpe ?? null,
        input.is_warmup,
        input.notes ?? null,
      ],
    );

    return (result.rows[0] as WorkoutSetRow | undefined) ?? null;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Update a set through set -> workout -> user ownership.
 *
 * @param {string} setId
 *   Set id.
 * @param {string} userId
 *   Owner user id.
 * @param {{
 *   exercise_id?: string | undefined;
 *   set_index?: number | undefined;
 *   reps?: number | undefined;
 *   weight_kg?: number | undefined;
 *   rpe?: number | undefined;
 *   is_warmup?: boolean | undefined;
 *   notes?: string | undefined;
 * }} input
 *   Set patch payload.
 * @param {DbPoolLike | undefined} pool
 *   Optional shared database pool.
 * @returns {Promise<WorkoutSetRow | null>} Updated set row or null.
 */
export async function updateSetByIdForUser(
  setId: string,
  userId: string,
  input: UpdateSetInput,
  pool?: DbPoolLike,
): Promise<WorkoutSetRow | null> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.exercise_id !== undefined) {
      fields.push(`exercise_id = $${fields.length + 3}`);
      values.push(input.exercise_id);
    }

    if (input.set_index !== undefined) {
      fields.push(`set_index = $${fields.length + 3}`);
      values.push(input.set_index);
    }

    if (input.reps !== undefined) {
      fields.push(`reps = $${fields.length + 3}`);
      values.push(input.reps);
    }

    if (input.weight_kg !== undefined) {
      fields.push(`weight_kg = $${fields.length + 3}`);
      values.push(input.weight_kg);
    }

    if (input.rpe !== undefined) {
      fields.push(`rpe = $${fields.length + 3}`);
      values.push(input.rpe);
    }

    if (input.is_warmup !== undefined) {
      fields.push(`is_warmup = $${fields.length + 3}`);
      values.push(input.is_warmup);
    }

    if (input.notes !== undefined) {
      fields.push(`notes = $${fields.length + 3}`);
      values.push(input.notes);
    }

    if (fields.length === 0) {
      return await findSetByIdForUser(setId, userId, activePool);
    }

    const result = await activePool.query(
      `
        UPDATE sets s
        SET ${fields.join(", ")}
        FROM workouts w
        WHERE s.workout_id = w.id
          AND s.id = $1
          AND w.user_id = $2
        RETURNING
          s.id,
          s.exercise_id,
          s.set_index,
          s.reps,
          s.weight_kg,
          s.rpe,
          s.is_warmup,
          s.notes,
          s.created_at
      `,
      [setId, userId, ...values],
    );

    return (result.rows[0] as WorkoutSetRow | undefined) ?? null;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Delete a set through set -> workout -> user ownership.
 *
 * @param {string} setId
 *   Set id.
 * @param {string} userId
 *   Owner user id.
 * @param {DbPoolLike | undefined} pool
 *   Optional shared database pool.
 * @returns {Promise<{ id: string; workout_id: string } | null>} Deleted set ids or null.
 */
export async function deleteSetByIdForUser(
  setId: string,
  userId: string,
  pool?: DbPoolLike,
): Promise<{ id: string; workout_id: string } | null> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        DELETE FROM sets s
        USING workouts w
        WHERE s.workout_id = w.id
          AND s.id = $1
          AND w.user_id = $2
        RETURNING s.id, s.workout_id
      `,
      [setId, userId],
    );

    return (
      (result.rows[0] as { id: string; workout_id: string } | undefined) ?? null
    );
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Check whether a set id exists regardless of ownership.
 *
 * @param {string} setId
 *   Set id.
 * @param {DbPoolLike | undefined} pool
 *   Optional shared database pool.
 * @returns {Promise<boolean>} True when the set exists.
 */
export async function hasSetById(
  setId: string,
  pool?: DbPoolLike,
): Promise<boolean> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT 1
        FROM sets
        WHERE id = $1
        LIMIT 1
      `,
      [setId],
    );

    return result.rows.length > 0;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Execute work inside a database transaction.
 *
 * @template T
 * @param {DbPoolLike | undefined} pool
 *   Optional shared database pool.
 * @param {(client: { query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: unknown[] }> }) => Promise<T>} callback
 *   Transaction callback.
 * @returns {Promise<T>} Callback result.
 */
async function withTransaction<T>(
  pool: DbPoolLike | undefined,
  callback: (client: DbClientLike) => Promise<T>,
): Promise<T> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  if (typeof activePool.connect !== "function") {
    throw new Error("A transactional pool must provide connect().");
  }

  const client = await activePool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
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

/**
 * Load one workout detail row with embedded sets.
 *
 * @param {{ query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: unknown[] }> }} queryable
 *   Queryable client or pool.
 * @param {string} workoutId
 *   Workout id.
 * @param {string} userId
 *   Owner user id.
 * @returns {Promise<WorkoutDetailRow | null>} Workout detail or null.
 */
async function loadWorkoutDetail(
  queryable: Pick<DbPoolLike, "query">,
  workoutId: string,
  userId: string,
): Promise<WorkoutDetailRow | null> {
  const result = await queryable.query(
    `
      SELECT
        w.id,
        w.performed_at,
        w.started_at,
        w.ended_at,
        w.duration_minutes,
        w.notes,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id',
                s.id,
                'exercise_id',
                s.exercise_id,
                'set_index',
                s.set_index,
                'reps',
                s.reps,
                'weight_kg',
                s.weight_kg,
                'rpe',
                s.rpe,
                'is_warmup',
                s.is_warmup,
                'notes',
                s.notes,
                'created_at',
                s.created_at
              )
              ORDER BY s.exercise_id ASC, s.set_index ASC, s.created_at ASC
            )
            FROM sets s
            WHERE s.workout_id = w.id
          ),
          '[]'::json
        ) AS sets
      FROM workouts w
      WHERE w.id = $1 AND w.user_id = $2
      LIMIT 1
    `,
    [workoutId, userId],
  );

  return (result.rows[0] as WorkoutDetailRow | undefined) ?? null;
}

/**
 * Find one set row through set -> workout -> user ownership.
 *
 * @param {string} setId
 *   Set id.
 * @param {string} userId
 *   Owner user id.
 * @param {{ query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: unknown[] }> }} queryable
 *   Queryable client or pool.
 * @returns {Promise<WorkoutSetRow | null>} Set row or null.
 */
async function findSetByIdForUser(
  setId: string,
  userId: string,
  queryable: Pick<DbPoolLike, "query">,
): Promise<WorkoutSetRow | null> {
  const result = await queryable.query(
    `
      SELECT
        s.id,
        s.exercise_id,
        s.set_index,
        s.reps,
        s.weight_kg,
        s.rpe,
        s.is_warmup,
        s.notes,
        s.created_at
      FROM sets s
      JOIN workouts w ON w.id = s.workout_id
      WHERE s.id = $1 AND w.user_id = $2
      LIMIT 1
    `,
    [setId, userId],
  );

  return (result.rows[0] as WorkoutSetRow | undefined) ?? null;
}
