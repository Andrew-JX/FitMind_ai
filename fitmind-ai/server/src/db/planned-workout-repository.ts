import { createRequire } from "node:module";

import { loadServerEnv } from "../env.js";

interface DbQueryable {
  query: (
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: unknown[] }>;
}

interface DbClientLike extends DbQueryable {
  release: () => void;
}

interface DbPoolLike extends DbQueryable {
  /** Present on real pools; required only by the transactional write below. */
  connect?: () => Promise<DbClientLike>;
  end?: () => Promise<void>;
}

export type PlannedWorkoutStatus = "active" | "completed" | "abandoned";

export interface PlannedWorkoutRow {
  id: string;
  user_id: string;
  status: PlannedWorkoutStatus;
  start_date: string;
  end_date: string;
  plan: unknown;
  source_message_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePlannedWorkoutInput {
  userId: string;
  startDate: string;
  endDate: string;
  /** Serialized NextWeekPlanDraft snapshot (already JSON.stringify-ed). */
  planJson: string;
  sourceMessageId?: string | null | undefined;
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

const RETURNED_COLUMNS = `
  id,
  user_id,
  status,
  start_date::text AS start_date,
  end_date::text AS end_date,
  plan,
  source_message_id,
  created_at,
  updated_at
`;

/**
 * Inserts an accepted plan as a new active planned workout.
 *
 * @param input - Owner, date range, serialized plan snapshot, optional source message
 * @param pool - Optional injected pool (owns and closes its own pool otherwise)
 * @returns The persisted planned workout row
 */
export async function createPlannedWorkout(
  input: CreatePlannedWorkoutInput,
  pool?: DbPoolLike,
): Promise<PlannedWorkoutRow> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        INSERT INTO planned_workouts (
          user_id,
          start_date,
          end_date,
          plan,
          source_message_id
        )
        VALUES ($1, $2, $3, $4::jsonb, $5)
        RETURNING ${RETURNED_COLUMNS}
      `,
      [
        input.userId,
        input.startDate,
        input.endDate,
        input.planJson,
        input.sourceMessageId ?? null,
      ],
    );

    return result.rows[0] as PlannedWorkoutRow;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Inserts an accepted plan and completes the user's previous active plan(s),
 * serialized against concurrent accepts by the same user.
 *
 * @param input - Owner, date range, serialized plan snapshot, optional source message
 * @param pool - Optional injected pool (owns and closes its own pool otherwise)
 * @returns The newly persisted planned workout row
 *
 * @remarks
 * The first version of this used a single data-modifying CTE, reasoning that
 * one statement is atomic. Atomic is not the property needed here. Two
 * concurrent accepts each read a snapshot without the other's insert, each
 * complete only the plans they can see, and each insert — leaving two active
 * rows. With no prior active plan it is even plainer: both UPDATEs match zero
 * rows and both INSERTs succeed.
 *
 * Serializing requires a lock the second caller has to wait on, so the write
 * takes the user row with `FOR UPDATE` first. The second accept then blocks
 * until the first commits, and its UPDATE runs on a snapshot that already
 * contains the first plan, so it supersedes that one rather than missing it.
 *
 * The lock row must exist: without it there is nothing to serialize on, and the
 * write would silently fall back to the racy behaviour above.
 *
 * Superseded plans become `completed`, not `abandoned`: the row stays as
 * history, and D42's planner context deliberately accepts completed plans while
 * excluding abandoned ones.
 */
export async function createPlannedWorkoutSupersedingActive(
  input: CreatePlannedWorkoutInput,
  pool?: DbPoolLike,
): Promise<PlannedWorkoutRow> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  if (typeof activePool.connect !== "function") {
    throw new Error(
      "Accepting a plan requires a transactional pool that provides connect().",
    );
  }

  const client = await activePool.connect();

  try {
    await client.query("BEGIN");

    const lock = await client.query(
      "SELECT id FROM users WHERE id = $1 FOR UPDATE",
      [input.userId],
    );

    if (lock.rows.length === 0) {
      throw new Error(
        "Cannot accept a plan for a user that does not exist: nothing to lock.",
      );
    }

    await client.query(
      `
        UPDATE planned_workouts
        SET status = 'completed', updated_at = now()
        WHERE user_id = $1 AND status = 'active'
      `,
      [input.userId],
    );

    const result = await client.query(
      `
        INSERT INTO planned_workouts (
          user_id,
          start_date,
          end_date,
          plan,
          source_message_id
        )
        VALUES ($1, $2, $3, $4::jsonb, $5)
        RETURNING ${RETURNED_COLUMNS}
      `,
      [
        input.userId,
        input.startDate,
        input.endDate,
        input.planJson,
        input.sourceMessageId ?? null,
      ],
    );

    await client.query("COMMIT");

    return result.rows[0] as PlannedWorkoutRow;
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
 * Reads the most recent active planned workout for a user, or null when none.
 *
 * @param userId - Owner user id
 * @param pool - Optional injected pool (owns and closes its own pool otherwise)
 * @returns The active planned workout row, or null
 */
export async function getActivePlannedWorkoutForUser(
  userId: string,
  pool?: DbPoolLike,
): Promise<PlannedWorkoutRow | null> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT ${RETURNED_COLUMNS}
        FROM planned_workouts
        WHERE user_id = $1 AND status = 'active'
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [userId],
    );

    return (result.rows[0] as PlannedWorkoutRow | undefined) ?? null;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Reads the most recent non-abandoned planned workout that overlaps a planner
 * evidence window, or null when none exists.
 *
 * @param input - Owner user id plus the evidence date range to overlap.
 * @param pool - Optional injected pool (owns and closes its own pool otherwise)
 * @returns The latest active/completed overlapping planned workout row, or null
 */
export async function getLatestAcceptedPlannedWorkoutForUser(
  input: { userId: string; startDate: string; endDate: string },
  pool?: DbPoolLike,
): Promise<PlannedWorkoutRow | null> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT ${RETURNED_COLUMNS}
        FROM planned_workouts
        WHERE user_id = $1
          AND status IN ('active', 'completed')
          AND start_date <= $3::date
          AND end_date >= $2::date
        ORDER BY end_date DESC, created_at DESC, id DESC
        LIMIT 1
      `,
      [input.userId, input.startDate, input.endDate],
    );

    return (result.rows[0] as PlannedWorkoutRow | undefined) ?? null;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Updates the status of a user's planned workout (e.g. complete / abandon).
 *
 * @param input - Plan id, owner user id, and the new status
 * @param pool - Optional injected pool (owns and closes its own pool otherwise)
 * @returns The updated row, or null when no matching plan was found
 */
export async function updatePlannedWorkoutStatus(
  input: { id: string; userId: string; status: PlannedWorkoutStatus },
  pool?: DbPoolLike,
): Promise<PlannedWorkoutRow | null> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        UPDATE planned_workouts
        SET status = $3, updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING ${RETURNED_COLUMNS}
      `,
      [input.id, input.userId, input.status],
    );

    return (result.rows[0] as PlannedWorkoutRow | undefined) ?? null;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}
