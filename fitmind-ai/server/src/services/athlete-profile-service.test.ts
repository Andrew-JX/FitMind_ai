import { describe, expect, it, vi } from "vitest";

import type { AthleteProfileRow } from "../db/athlete-profile-repository.js";
import type { SaveProfileResult } from "../db/user-health-data-repository.js";
import {
  athleteProfileInputSchema,
  getAthleteProfile,
  saveAthleteProfile,
} from "./athlete-profile-service.js";
import { CURRENT_PRIVACY_POLICY_VERSION } from "./auth/consent-service.js";

function buildRow(
  overrides: Partial<AthleteProfileRow> = {},
): AthleteProfileRow {
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
      saveWithConsent: vi.fn(),
    });

    expect(profile).toBeNull();
  });

  it("maps a stored row to a DTO", async () => {
    const profile = await getAthleteProfile("u1", {
      getByUserId: vi.fn().mockResolvedValue(buildRow()),
      saveWithConsent: vi.fn(),
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
  const healthConsent = {
    accepted: true,
    policy_version: CURRENT_PRIVACY_POLICY_VERSION,
  };

  function saved(): SaveProfileResult {
    return { status: "saved", row: buildRow() };
  }

  it("normalizes tags before handing the write to the repository", async () => {
    const saveWithConsent = vi
      .fn<(input: unknown) => Promise<SaveProfileResult>>()
      .mockResolvedValue(saved());

    await saveAthleteProfile(
      "u1",
      {
        goal: "strength",
        weeklyDays: 3,
        availableEquipment: ["barbell", "barbell", "machine"],
        injuryConstraints: ["Knee", "knee", "Shoulder"],
        sensitiveHealthConsent: healthConsent,
      },
      { getByUserId: vi.fn(), saveWithConsent },
    );

    expect(saveWithConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        availableEquipment: ["barbell", "machine"],
        injuryConstraints: ["knee", "shoulder"],
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        consentDecision: healthConsent,
      }),
    );
  });

  // The consent decision and the write go to the repository together. Deciding
  // here and writing there meant two connections, and a withdrawal committing
  // between them left injury data behind with no live consent (fitmind-9yz).
  it("passes the consent decision with the write rather than checking first", async () => {
    const saveWithConsent = vi
      .fn<(input: unknown) => Promise<SaveProfileResult>>()
      .mockResolvedValue(saved());

    await saveAthleteProfile(
      "u1",
      {
        goal: "strength",
        weeklyDays: 3,
        availableEquipment: [],
        injuryConstraints: ["knee"],
        sensitiveHealthConsent: healthConsent,
      },
      { getByUserId: vi.fn(), saveWithConsent },
    );

    expect(saveWithConsent).toHaveBeenCalledTimes(1);
  });

  it("omits the consent decision when the client sent none", async () => {
    const saveWithConsent = vi
      .fn<(input: unknown) => Promise<SaveProfileResult>>()
      .mockResolvedValue(saved());

    await saveAthleteProfile(
      "u1",
      {
        goal: "strength",
        weeklyDays: 3,
        availableEquipment: [],
        injuryConstraints: [],
      },
      { getByUserId: vi.fn(), saveWithConsent },
    );

    expect(saveWithConsent).toHaveBeenCalledWith(
      expect.not.objectContaining({ consentDecision: expect.anything() }),
    );
  });

  it("raises 422 when the repository reports missing consent", async () => {
    const saveWithConsent = vi
      .fn<(input: unknown) => Promise<SaveProfileResult>>()
      .mockResolvedValue({ status: "consent_missing" });

    await expect(
      saveAthleteProfile(
        "u1",
        {
          goal: "strength",
          weeklyDays: 3,
          availableEquipment: [],
          injuryConstraints: ["knee"],
        },
        { getByUserId: vi.fn(), saveWithConsent },
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "CONSENT_REQUIRED",
      details: { consent_type: "sensitive_health_data" },
    });
  });

  it("raises 422 with the expected version when the consent is stale", async () => {
    const saveWithConsent = vi
      .fn<(input: unknown) => Promise<SaveProfileResult>>()
      .mockResolvedValue({ status: "consent_stale" });

    await expect(
      saveAthleteProfile(
        "u1",
        {
          goal: "strength",
          weeklyDays: 3,
          availableEquipment: [],
          injuryConstraints: ["knee"],
          sensitiveHealthConsent: {
            accepted: true,
            policy_version: "2026-01-01",
          },
        },
        { getByUserId: vi.fn(), saveWithConsent },
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "CONSENT_REQUIRED",
      details: { expected_policy_version: CURRENT_PRIVACY_POLICY_VERSION },
    });
  });
});
