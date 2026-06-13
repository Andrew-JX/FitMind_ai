import { describe, expect, it, vi } from "vitest";

import type {
  AthleteProfileRow,
  UpsertAthleteProfileInput,
} from "../db/athlete-profile-repository.js";
import {
  athleteProfileInputSchema,
  getAthleteProfile,
  saveAthleteProfile,
} from "./athlete-profile-service.js";

function buildRow(overrides: Partial<AthleteProfileRow> = {}): AthleteProfileRow {
  return {
    user_id: "u1",
    goal: "hypertrophy",
    weekly_days: 4,
    available_equipment: ["barbell", "dumbbell"],
    injury_constraints: ["knee"],
    created_at: "2026-06-14T00:00:00.000Z",
    updated_at: "2026-06-14T00:00:00.000Z",
    ...overrides,
  };
}

describe("athleteProfileInputSchema", () => {
  it("rejects an out-of-range weekly_days", () => {
    const result = athleteProfileInputSchema.safeParse({
      goal: "strength",
      weeklyDays: 9,
      availableEquipment: [],
      injuryConstraints: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unknown goal", () => {
    const result = athleteProfileInputSchema.safeParse({
      goal: "powerlifting",
      weeklyDays: 4,
      availableEquipment: [],
      injuryConstraints: [],
    });

    expect(result.success).toBe(false);
  });
});

describe("getAthleteProfile", () => {
  it("returns null when no profile exists", async () => {
    const profile = await getAthleteProfile("u1", {
      getByUserId: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    });

    expect(profile).toBeNull();
  });

  it("maps a stored row to a DTO", async () => {
    const profile = await getAthleteProfile("u1", {
      getByUserId: vi.fn().mockResolvedValue(buildRow()),
      upsert: vi.fn(),
    });

    expect(profile).toEqual({
      goal: "hypertrophy",
      weeklyDays: 4,
      availableEquipment: ["barbell", "dumbbell"],
      injuryConstraints: ["knee"],
      updatedAt: "2026-06-14T00:00:00.000Z",
    });
  });
});

describe("saveAthleteProfile", () => {
  it("dedupes and lowercases tags before upserting", async () => {
    const upsert = vi
      .fn<(input: UpsertAthleteProfileInput) => Promise<AthleteProfileRow>>()
      .mockResolvedValue(buildRow());

    await saveAthleteProfile(
      "u1",
      {
        goal: "strength",
        weeklyDays: 3,
        availableEquipment: ["barbell", "barbell", "machine"],
        injuryConstraints: ["Knee", "knee", "Shoulder"],
      },
      { getByUserId: vi.fn(), upsert },
    );

    expect(upsert).toHaveBeenCalledWith({
      userId: "u1",
      goal: "strength",
      weeklyDays: 3,
      availableEquipment: ["barbell", "machine"],
      injuryConstraints: ["knee", "shoulder"],
    });
  });
});
