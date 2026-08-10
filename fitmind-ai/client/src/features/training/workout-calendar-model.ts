import type {
  WorkoutDetailDto,
  WorkoutSummaryDto,
} from "../../../../shared/src/training";

export interface WorkoutCalendarDaySummary {
  notes: string[];
  totalVolume: number | null;
  workoutCount: number;
}

/**
 * Groups loaded workout summaries into local calendar days.
 *
 * Each workout contributes one note line. Missing notes remain visible as a
 * muted product-level placeholder instead of silently disappearing.
 */
export function summarizeWorkoutCalendarDays(
  workouts: WorkoutSummaryDto[],
): Map<string, WorkoutCalendarDaySummary> {
  const grouped = new Map<
    string,
    {
      notes: string[];
      totalVolume: number;
      volumeIsKnown: boolean;
      workoutCount: number;
    }
  >();

  for (const workout of workouts) {
    const key = toWorkoutLocalDateKey(new Date(workout.performed_at));
    const current = grouped.get(key) ?? {
      notes: [],
      totalVolume: 0,
      volumeIsKnown: true,
      workoutCount: 0,
    };
    const volume = workout.total_volume;

    current.notes.push(workout.notes?.trim() || "未填写备注");
    current.workoutCount += 1;
    if (typeof volume === "number" && Number.isFinite(volume)) {
      current.totalVolume += volume;
    } else {
      current.volumeIsKnown = false;
    }
    grouped.set(key, current);
  }

  return new Map(
    [...grouped].map(([key, day]) => [
      key,
      {
        notes: day.notes,
        totalVolume: day.volumeIsKnown ? day.totalVolume : null,
        workoutCount: day.workoutCount,
      },
    ]),
  );
}

export function formatCalendarVolume(totalVolume: number | null): string {
  return totalVolume === null ? "—" : Math.round(totalVolume).toLocaleString();
}

export function formatAccessibleCalendarVolume(
  totalVolume: number | null,
): string {
  return totalVolume === null
    ? "暂未提供"
    : `${Math.round(totalVolume).toLocaleString()} 公斤`;
}

export function calculateWorkoutVolume(workout: WorkoutDetailDto): number {
  return workout.sets.reduce(
    (total, set) => total + set.weight_kg * set.reps,
    0,
  );
}

export function toWorkoutLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
