/**
 * Date-range helpers for the analysis tab.
 *
 * The design's analysis tab is driven by one segmented control (近 7 天 /
 * 近 30 天 / 全部) shared by every card on the page, plus a fixed 4-week
 * bucket list for the weekly-volume chart. All ranges are inclusive
 * date-only strings in the device timezone, matching the training endpoints.
 */

export type AnalysisRangeKey = "last7" | "last30" | "all";

export interface AnalysisDateRange {
  end_date: string;
  start_date: string;
}

export interface AnalysisRangeOption {
  key: AnalysisRangeKey;
  label: string;
}

export interface WeeklyBucket {
  /** Short axis label (design: W1 / W2 / W3 / 本周). */
  label: string;
  range: AnalysisDateRange;
}

/**
 * Floor date for the 全部 range.
 *
 * The endpoints require a concrete start date, so 全部 asks from a date that
 * predates any possible training log. The echoed range is therefore not
 * meaningful for display — the overview note says 累计数据 instead of
 * printing these dates.
 */
const ALL_TIME_START_DATE = "2000-01-01";

/** Sunday, per the project's week-start decision. */
const WEEK_START_DAY = 0;

export const ANALYSIS_RANGE_OPTIONS: AnalysisRangeOption[] = [
  { key: "last7", label: "近 7 天" },
  { key: "last30", label: "近 30 天" },
  { key: "all", label: "全部" },
];

/**
 * Builds the inclusive date range for one analysis range key.
 *
 * @param key - Selected range key
 * @param today - Reference day, defaults to now (injectable for tests)
 * @returns Inclusive date-only range
 */
export function createAnalysisRange(
  key: AnalysisRangeKey,
  today: Date = new Date(),
): AnalysisDateRange {
  const endDate = startOfDay(today);

  if (key === "all") {
    return {
      end_date: formatDateOnly(endDate),
      start_date: ALL_TIME_START_DATE,
    };
  }

  const startDate = addDays(endDate, key === "last7" ? -6 : -29);

  return {
    end_date: formatDateOnly(endDate),
    start_date: formatDateOnly(startDate),
  };
}

/**
 * Builds the trailing week buckets for the weekly-volume chart.
 *
 * Weeks start on Sunday. The newest bucket is the current, still-running week
 * and ends today; older buckets are complete Sunday-to-Saturday weeks.
 *
 * @param weekCount - Number of buckets, oldest first
 * @param today - Reference day, defaults to now (injectable for tests)
 * @returns Buckets ordered oldest to newest
 */
export function createWeeklyBuckets(
  weekCount: number,
  today: Date = new Date(),
): WeeklyBucket[] {
  const endDate = startOfDay(today);
  const currentWeekStart = startOfWeek(endDate);
  const buckets: WeeklyBucket[] = [];

  for (let offset = weekCount - 1; offset >= 0; offset -= 1) {
    const weekStart = addDays(currentWeekStart, -7 * offset);
    const isCurrentWeek = offset === 0;
    const weekEnd = isCurrentWeek ? endDate : addDays(weekStart, 6);

    buckets.push({
      label: isCurrentWeek ? "本周" : `W${weekCount - offset}`,
      range: {
        end_date: formatDateOnly(weekEnd),
        start_date: formatDateOnly(weekStart),
      },
    });
  }

  return buckets;
}

/**
 * Formats a date as the date-only string the training endpoints expect.
 *
 * @param date - Local date
 * @returns YYYY-MM-DD
 */
export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Formats a date-only string for prose (e.g. 6月27日).
 *
 * @param value - YYYY-MM-DD
 * @returns Localized short date, or the input when unparseable
 */
export function formatDisplayDate(value: string): string {
  const date = parseDateOnly(value);

  if (!date) {
    return value;
  }

  return date.toLocaleDateString("zh-CN", { day: "numeric", month: "short" });
}

/**
 * Formats a timestamp as the chart's compact axis label (design: 06/28).
 *
 * @param value - ISO timestamp or date-only string
 * @returns MM/DD, or the input when unparseable
 */
export function formatMonthDay(value: string): string {
  const date = value.length === 10 ? parseDateOnly(value) : new Date(value);

  if (!date || Number.isNaN(date.getTime())) {
    return value;
  }

  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${month}/${day}`;
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearValue, monthValue, dayValue] = value.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const dayOffset = (date.getDay() - WEEK_START_DAY + 7) % 7;

  return addDays(date, -dayOffset);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);

  next.setDate(next.getDate() + days);

  return next;
}
