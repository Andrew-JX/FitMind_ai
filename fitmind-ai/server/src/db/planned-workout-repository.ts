import { createRequire } from "node:module";

import { loadServerEnv } from "../env.js";

interface DbPoolLike {
  query: (
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: unknown[] }>;
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
 * Inserts an accepted plan and completes the user's previous active plan(s) in
 * one statement.
 *
 * @param input - Owner, date range, serialized plan snapshot, optional source message
 * @param pool - Optional injected pool (owns and closes its own pool otherwise)
 * @returns The newly persisted planned workout row
 *
 * @remarks
 * A data-modifying CTE rather than BEGIN/COMMIT: {@link DbPoolLike} exposes
 * only `query`, and a pool hands out a possibly different connection per call,
 * so multi-statement transactions cannot be expressed through this seam. One
 * statement is atomic regardless, which is what "supersede in the same
 * transaction" actually requires.
 *
 * The UPDATE sees the snapshot taken when the statement began, so it can only
 * reach plans that were already active — the row this statement inserts cannot
 * complete itself.
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

  try {
    const result = await activePool.query(
      `
        WITH superseded AS (
          UPDATE planned_workouts
          SET status = 'completed', updated_at = now()
          WHERE user_id = $1 AND status = 'active'
          RETURNING id
        )
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
