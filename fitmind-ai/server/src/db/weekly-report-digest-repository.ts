import { z } from "zod";

import { createDbPool } from "./pool.js";

interface DbPoolLike {
  query: (
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: unknown[]; rowCount?: number | null }>;
  end?: () => Promise<void>;
}

export interface WeeklyReportDigestRow {
  id: string;
  user_id: string;
  iso_year: number;
  iso_week: number;
  week_start_date: string;
  week_end_date: string;
  status: "ready" | "empty";
  title: string;
  summary: string;
  report_snapshot: unknown;
  generated_at: string;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertWeeklyReportDigestInput {
  userId: string;
  isoYear: number;
  isoWeek: number;
  weekStartDate: string;
  weekEndDate: string;
  status: WeeklyReportDigestRow["status"];
  title: string;
  summary: string;
  reportSnapshot: unknown;
  generatedAt: string;
}

export interface UpsertWeeklyReportDigestResult {
  inserted: boolean;
  row: WeeklyReportDigestRow;
}

const weeklyReportDigestRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  iso_year: z.number().int(),
  iso_week: z.number().int().min(1).max(53),
  week_start_date: z.string(),
  week_end_date: z.string(),
  status: z.enum(["ready", "empty"]),
  title: z.string(),
  summary: z.string(),
  report_snapshot: z.unknown(),
  generated_at: z.string(),
  dismissed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const upsertResultSchema = z.object({
  inserted: z.boolean(),
  row: weeklyReportDigestRowSchema,
});

const activeUserRowSchema = z.object({
  id: z.string().uuid(),
});

const RETURNED_COLUMNS = `
  id,
  user_id,
  iso_year,
  iso_week,
  week_start_date::text AS week_start_date,
  week_end_date::text AS week_end_date,
  status,
  title,
  summary,
  report_snapshot,
  generated_at::text AS generated_at,
  dismissed_at::text AS dismissed_at,
  created_at::text AS created_at,
  updated_at::text AS updated_at
`;

/**
 * Lists users with at least one workout on or after the active-since date.
 *
 * @param activeSinceDate - Inclusive UTC date-only lower bound.
 * @param pool - Optional injected database pool.
 * @returns User ids ordered stably for deterministic batch behavior.
 */
export async function listUsersWithRecentWorkouts(
  activeSinceDate: string,
  pool?: DbPoolLike,
): Promise<string[]> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT u.id
        FROM users u
        WHERE EXISTS (
          SELECT 1
          FROM workouts w
          WHERE w.user_id = u.id
            AND w.performed_at >= $1::date
        )
        ORDER BY u.id ASC
      `,
      [activeSinceDate],
    );

    return result.rows.map((row) => activeUserRowSchema.parse(row).id);
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Inserts or refreshes one weekly digest, keyed by user and ISO week.
 *
 * @param input - Digest payload and idempotency key fields.
 * @param pool - Optional injected database pool.
 * @returns Persisted row plus whether this call inserted a new digest.
 */
export async function upsertWeeklyReportDigest(
  input: UpsertWeeklyReportDigestInput,
  pool?: DbPoolLike,
): Promise<UpsertWeeklyReportDigestResult> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        WITH upserted AS (
          INSERT INTO weekly_report_digests (
            user_id,
            iso_year,
            iso_week,
            week_start_date,
            week_end_date,
            status,
            title,
            summary,
            report_snapshot,
            generated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
          ON CONFLICT (user_id, iso_year, iso_week) DO UPDATE
          SET
            week_start_date = EXCLUDED.week_start_date,
            week_end_date = EXCLUDED.week_end_date,
            status = EXCLUDED.status,
            title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            report_snapshot = EXCLUDED.report_snapshot,
            generated_at = EXCLUDED.generated_at,
            updated_at = now()
          RETURNING
            ${RETURNED_COLUMNS},
            (xmax = 0) AS inserted
        )
        SELECT
          inserted,
          to_jsonb(upserted) - 'inserted' AS row
        FROM upserted
      `,
      [
        input.userId,
        input.isoYear,
        input.isoWeek,
        input.weekStartDate,
        input.weekEndDate,
        input.status,
        input.title,
        input.summary,
        JSON.stringify(input.reportSnapshot),
        input.generatedAt,
      ],
    );

    return upsertResultSchema.parse(result.rows[0]);
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Reads the latest undismissed weekly digest for one user.
 *
 * @param userId - Owner user id.
 * @param pool - Optional injected database pool.
 * @returns Latest visible digest, or null.
 */
export async function findLatestUndismissedWeeklyReportDigestForUser(
  userId: string,
  pool?: DbPoolLike,
): Promise<WeeklyReportDigestRow | null> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT ${RETURNED_COLUMNS}
        FROM weekly_report_digests
        WHERE user_id = $1 AND dismissed_at IS NULL
        ORDER BY generated_at DESC, id DESC
        LIMIT 1
      `,
      [userId],
    );
    const row = result.rows[0];

    return row === undefined ? null : weeklyReportDigestRowSchema.parse(row);
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Marks one digest as dismissed for its owner.
 *
 * @param input - Digest id and owner user id.
 * @param pool - Optional injected database pool.
 * @returns Updated row, or null when no owner-scoped digest matched.
 */
export async function dismissWeeklyReportDigestForUser(
  input: { id: string; userId: string },
  pool?: DbPoolLike,
): Promise<WeeklyReportDigestRow | null> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        UPDATE weekly_report_digests
        SET dismissed_at = COALESCE(dismissed_at, now()), updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING ${RETURNED_COLUMNS}
      `,
      [input.id, input.userId],
    );
    const row = result.rows[0];

    return row === undefined ? null : weeklyReportDigestRowSchema.parse(row);
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}
