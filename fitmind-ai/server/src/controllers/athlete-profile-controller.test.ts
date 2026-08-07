import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/athlete-profile-service.js", async () => {
  const actual = await vi.importActual<
    typeof import("../services/athlete-profile-service.js")
  >("../services/athlete-profile-service.js");

  return {
    ...actual,
    getAthleteProfile: vi.fn(),
    saveAthleteProfile: vi.fn(),
  };
});

// Partial mock: the profile service imports `CURRENT_PRIVACY_POLICY_VERSION`
// from this module too, and replacing the whole module would strip it.
vi.mock("../services/auth/consent-service.js", async () => {
  const actual = await vi.importActual<
    typeof import("../services/auth/consent-service.js")
  >("../services/auth/consent-service.js");

  return {
    ...actual,
    getHealthConsentFlags: vi.fn(),
  };
});

import {
  getAthleteProfile,
  saveAthleteProfile,
} from "../services/athlete-profile-service.js";
import { getHealthConsentFlags } from "../services/auth/consent-service.js";
import {
  getAthleteProfileController,
  putAthleteProfileController,
} from "./athlete-profile-controller.js";

const mockedGet = vi.mocked(getAthleteProfile);
const mockedSave = vi.mocked(saveAthleteProfile);
const mockedHealthFlags = vi.mocked(getHealthConsentFlags);

/**
 * Both flags at once, because the controller now reads them as one fact.
 *
 * @param onFile - Whether consent to the current policy exists
 * @param withdrawable - Whether any live consent exists; defaults to onFile
 * @returns The flag pair the service resolves with
 */
function flags(onFile: boolean, withdrawable = onFile) {
  return {
    health_consent_on_file: onFile,
    withdrawable_health_consent: withdrawable,
  };
}

const USER_ID = "11111111-1111-4111-8111-111111111111";

function createResponse() {
  const response = {
    json: vi.fn(),
    locals: { userId: USER_ID },
    status: vi.fn(),
  };
  response.status.mockReturnValue(response);

  return response as unknown as Response<unknown, { userId: string }>;
}

function createRequest(body: unknown): Request {
  return { body } as unknown as Request;
}

describe("athlete-profile-controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the stored profile (or null) on GET", async () => {
    mockedGet.mockResolvedValueOnce(null);
    mockedHealthFlags.mockResolvedValueOnce(flags(false));
    const response = createResponse();

    await getAthleteProfileController(createRequest(undefined), response);

    expect(mockedGet).toHaveBeenCalledWith(USER_ID);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      ok: true,
      data: { profile: null, ...flags(false) },
    });
  });

  // The form asks for health consent exactly once. It can only do that if the
  // server tells it whether the consent is already held; otherwise it either
  // re-asks on every save or assumes an answer it cannot know.
  it("reports an existing health consent on GET", async () => {
    mockedGet.mockResolvedValueOnce(null);
    mockedHealthFlags.mockResolvedValueOnce(flags(true));
    const response = createResponse();

    await getAthleteProfileController(createRequest(undefined), response);

    expect(response.json).toHaveBeenCalledWith({
      ok: true,
      data: { profile: null, ...flags(true) },
    });
  });

  it("validates and saves the profile on PUT", async () => {
    mockedHealthFlags.mockResolvedValueOnce(flags(true));
    mockedSave.mockResolvedValueOnce({
      goal: "strength",
      weeklyDays: 3,
      availableEquipment: ["barbell"],
      injuryConstraints: ["knee"],
      updatedAt: "2026-06-14T00:00:00.000Z",
    });
    const response = createResponse();

    await putAthleteProfileController(
      createRequest({
        goal: "strength",
        weeklyDays: 3,
        availableEquipment: ["barbell"],
        injuryConstraints: ["knee"],
      }),
      response,
    );

    expect(mockedSave).toHaveBeenCalledWith(USER_ID, {
      goal: "strength",
      weeklyDays: 3,
      availableEquipment: ["barbell"],
      injuryConstraints: ["knee"],
    });
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("rejects an invalid goal before calling the service", async () => {
    await expect(
      putAthleteProfileController(
        createRequest({
          goal: "powerlifting",
          weeklyDays: 3,
          availableEquipment: [],
          injuryConstraints: [],
        }),
        createResponse(),
      ),
    ).rejects.toBeTruthy();
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("does not accept unknown fields in the body", async () => {
    await expect(
      putAthleteProfileController(
        createRequest({
          goal: "strength",
          weeklyDays: 3,
          availableEquipment: [],
          injuryConstraints: [],
          user_id: "22222222-2222-4222-8222-222222222222",
        }),
        createResponse(),
      ),
    ).rejects.toBeTruthy();
    expect(mockedSave).not.toHaveBeenCalled();
  });
});
