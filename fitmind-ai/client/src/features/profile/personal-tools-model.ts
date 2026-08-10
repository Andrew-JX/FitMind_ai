export type WeightUnit = "kg" | "jin";

export function calculateEpleyOneRepMax(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || weight <= 0 || reps < 1 || reps > 12) {
    return 0;
  }
  return weight * (1 + reps / 30);
}

export function buildRmLoadTable(oneRepMax: number) {
  return [50, 60, 70, 75, 80, 85, 90, 95, 100].map((percentage) => ({
    percentage,
    weight: roundToHalf(oneRepMax * (percentage / 100)),
  }));
}

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit) {
  if (from === to) {
    return value;
  }
  return from === "kg" ? value * 2 : value / 2;
}

export function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function groupConsecutiveDates(dates: string[]): string[] {
  const ordered = [...new Set(dates)].sort();
  const groups: string[][] = [];

  for (const date of ordered) {
    const current = groups.at(-1);
    if (current === undefined) {
      groups.push([date]);
      continue;
    }
    const previous = new Date(`${current.at(-1)}T00:00:00`);
    previous.setDate(previous.getDate() + 1);
    if (formatLocalDate(previous) === date) {
      current.push(date);
    } else {
      groups.push([date]);
    }
  }

  return groups.map((group) => {
    const start = group[0] ?? "";
    const end = group.at(-1) ?? start;
    return start === end
      ? start.slice(5)
      : `${start.slice(5)} – ${end.slice(5)}`;
  });
}
