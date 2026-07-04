export type WorkoutIntakeDateSource =
  | "explicit_text"
  | "request_performed_at"
  | "server_default";

export interface WorkoutIntakeDateResult {
  date_label: string | null;
  date_source: WorkoutIntakeDateSource;
  performed_at: string;
}

interface ReferenceDateParts {
  day: number;
  hour: number;
  millisecond: number;
  minute: number;
  month: number;
  offset: string;
  second: number;
  year: number;
}

const CHINESE_NUMERALS = new Map<string, number>([
  ["\u96f6", 0],
  ["\u4e00", 1],
  ["\u4e8c", 2],
  ["\u4e24", 2],
  ["\u4e09", 3],
  ["\u56db", 4],
  ["\u4e94", 5],
  ["\u516d", 6],
  ["\u4e03", 7],
  ["\u516b", 8],
  ["\u4e5d", 9],
  ["\u5341", 10],
]);

export function parseWorkoutDateHint(
  text: string,
  reference: string | Date,
  sourceWhenNoHint: Exclude<
    WorkoutIntakeDateSource,
    "explicit_text"
  > = "request_performed_at",
): WorkoutIntakeDateResult {
  const referenceParts = parseReferenceDate(reference);
  const normalizedText = text.normalize("NFKC");
  const relativeDate = parseRelativeDate(normalizedText);

  if (relativeDate) {
    return {
      date_label: relativeDate.label,
      date_source: "explicit_text",
      performed_at: formatWithShift(referenceParts, relativeDate.dayOffset),
    };
  }

  const absoluteDate = parseAbsoluteDate(normalizedText, referenceParts.year);

  if (absoluteDate) {
    return {
      date_label: formatDateLabel(
        absoluteDate.year,
        absoluteDate.month,
        absoluteDate.day,
      ),
      date_source: "explicit_text",
      performed_at: formatDateTime({
        ...referenceParts,
        day: absoluteDate.day,
        month: absoluteDate.month,
        year: absoluteDate.year,
      }),
    };
  }

  return {
    date_label: null,
    date_source: sourceWhenNoHint,
    performed_at:
      typeof reference === "string" ? reference : reference.toISOString(),
  };
}

function parseRelativeDate(
  text: string,
): { dayOffset: number; label: string } | null {
  if (text.includes("\u524d\u5929")) {
    return { dayOffset: -2, label: "\u524d\u5929" };
  }

  if (text.includes("\u6628\u5929")) {
    return { dayOffset: -1, label: "\u6628\u5929" };
  }

  if (text.includes("\u4eca\u5929")) {
    return { dayOffset: 0, label: "\u4eca\u5929" };
  }

  return null;
}

function parseAbsoluteDate(
  text: string,
  defaultYear: number,
): { day: number; month: number; year: number } | null {
  const isoMatch = /(\d{4})-(\d{1,2})-(\d{1,2})/u.exec(text);

  if (isoMatch) {
    return createValidDateParts(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3]),
    );
  }

  const slashMatch = /(?:(\d{4})[/-])?(\d{1,2})[/-](\d{1,2})/u.exec(text);

  if (slashMatch) {
    return createValidDateParts(
      slashMatch[1] ? Number(slashMatch[1]) : defaultYear,
      Number(slashMatch[2]),
      Number(slashMatch[3]),
    );
  }

  const chineseYearMonthDayMatch =
    /(?:(\d{4}|[\u96f6\u4e00\u4e8c\u4e24\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+)\u5e74)?(\d{1,2}|[\u96f6\u4e00\u4e8c\u4e24\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+)\u6708(\d{1,2}|[\u96f6\u4e00\u4e8c\u4e24\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+)(?:\u65e5|\u53f7)?/u.exec(
      text,
    );

  if (!chineseYearMonthDayMatch) {
    return null;
  }

  const year = chineseYearMonthDayMatch[1]
    ? parseMaybeChineseYear(chineseYearMonthDayMatch[1])
    : defaultYear;
  const month = parseMaybeChineseNumber(chineseYearMonthDayMatch[2] ?? "");
  const day = parseMaybeChineseNumber(chineseYearMonthDayMatch[3] ?? "");

  return createValidDateParts(year, month, day);
}

function parseReferenceDate(reference: string | Date): ReferenceDateParts {
  if (typeof reference !== "string") {
    return {
      day: reference.getUTCDate(),
      hour: reference.getUTCHours(),
      millisecond: reference.getUTCMilliseconds(),
      minute: reference.getUTCMinutes(),
      month: reference.getUTCMonth() + 1,
      offset: "Z",
      second: reference.getUTCSeconds(),
      year: reference.getUTCFullYear(),
    };
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(Z|[+-]\d{2}:\d{2})$/u.exec(
      reference,
    );

  if (!match) {
    return parseReferenceDate(new Date(reference));
  }

  return {
    day: Number(match[3]),
    hour: Number(match[4]),
    millisecond: Number(match[7] ?? "0"),
    minute: Number(match[5]),
    month: Number(match[2]),
    offset: match[8] ?? "Z",
    second: Number(match[6]),
    year: Number(match[1]),
  };
}

function createValidDateParts(
  year: number,
  month: number,
  day: number,
): { day: number; month: number; year: number } | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1900 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { day, month, year };
}

function formatWithShift(
  referenceParts: ReferenceDateParts,
  dayOffset: number,
): string {
  const shifted = new Date(
    Date.UTC(
      referenceParts.year,
      referenceParts.month - 1,
      referenceParts.day + dayOffset,
    ),
  );

  return formatDateTime({
    ...referenceParts,
    day: shifted.getUTCDate(),
    month: shifted.getUTCMonth() + 1,
    year: shifted.getUTCFullYear(),
  });
}

function formatDateTime(parts: ReferenceDateParts): string {
  return `${pad(parts.year, 4)}-${pad(parts.month, 2)}-${pad(parts.day, 2)}T${pad(parts.hour, 2)}:${pad(parts.minute, 2)}:${pad(parts.second, 2)}.${pad(parts.millisecond, 3)}${parts.offset}`;
}

function formatDateLabel(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

function parseMaybeChineseYear(value: string): number {
  if (/^\d+$/u.test(value)) {
    return Number(value);
  }

  const digits = [...value]
    .map((character) => CHINESE_NUMERALS.get(character))
    .filter((digit): digit is number => digit !== undefined);

  return digits.length > 0 ? Number(digits.join("")) : Number.NaN;
}

function parseMaybeChineseNumber(value: string): number {
  if (/^\d+$/u.test(value)) {
    return Number(value);
  }

  return parseChineseNumber(value);
}

function parseChineseNumber(value: string): number {
  if (value === "\u5341") {
    return 10;
  }

  const tenIndex = value.indexOf("\u5341");

  if (tenIndex >= 0) {
    const beforeTen = value.slice(0, tenIndex);
    const afterTen = value.slice(tenIndex + 1);
    const tens = beforeTen === "" ? 1 : (CHINESE_NUMERALS.get(beforeTen) ?? 0);
    const ones = afterTen === "" ? 0 : (CHINESE_NUMERALS.get(afterTen) ?? 0);

    return tens * 10 + ones;
  }

  return CHINESE_NUMERALS.get(value) ?? Number.NaN;
}
