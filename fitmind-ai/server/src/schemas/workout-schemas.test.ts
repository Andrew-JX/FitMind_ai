import { describe, expect, it } from "vitest";

import { createWorkoutSchema, updateWorkoutSchema } from "./workout-schemas.js";

describe("workout schemas", () => {
  it("accepts optional workout start and end time", () => {
    const parsed = createWorkoutSchema.parse({
      performed_at: "2026-05-31T08:30:00.000Z",
      started_at: "2026-05-31T08:30:00.000Z",
      ended_at: "2026-05-31T09:15:00.000Z",
      duration_minutes: 45,
      sets: [
        {
          exercise_id: "11111111-1111-4111-8111-111111111111",
          is_warmup: false,
          reps: 10,
          set_index: 1,
          weight_kg: 60,
        },
      ],
    });

    expect(parsed).toMatchObject({
      ended_at: "2026-05-31T09:15:00.000Z",
      started_at: "2026-05-31T08:30:00.000Z",
    });
  });

  it("rejects a workout end time before the start time", () => {
    expect(() =>
      updateWorkoutSchema.parse({
        started_at: "2026-05-31T09:15:00.000Z",
        ended_at: "2026-05-31T08:30:00.000Z",
      }),
    ).toThrow();
  });
});
