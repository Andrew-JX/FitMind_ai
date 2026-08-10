import { describe, expect, it } from "vitest";

import type { WorkoutSummaryDto } from "../../../../shared/src/training";

import {
  calculateWorkoutVolume,
  formatCalendarVolume,
  summarizeWorkoutCalendarDays,
} from "./workout-calendar-model";

describe("summarizeWorkoutCalendarDays", () => {
  it("adds workout volume and keeps one note line per workout", () => {
    const performedAt = new Date(2026, 4, 3, 10, 0, 0).toISOString();
    const summaries = summarizeWorkoutCalendarDays([
      workout({
        id: "11111111-1111-4111-8111-111111111111",
        notes: "胸部力量训练",
        performed_at: performedAt,
        total_volume: 3200,
      }),
      workout({
        id: "22222222-2222-4222-8222-222222222222",
        notes: "  ",
        performed_at: performedAt,
        total_volume: 1800.4,
      }),
    ]);

    expect([...summaries.values()]).toEqual([
      {
        notes: ["胸部力量训练", "未填写备注"],
        totalVolume: 5000.4,
        workoutCount: 2,
      },
    ]);
  });

  it("does not show a misleading zero when an older API omits volume", () => {
    const summaries = summarizeWorkoutCalendarDays([
      workout({ total_volume: undefined }),
    ]);

    expect([...summaries.values()][0]?.totalVolume).toBeNull();
  });
});

describe("formatCalendarVolume", () => {
  it("rounds and groups known kilograms", () => {
    expect(formatCalendarVolume(23540.4)).toBe("23,540");
  });

  it("uses a dash for unavailable volume", () => {
    expect(formatCalendarVolume(null)).toBe("—");
  });
});

describe("calculateWorkoutVolume", () => {
  it("adds weight multiplied by reps across all workout sets", () => {
    expect(
      calculateWorkoutVolume({
        duration_minutes: 60,
        ended_at: null,
        id: "11111111-1111-4111-8111-111111111111",
        notes: "胸训",
        performed_at: new Date(2026, 4, 1, 10, 0, 0).toISOString(),
        sets: [
          {
            created_at: new Date(2026, 4, 1, 10, 0, 0).toISOString(),
            exercise_id: "22222222-2222-4222-8222-222222222222",
            id: "33333333-3333-4333-8333-333333333333",
            is_warmup: false,
            notes: null,
            reps: 8,
            rpe: 8,
            set_index: 1,
            weight_kg: 80,
          },
          {
            created_at: new Date(2026, 4, 1, 10, 5, 0).toISOString(),
            exercise_id: "22222222-2222-4222-8222-222222222222",
            id: "44444444-4444-4444-8444-444444444444",
            is_warmup: false,
            notes: null,
            reps: 10,
            rpe: null,
            set_index: 2,
            weight_kg: 60,
          },
        ],
        started_at: null,
      }),
    ).toBe(1240);
  });
});

function workout(
  overrides: Partial<WorkoutSummaryDto> = {},
): WorkoutSummaryDto {
  return {
    duration_minutes: 60,
    ended_at: null,
    id: "11111111-1111-4111-8111-111111111111",
    muscle_groups: ["胸"],
    notes: "训练备注",
    performed_at: new Date(2026, 4, 1, 10, 0, 0).toISOString(),
    sets_count: 5,
    started_at: null,
    total_volume: 1000,
    ...overrides,
  };
}
