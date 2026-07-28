export type AssistantDateTerm = "this_week" | "last_week" | "this_month";

export interface AssistantDateRange {
  start_date: string;
  end_date: string;
}

export interface AssistantDateOption extends AssistantDateRange {
  label: string;
  term: AssistantDateTerm;
}

export type AssistantDateResolution =
  /** No supported time term in the message; the caller keeps its default range. */
  | { status: "absent" }
  /** Exactly one supported term. */
  | { status: "resolved"; option: AssistantDateOption }
  /** Two or more different supported terms; the caller must ask, never pick. */
  | { status: "ambiguous"; options: AssistantDateOption[] };

interface CivilDate {
  day: number;
  month: number;
  year: number;
}

/** Supported v1 vocabulary. Anything else is deliberately not parsed. */
const TERM_PATTERNS: ReadonlyArray<{
  label: string;
  term: AssistantDateTerm;
  variants: readonly string[];
}> = [
  { label: "本周", term: "this_week", variants: ["本周", "这周", "这个星期"] },
  {
    label: "上周",
    term: "last_week",
    variants: ["上周", "上一周", "上个星期"],
  },
  { label: "本月", term: "this_month", variants: ["本月", "这个月"] },
];

/**
 * Time expressions that contain a supported variant as a substring but mean
 * something the v1 vocabulary does not cover.
 *
 * Without this, "上上周" would match the "上周" variant and silently answer
 * about the wrong week — a wrong range presented as a correct one, which is the
 * failure this arc exists to prevent. Matches inside these spans are ignored so
 * the message degrades to `absent` and the caller falls back to its default.
 */
const SHADOWING_EXPRESSIONS: readonly string[] = [
  "上上周",
  "上上个星期",
  "上上星期",
  "下个星期",
];

/** Sunday, per the project's week-start decision. */
const WEEK_START_DAY = 0;

/**
 * Resolves at most one supported time term from a complete assistant message.
 *
 * All arithmetic runs on civil (Y/M/D) dates read in the requested IANA zone,
 * never by subtracting milliseconds, so a DST transition inside the window
 * cannot shift a boundary by a day.
 *
 * @param input - Message, IANA time zone, and an injectable reference instant
 * @returns Deterministic date resolution
 */
export function resolveAssistantDateRange(input: {
  message: string;
  now?: Date | undefined;
  timeZone: string;
}): AssistantDateResolution {
  const today = readCivilDate(input.now ?? new Date(), input.timeZone);

  if (!today) {
    // An unusable zone must not be guessed around: fall back to the caller's
    // default range rather than resolving a term against the wrong calendar.
    return { status: "absent" };
  }

  const blockedSpans = findShadowedSpans(input.message);
  const found: AssistantDateOption[] = [];

  for (const pattern of TERM_PATTERNS) {
    const hasVisibleMatch = pattern.variants.some((variant) =>
      hasMatchOutsideSpans(input.message, variant, blockedSpans),
    );

    if (hasVisibleMatch) {
      found.push({
        label: pattern.label,
        term: pattern.term,
        ...buildRange(pattern.term, today),
      });
    }
  }

  if (found.length === 0) {
    return { status: "absent" };
  }

  if (found.length === 1) {
    return { option: found[0] as AssistantDateOption, status: "resolved" };
  }

  return { options: found, status: "ambiguous" };
}

function findShadowedSpans(message: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];

  for (const expression of SHADOWING_EXPRESSIONS) {
    let index = message.indexOf(expression);

    while (index !== -1) {
      spans.push([index, index + expression.length]);
      index = message.indexOf(expression, index + 1);
    }
  }

  return spans;
}

function hasMatchOutsideSpans(
  message: string,
  variant: string,
  spans: Array<[number, number]>,
): boolean {
  let index = message.indexOf(variant);

  while (index !== -1) {
    const end = index + variant.length;
    const isShadowed = spans.some(
      ([spanStart, spanEnd]) => index >= spanStart && end <= spanEnd,
    );

    if (!isShadowed) {
      return true;
    }

    index = message.indexOf(variant, index + 1);
  }

  return false;
}

function buildRange(
  term: AssistantDateTerm,
  today: CivilDate,
): AssistantDateRange {
  if (term === "this_month") {
    return {
      end_date: formatCivilDate(today),
      start_date: formatCivilDate({ ...today, day: 1 }),
    };
  }

  const weekStart = addDays(today, -weekdayIndex(today));

  if (term === "this_week") {
    return {
      end_date: formatCivilDate(today),
      start_date: formatCivilDate(weekStart),
    };
  }

  const lastWeekStart = addDays(weekStart, -7);

  return {
    end_date: formatCivilDate(addDays(lastWeekStart, 6)),
    start_date: formatCivilDate(lastWeekStart),
  };
}

/**
 * Reads the calendar date showing on a wall clock in the given zone.
 *
 * @param instant - Reference instant
 * @param timeZone - IANA zone name
 * @returns The civil date, or null when the zone is unusable
 */
function readCivilDate(instant: Date, timeZone: string): CivilDate | null {
  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric",
    }).formatToParts(instant);
    const read = (type: string): number =>
      Number(parts.find((part) => part.type === type)?.value);
    const year = read("year");
    const month = read("month");
    const day = read("day");

    return Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)
      ? null
      : { day, month, year };
  } catch {
    return null;
  }
}

/**
 * Day of week for a civil date.
 *
 * Computed through `Date.UTC`, which has no DST, so this is pure calendar math
 * on the date itself rather than on any particular instant.
 */
function weekdayIndex(date: CivilDate): number {
  const utcDay = new Date(
    Date.UTC(date.year, date.month - 1, date.day),
  ).getUTCDay();

  return (utcDay - WEEK_START_DAY + 7) % 7;
}

function addDays(date: CivilDate, days: number): CivilDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day));

  shifted.setUTCDate(shifted.getUTCDate() + days);

  return {
    day: shifted.getUTCDate(),
    month: shifted.getUTCMonth() + 1,
    year: shifted.getUTCFullYear(),
  };
}

function formatCivilDate(date: CivilDate): string {
  const month = `${date.month}`.padStart(2, "0");
  const day = `${date.day}`.padStart(2, "0");

  return `${date.year}-${month}-${day}`;
}
