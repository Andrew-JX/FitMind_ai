export function formatTrainingTimeSummary(input: {
  durationMin: number | null;
  endedAt: string | null | undefined;
  performedAt: string | null | undefined;
  startedAt: string | null | undefined;
}): string {
  if (input.startedAt && input.endedAt) {
    return `${formatTimeOnly(input.startedAt)} - ${formatTimeOnly(input.endedAt)}`;
  }

  if (input.durationMin !== null) {
    return `${input.durationMin} \u5206\u949f`;
  }

  if (input.performedAt) {
    return "\u4ec5\u8bb0\u5f55\u4e86\u8bad\u7ec3\u65e5\u671f";
  }

  return "\u672a\u8bbe\u7f6e";
}

export function formatTimeOnly(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTimeLocalValue(
  value: string | null | undefined,
): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function parseDateTimeLocalValue(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function getDurationMinutesFromLocalValues(
  startedAtValue: string,
  endedAtValue: string,
): number | null {
  const startedAt = parseDateTimeLocalValue(startedAtValue);
  const endedAt = parseDateTimeLocalValue(endedAtValue);

  if (!startedAt || !endedAt) {
    return null;
  }

  const durationMs =
    new Date(endedAt).getTime() - new Date(startedAt).getTime();

  return durationMs > 0 ? Math.max(1, Math.round(durationMs / 60000)) : null;
}
