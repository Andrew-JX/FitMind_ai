import {
  dismissWeeklyReportDigestForUser,
  findLatestUndismissedWeeklyReportDigestForUser,
  listUsersWithRecentWorkouts,
  upsertWeeklyReportDigest,
  type UpsertWeeklyReportDigestResult,
  type WeeklyReportDigestRow,
} from "../../db/weekly-report-digest-repository.js";
import { loadServerEnv } from "../../env.js";
import { HttpError } from "../../utils/http-error.js";
import {
  getPendingConsents,
  getRegistrationPolicy,
} from "../auth/consent-service.js";
import {
  getUserWeeklyTrainingReport,
  type WeeklyTrainingReportResponseData,
} from "./weekly-training-report-service.js";

export interface WeeklyReportDigestDto {
  id: string;
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

export interface WeeklyReportDigestCronResult {
  enabled: boolean;
  attempted: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface IsoWeekRange {
  isoYear: number;
  isoWeek: number;
  startDate: string;
  endDate: string;
}

interface WeeklyReportDigestDependencies {
  getReport: typeof getUserWeeklyTrainingReport;
  getPendingConsentsFor: typeof getPendingConsents;
  getPolicy: typeof getRegistrationPolicy;
  listActiveUsers: typeof listUsersWithRecentWorkouts;
  loadEnv: typeof loadServerEnv;
  now: () => Date;
  readLatest: typeof findLatestUndismissedWeeklyReportDigestForUser;
  dismissDigest: typeof dismissWeeklyReportDigestForUser;
  upsertDigest: typeof upsertWeeklyReportDigest;
}

const defaultDependencies: WeeklyReportDigestDependencies = {
  getReport: getUserWeeklyTrainingReport,
  getPendingConsentsFor: getPendingConsents,
  getPolicy: getRegistrationPolicy,
  listActiveUsers: listUsersWithRecentWorkouts,
  loadEnv: loadServerEnv,
  now: () => new Date(),
  readLatest: findLatestUndismissedWeeklyReportDigestForUser,
  dismissDigest: dismissWeeklyReportDigestForUser,
  upsertDigest: upsertWeeklyReportDigest,
};

const ACTIVE_USER_LOOKBACK_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Generates weekly digest snapshots for active users when the global flag is on.
 *
 * @param dependencies - Optional injected dependencies for tests.
 * @returns Cron-safe counts only; no user ids or report payloads.
 */
export async function runWeeklyReportDigestCron(
  dependencies: WeeklyReportDigestDependencies = defaultDependencies,
): Promise<WeeklyReportDigestCronResult> {
  const env = dependencies.loadEnv();

  if (!env.weeklyReportDeliveryEnabled) {
    return {
      enabled: false,
      attempted: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };
  }

  const now = dependencies.now();
  const targetWeek = getPreviousIsoWeekRange(now);
  const activeSinceDate = formatDateOnlyUtc(
    new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
        ACTIVE_USER_LOOKBACK_DAYS * MS_PER_DAY,
    ),
  );
  const policy = dependencies.getPolicy();
  const userIds = await dependencies.listActiveUsers(activeSinceDate, {
    policyVersion: policy.policy_version,
    crossBorderRequired: policy.cross_border_consent_required,
  });
  const counts = {
    enabled: true,
    attempted: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const userId of userIds) {
    counts.attempted += 1;

    try {
      // Second line of defence, independent of the query above. The HTTP gate
      // cannot protect a cron run — there is no request to refuse — so the only
      // thing standing between an unconsented account and having its training
      // data read is this code. One filter in one SQL string is a single point
      // of failure for a compliance control; a caller that passes the wrong
      // policy, or a future refactor that drops the WHERE clause, would fail
      // silently and produce reports that look perfectly normal.
      const pending = await dependencies.getPendingConsentsFor(userId);

      if (pending.length > 0) {
        counts.skipped += 1;
        continue;
      }

      const report = await dependencies.getReport(userId, {
        start_date: targetWeek.startDate,
        end_date: targetWeek.endDate,
      });
      const digest = buildWeeklyReportDigestSnapshot(targetWeek, report);
      const result = await dependencies.upsertDigest({
        userId,
        isoYear: targetWeek.isoYear,
        isoWeek: targetWeek.isoWeek,
        weekStartDate: targetWeek.startDate,
        weekEndDate: targetWeek.endDate,
        status: report.status,
        title: digest.title,
        summary: digest.summary,
        reportSnapshot: report,
        generatedAt: now.toISOString(),
      });

      incrementUpsertCounts(counts, result);
    } catch {
      counts.failed += 1;
    }
  }

  return counts;
}

/**
 * Reads the latest visible weekly digest for the authenticated user.
 *
 * @param userId - Authenticated user id.
 * @param dependencies - Optional injected dependencies for tests.
 * @returns Latest digest DTO or null.
 */
export async function getLatestWeeklyReportDigest(
  userId: string,
  dependencies: WeeklyReportDigestDependencies = defaultDependencies,
): Promise<WeeklyReportDigestDto | null> {
  const row = await dependencies.readLatest(userId);

  return row === null ? null : mapDigestRow(row);
}

/**
 * Dismisses one weekly digest for the authenticated user.
 *
 * @param input - Digest id and authenticated owner id.
 * @param dependencies - Optional injected dependencies for tests.
 * @returns Dismissed digest DTO.
 */
export async function dismissWeeklyReportDigest(
  input: { id: string; userId: string },
  dependencies: WeeklyReportDigestDependencies = defaultDependencies,
): Promise<WeeklyReportDigestDto> {
  const row = await dependencies.dismissDigest(input);

  if (row === null) {
    throw new HttpError(
      404,
      "NOT_FOUND",
      "Weekly report digest was not found.",
    );
  }

  return mapDigestRow(row);
}

/**
 * Builds the deterministic title and short app-facing summary for a report.
 *
 * @param week - ISO week metadata.
 * @param report - Deterministic weekly report payload.
 * @returns Title and summary derived only from the report fields.
 */
export function buildWeeklyReportDigestSnapshot(
  week: IsoWeekRange,
  report: WeeklyTrainingReportResponseData,
): { title: string; summary: string } {
  const title = `Weekly report ${week.startDate} to ${week.endDate}`;

  if (report.status === "empty") {
    return {
      title,
      summary: `No workouts were recorded from ${week.startDate} to ${week.endDate}.`,
    };
  }

  const topExercise = report.top_exercises[0]?.exercise_name;
  const topExerciseText =
    topExercise === undefined ? "" : ` Top exercise: ${topExercise}.`;

  return {
    title,
    summary: `Recorded ${report.totals.workout_count} workouts and ${report.totals.set_count} sets from ${week.startDate} to ${week.endDate}.${topExerciseText}`,
  };
}

/**
 * Returns the previous ISO week range for a UTC reference time.
 *
 * @param referenceDate - UTC reference time.
 * @returns Previous ISO week year, week number, and inclusive date-only range.
 */
export function getPreviousIsoWeekRange(referenceDate: Date): IsoWeekRange {
  const currentDate = startOfUtcDay(referenceDate);
  const currentIsoDay = getIsoDay(currentDate);
  const currentWeekMonday = addUtcDays(currentDate, -(currentIsoDay - 1));
  const previousWeekMonday = addUtcDays(currentWeekMonday, -7);
  const previousWeekSunday = addUtcDays(previousWeekMonday, 6);
  const weekNumber = getIsoWeekNumber(previousWeekMonday);

  return {
    isoYear: weekNumber.isoYear,
    isoWeek: weekNumber.isoWeek,
    startDate: formatDateOnlyUtc(previousWeekMonday),
    endDate: formatDateOnlyUtc(previousWeekSunday),
  };
}

function incrementUpsertCounts(
  counts: WeeklyReportDigestCronResult,
  result: UpsertWeeklyReportDigestResult,
): void {
  if (result.inserted) {
    counts.created += 1;
    return;
  }

  counts.updated += 1;
}

function mapDigestRow(row: WeeklyReportDigestRow): WeeklyReportDigestDto {
  return {
    id: row.id,
    iso_year: row.iso_year,
    iso_week: row.iso_week,
    week_start_date: row.week_start_date,
    week_end_date: row.week_end_date,
    status: row.status,
    title: row.title,
    summary: row.summary,
    report_snapshot: row.report_snapshot,
    generated_at: row.generated_at,
    dismissed_at: row.dismissed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function getIsoDay(date: Date): number {
  const day = date.getUTCDay();

  return day === 0 ? 7 : day;
}

function getIsoWeekNumber(date: Date): { isoYear: number; isoWeek: number } {
  const thursday = addUtcDays(date, 4 - getIsoDay(date));
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstWeekMonday = addUtcDays(
    firstThursday,
    -(getIsoDay(firstThursday) - 1),
  );
  const isoWeek =
    Math.floor(
      (date.getTime() - firstWeekMonday.getTime()) / (7 * MS_PER_DAY),
    ) + 1;

  return { isoYear, isoWeek };
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function formatDateOnlyUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}
