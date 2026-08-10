import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * End-to-end over real HTTP, with only the database replaced.
 *
 * @remarks
 * The earlier "bypass" coverage did not bypass anything: the service tests
 * called the service function directly, and the Playwright specs asserted on a
 * mock that fabricated a successful registration. Neither exercised Express,
 * the registration gate, the zod controller, or the real service wiring — which
 * is precisely the path a `curl` takes.
 *
 * So these tests speak HTTP to a real app instance. The repositories are
 * stubbed because there is no database in CI; everything above them is the
 * production code path.
 */
vi.mock("./db/repositories/index.js", () => ({
  createUser: vi.fn(),
  deleteUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
}));

vi.mock("./db/user-consent-repository.js", () => ({
  createUserWithConsents: vi.fn(),
  getConsentStatus: vi.fn(),
  recordUserConsent: vi.fn(),
}));

vi.mock("./db/athlete-profile-repository.js", () => ({
  getAthleteProfileByUserId: vi.fn(),
}));

vi.mock("./db/user-health-data-repository.js", () => ({
  saveProfileWithHealthConsent: vi.fn(),
  withdrawSensitiveHealthData: vi.fn(),
}));

vi.mock("./services/auth/password.js", () => ({
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("./services/auth/jwt.js", () => ({
  signJwt: vi.fn(),
  verifyJwt: vi.fn(),
}));

vi.mock("./services/training/workout-service.js", () => ({
  addUserWorkoutSet: vi.fn(),
  createUserWorkout: vi.fn(),
  deleteUserWorkout: vi.fn(),
  deleteUserWorkoutSet: vi.fn(),
  getUserWorkout: vi.fn(),
  listUserWorkouts: vi.fn(),
  updateUserWorkout: vi.fn(),
  updateUserWorkoutSet: vi.fn(),
}));

vi.mock("./services/personal-tools-service.js", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("./services/personal-tools-service.js")
    >();

  return {
    ...actual,
    removeAllBodyMeasurements: vi.fn(),
    removeBodyMeasurement: vi.fn(),
    removeMenstrualRecords: vi.fn(),
    withdrawAllSensitiveHealthData: vi.fn(),
  };
});

import { createApp } from "./app.js";
import { getAthleteProfileByUserId } from "./db/athlete-profile-repository.js";
import {
  saveProfileWithHealthConsent,
  withdrawSensitiveHealthData,
} from "./db/user-health-data-repository.js";
import {
  deleteUserById,
  findUserByEmail,
  findUserById,
} from "./db/repositories/index.js";
import type { UserConsentRow } from "./db/user-consent-repository.js";
import {
  createUserWithConsents,
  getConsentStatus,
  recordUserConsent,
} from "./db/user-consent-repository.js";
import { createAiRateLimiter } from "./services/assistant/ai-rate-limiter.js";
import { CURRENT_PRIVACY_POLICY_VERSION } from "./services/auth/consent-service.js";
import { signJwt, verifyJwt } from "./services/auth/jwt.js";
import { comparePassword, hashPassword } from "./services/auth/password.js";
import {
  removeAllBodyMeasurements,
  removeBodyMeasurement,
  removeMenstrualRecords,
  withdrawAllSensitiveHealthData,
} from "./services/personal-tools-service.js";
import { listUserWorkouts } from "./services/training/workout-service.js";

const mockedFindUserByEmail = vi.mocked(findUserByEmail);
const mockedFindUserById = vi.mocked(findUserById);
const mockedCreateUserWithConsents = vi.mocked(createUserWithConsents);
const mockedConsentStatus = vi.mocked(getConsentStatus);
const mockedRecordUserConsent = vi.mocked(recordUserConsent);
const mockedHashPassword = vi.mocked(hashPassword);
const mockedComparePassword = vi.mocked(comparePassword);
const mockedSignJwt = vi.mocked(signJwt);
const mockedVerifyJwt = vi.mocked(verifyJwt);
const mockedListUserWorkouts = vi.mocked(listUserWorkouts);
const mockedDeleteUserById = vi.mocked(deleteUserById);
const mockedWithdrawHealth = vi.mocked(withdrawSensitiveHealthData);
const mockedSaveProfile = vi.mocked(saveProfileWithHealthConsent);
const mockedRemoveAllBodyMeasurements = vi.mocked(removeAllBodyMeasurements);
const mockedRemoveBodyMeasurement = vi.mocked(removeBodyMeasurement);
const mockedRemoveMenstrualRecords = vi.mocked(removeMenstrualRecords);
const mockedWithdrawAllSensitiveHealthData = vi.mocked(
  withdrawAllSensitiveHealthData,
);

const USER_ID = "11111111-1111-4111-8111-111111111111";

const userRow = {
  id: USER_ID,
  email: "user@example.com",
  passwordHash: "stored-hash",
  displayName: "Andrew",
  createdAt: "2026-08-03T00:00:00.000Z",
  updatedAt: "2026-08-03T00:00:00.000Z",
};

/**
 * A complete `user_consents` row.
 *
 * @remarks
 * Written out in full rather than stubbed with `{ id } as never`. The cast was
 * not just a style problem: three of them hid shape errors, and one had the
 * workouts fixture returning `workouts` where the service returns `items` —
 * invisible because the test only asserted on the status code.
 */
function consentRow(overrides?: Partial<UserConsentRow>): UserConsentRow {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    user_id: USER_ID,
    consent_type: "cross_border_transfer",
    policy_version: CURRENT_PRIVACY_POLICY_VERSION,
    accepted_at: "2026-08-04T00:00:00.000Z",
    revoked_at: null,
    source: "consent_catchup",
    ...overrides,
  };
}

function consentStatus(overrides?: {
  hasCrossBorderConsent?: boolean;
  hasHealthConsent?: boolean;
  hasWithdrawableHealthConsent?: boolean;
  hasStoredInjuryData?: boolean;
  hasStoredHealthData?: boolean;
}) {
  const hasHealthConsent = overrides?.hasHealthConsent ?? false;

  return {
    hasCrossBorderConsent: overrides?.hasCrossBorderConsent ?? false,
    hasHealthConsent,
    // Defaults to the current-version answer because that is the ordinary
    // case: a live consent to today's text is also withdrawable. The two only
    // differ for superseded wording, and a test that cares about that says so.
    hasWithdrawableHealthConsent:
      overrides?.hasWithdrawableHealthConsent ?? hasHealthConsent,
    hasStoredInjuryData: overrides?.hasStoredInjuryData ?? false,
    hasStoredHealthData:
      overrides?.hasStoredHealthData ?? overrides?.hasStoredInjuryData ?? false,
  };
}

describe("consent enforcement over HTTP", () => {
  // The real registration gate reads env per request, and is fail-safe closed.
  // Opening it here means these tests pass through it rather than around it.
  process.env["REGISTRATION_INVITE_ONLY"] = "off";
  process.env["DATA_RESIDENCY"] = "overseas";

  const app = createApp({
    authRateLimiter: createAiRateLimiter({
      perMinute: 1_000,
      perDay: 100_000,
      now: () => 0,
    }),
  });
  const server = app.listen(0);

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedConsentStatus.mockResolvedValue(consentStatus());
    mockedHashPassword.mockResolvedValue("hashed-password");
    mockedSignJwt.mockResolvedValue("signed-token");
    mockedComparePassword.mockResolvedValue(true);
  });

  async function request(path: string, init?: RequestInit) {
    const address = server.address();

    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    return { status: response.status, payload: await response.json() };
  }

  function asUser(userId = USER_ID) {
    mockedVerifyJwt.mockResolvedValue({ userId });
    return { authorization: "Bearer any-token" };
  }

  describe("POST /api/auth/register", () => {
    it("refuses a registration submitted with no consent at all", async () => {
      const result = await request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: "new@example.com",
          password: "password123",
        }),
      });

      expect(result.status).toBe(422);
      expect(result.payload).toMatchObject({
        ok: false,
        error: { code: "CONSENT_REQUIRED" },
      });
      expect(mockedCreateUserWithConsents).not.toHaveBeenCalled();
    });

    it("refuses a registration that declines the consent", async () => {
      const result = await request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: "new@example.com",
          password: "password123",
          cross_border_consent: {
            accepted: false,
            policy_version: CURRENT_PRIVACY_POLICY_VERSION,
          },
        }),
      });

      expect(result.status).toBe(422);
      expect(mockedCreateUserWithConsents).not.toHaveBeenCalled();
    });

    it("refuses consent submitted for a superseded policy version", async () => {
      const result = await request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: "new@example.com",
          password: "password123",
          cross_border_consent: {
            accepted: true,
            policy_version: "2026-01-01",
          },
        }),
      });

      expect(result.status).toBe(422);
      expect(mockedCreateUserWithConsents).not.toHaveBeenCalled();
    });

    it("creates the account when the consent is present and current", async () => {
      mockedFindUserByEmail.mockResolvedValueOnce(null);
      mockedCreateUserWithConsents.mockResolvedValueOnce(userRow);

      const result = await request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: "user@example.com",
          password: "password123",
          cross_border_consent: {
            accepted: true,
            policy_version: CURRENT_PRIVACY_POLICY_VERSION,
          },
        }),
      });

      expect(result.status).toBe(201);
      expect(mockedCreateUserWithConsents).toHaveBeenCalledWith(
        expect.objectContaining({
          consents: [
            {
              consentType: "cross_border_transfer",
              policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
              source: "registration",
            },
          ],
        }),
      );
    });
  });

  describe("business endpoints while a consent is outstanding", () => {
    // The failure this closes: the block used to live only in `App.tsx`, so an
    // account that owed a consent reached every business endpoint by holding a
    // valid token — no browser required.
    it("refuses an account that still owes a cross-border consent", async () => {
      mockedConsentStatus.mockResolvedValue(consentStatus());

      const result = await request("/api/workouts", { headers: asUser() });

      expect(result.status).toBe(403);
      expect(result.payload).toMatchObject({
        ok: false,
        error: { code: "CONSENT_REQUIRED" },
      });
      expect(mockedListUserWorkouts).not.toHaveBeenCalled();
    });

    it("lets the same account through once the consent is on record", async () => {
      mockedConsentStatus.mockResolvedValue(
        consentStatus({ hasCrossBorderConsent: true }),
      );
      mockedListUserWorkouts.mockResolvedValueOnce({
        items: [],
        next_cursor: null,
      });

      const result = await request("/api/workouts", { headers: asUser() });

      expect(result.status).toBe(200);
      expect(mockedListUserWorkouts).toHaveBeenCalled();
    });

    it("keeps the catch-up endpoints reachable while consent is outstanding", async () => {
      mockedConsentStatus.mockResolvedValue(consentStatus());
      mockedFindUserById.mockResolvedValueOnce(userRow);

      const result = await request("/api/auth/me", { headers: asUser() });

      expect(result.status).toBe(200);
      expect(result.payload).toMatchObject({
        ok: true,
        data: {
          pending_consents: [
            {
              consent_type: "cross_border_transfer",
              policy_version: CURRENT_PRIVACY_POLICY_VERSION,
            },
          ],
        },
      });
    });
  });

  describe("POST /api/auth/consents", () => {
    it("settles an outstanding cross-border consent", async () => {
      mockedConsentStatus.mockResolvedValue(consentStatus());
      mockedRecordUserConsent.mockResolvedValueOnce(consentRow());

      const result = await request("/api/auth/consents", {
        method: "POST",
        headers: asUser(),
        body: JSON.stringify({
          consent_type: "cross_border_transfer",
          accepted: true,
          policy_version: CURRENT_PRIVACY_POLICY_VERSION,
        }),
      });

      expect(result.status).toBe(201);
      expect(mockedRecordUserConsent).toHaveBeenCalledWith(
        expect.objectContaining({ source: "consent_catchup" }),
      );
    });

    // The hole this closes: a client could otherwise POST a health consent out
    // of nowhere and only then save injury constraints, which detaches the
    // consent from the processing it is supposed to authorize.
    it("refuses a health consent from an account with no injury data stored", async () => {
      mockedConsentStatus.mockResolvedValue(
        consentStatus({ hasCrossBorderConsent: true }),
      );

      const result = await request("/api/auth/consents", {
        method: "POST",
        headers: asUser(),
        body: JSON.stringify({
          consent_type: "sensitive_health_data",
          accepted: true,
          policy_version: CURRENT_PRIVACY_POLICY_VERSION,
        }),
      });

      expect(result.status).toBe(422);
      expect(mockedRecordUserConsent).not.toHaveBeenCalled();
    });

    it("accepts a health consent for injury data that predates the seam", async () => {
      mockedConsentStatus.mockResolvedValue(
        consentStatus({
          hasCrossBorderConsent: true,
          hasStoredInjuryData: true,
        }),
      );
      mockedRecordUserConsent.mockResolvedValueOnce(
        consentRow({ consent_type: "sensitive_health_data" }),
      );

      const result = await request("/api/auth/consents", {
        method: "POST",
        headers: asUser(),
        body: JSON.stringify({
          consent_type: "sensitive_health_data",
          accepted: true,
          policy_version: CURRENT_PRIVACY_POLICY_VERSION,
        }),
      });

      expect(result.status).toBe(201);
    });

    it("refuses a declined consent rather than storing a negative row", async () => {
      mockedConsentStatus.mockResolvedValue(consentStatus());

      const result = await request("/api/auth/consents", {
        method: "POST",
        headers: asUser(),
        body: JSON.stringify({
          consent_type: "cross_border_transfer",
          accepted: false,
          policy_version: CURRENT_PRIVACY_POLICY_VERSION,
        }),
      });

      expect(result.status).toBe(422);
      expect(mockedRecordUserConsent).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/auth/account", () => {
    // The exit that makes "decline" honest. Reachable while a consent is
    // outstanding on purpose: an account that owes one is exactly the account
    // most likely to want out, and gating deletion behind the consent would
    // leave the user able to neither agree nor leave.
    it("deletes the account even while a consent is outstanding", async () => {
      mockedConsentStatus.mockResolvedValue(consentStatus());
      mockedFindUserById.mockResolvedValueOnce(userRow);
      mockedDeleteUserById.mockResolvedValueOnce(true);

      const result = await request("/api/auth/account", {
        method: "DELETE",
        headers: asUser(),
        body: JSON.stringify({ password: "password123" }),
      });

      expect(result.status).toBe(200);
      expect(mockedDeleteUserById).toHaveBeenCalledWith(USER_ID);
    });

    // A UI confirmation dialog protects nobody who is calling the API directly.
    // Tokens live for seven days, so without this a leaked cookie would be
    // enough to permanently destroy an account — the one action here with no
    // undo and nothing left to inspect afterwards.
    it("refuses to delete without the correct password", async () => {
      mockedConsentStatus.mockResolvedValue(consentStatus());
      mockedFindUserById.mockResolvedValueOnce(userRow);
      mockedComparePassword.mockResolvedValueOnce(false);

      const result = await request("/api/auth/account", {
        method: "DELETE",
        headers: asUser(),
        body: JSON.stringify({ password: "wrong-password" }),
      });

      expect(result.status).toBe(401);
      expect(mockedDeleteUserById).not.toHaveBeenCalled();
    });

    it("refuses to delete when no password is supplied at all", async () => {
      mockedConsentStatus.mockResolvedValue(consentStatus());

      const result = await request("/api/auth/account", {
        method: "DELETE",
        headers: asUser(),
        body: JSON.stringify({}),
      });

      expect(result.status).toBe(400);
      expect(mockedDeleteUserById).not.toHaveBeenCalled();
    });

    it("requires authentication", async () => {
      const result = await request("/api/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ password: "password123" }),
      });

      expect(result.status).toBe(401);
      expect(mockedDeleteUserById).not.toHaveBeenCalled();
    });

    // What a real second request does. The account is gone, so the lookup that
    // precedes the password check finds nothing and the request is refused as
    // unauthenticated — which is correct, and is not what "idempotent" would
    // have suggested.
    //
    // The previous version of this test kept `findUserById` returning a user
    // and only made the delete report zero rows. That is a concurrent-delete
    // race, not a repeat request, and it let the contract claim an idempotency
    // the code never had.
    it("refuses a second delete because the account no longer exists", async () => {
      mockedConsentStatus.mockResolvedValue(consentStatus());
      mockedFindUserById.mockResolvedValueOnce(userRow);
      mockedDeleteUserById.mockResolvedValueOnce(true);

      const first = await request("/api/auth/account", {
        method: "DELETE",
        headers: asUser(),
        body: JSON.stringify({ password: "password123" }),
      });

      expect(first.status).toBe(200);

      mockedFindUserById.mockResolvedValueOnce(null);

      const second = await request("/api/auth/account", {
        method: "DELETE",
        headers: asUser(),
        body: JSON.stringify({ password: "password123" }),
      });

      expect(second.status).toBe(401);
      expect(mockedDeleteUserById).toHaveBeenCalledTimes(1);
    });
  });

  describe("DELETE /api/athlete-profile/injury-constraints", () => {
    // The third option this seam was missing. The whole athlete-profile router
    // sits behind the consent gate, so a user owing the health-data consent
    // cannot reach PUT to clear the field. Without this exemption their only
    // choices are to consent anyway, log out with the data still stored, or
    // delete the entire account — refusing service over one consent.
    it("lets a user withdraw injury data while owing that very consent", async () => {
      mockedConsentStatus.mockResolvedValue(
        consentStatus({
          hasCrossBorderConsent: true,
          hasStoredInjuryData: true,
        }),
      );
      mockedWithdrawHealth.mockResolvedValueOnce(undefined);

      const result = await request("/api/athlete-profile/injury-constraints", {
        method: "DELETE",
        headers: asUser(),
      });

      expect(result.status).toBe(200);
      expect(mockedWithdrawHealth).toHaveBeenCalledWith(USER_ID);
    });

    // Clearing the field without revoking the consent produced a withdrawal
    // that undid itself: the next injury the user typed in would be stored
    // without asking, because a live consent was still on file.
    // Reports failure rather than a misleading success. The data and the
    // consent move together inside one transaction, under the shared per-user
    // lock (see `db/user-health-data-repository.test.ts`), so a failure here
    // means neither landed — which is what lets the UI say "nothing was
    // changed" truthfully.
    it("surfaces a failed withdrawal instead of claiming success", async () => {
      mockedConsentStatus.mockResolvedValue(
        consentStatus({
          hasCrossBorderConsent: true,
          hasStoredInjuryData: true,
        }),
      );
      mockedWithdrawHealth.mockRejectedValueOnce(new Error("db unavailable"));

      const result = await request("/api/athlete-profile/injury-constraints", {
        method: "DELETE",
        headers: asUser(),
      });

      expect(result.status).toBe(500);
    });

    // Scope check: withdrawal must not become a back door that wipes ordinary
    // profile data the user did consent to.
    it("does not touch the rest of the profile", async () => {
      mockedConsentStatus.mockResolvedValue(
        consentStatus({
          hasCrossBorderConsent: true,
          hasStoredInjuryData: true,
        }),
      );
      mockedWithdrawHealth.mockResolvedValueOnce(undefined);

      await request("/api/athlete-profile/injury-constraints", {
        method: "DELETE",
        headers: asUser(),
      });

      expect(mockedSaveProfile).not.toHaveBeenCalled();
    });

    it("still requires authentication", async () => {
      const result = await request("/api/athlete-profile/injury-constraints", {
        method: "DELETE",
      });

      expect(result.status).toBe(401);
      expect(mockedWithdrawHealth).not.toHaveBeenCalled();
    });

    // Contrast: the gated sibling stays gated, so the exemption is proven to be
    // narrow rather than an accidental hole in the router.
    it("keeps PUT /api/athlete-profile behind the gate", async () => {
      mockedConsentStatus.mockResolvedValue(consentStatus());

      const result = await request("/api/athlete-profile", {
        method: "PUT",
        headers: asUser(),
        body: JSON.stringify({
          goal: "strength",
          weeklyDays: 3,
          availableEquipment: [],
          injuryConstraints: [],
        }),
      });

      expect(result.status).toBe(403);
    });
  });

  describe("personal health deletion while consent is outstanding", () => {
    function owingHealthConsent() {
      mockedConsentStatus.mockResolvedValue(
        consentStatus({
          hasCrossBorderConsent: true,
          hasStoredHealthData: true,
        }),
      );
    }

    it.each([
      {
        path: "/api/personal-health-data",
        mock: mockedWithdrawAllSensitiveHealthData,
        expectedArgs: [USER_ID],
      },
      {
        path: "/api/menstrual-records",
        mock: mockedRemoveMenstrualRecords,
        expectedArgs: [USER_ID],
      },
      {
        path: "/api/body-measurements",
        mock: mockedRemoveAllBodyMeasurements,
        expectedArgs: [USER_ID],
      },
      {
        path: "/api/body-measurements/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        mock: mockedRemoveBodyMeasurement,
        expectedArgs: [USER_ID, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      },
    ])("keeps DELETE $path reachable", async ({ path, mock, expectedArgs }) => {
      owingHealthConsent();
      mock.mockResolvedValueOnce(undefined as never);

      const result = await request(path, {
        method: "DELETE",
        headers: asUser(),
      });

      expect(result.status).toBe(200);
      expect(mock).toHaveBeenCalledWith(...expectedArgs);
      expect(mockedConsentStatus).not.toHaveBeenCalled();
    });

    it("still requires authentication for category deletion", async () => {
      const result = await request("/api/menstrual-records", {
        method: "DELETE",
      });

      expect(result.status).toBe(401);
      expect(mockedRemoveMenstrualRecords).not.toHaveBeenCalled();
    });

    it("keeps personal health writes behind the consent gate", async () => {
      owingHealthConsent();

      const result = await request("/api/body-measurements", {
        method: "PUT",
        headers: asUser(),
        body: JSON.stringify({ measuredOn: "2026-08-10", weightKg: 70 }),
      });

      expect(result.status).toBe(403);
      expect(result.payload).toMatchObject({
        ok: false,
        error: { code: "CONSENT_REQUIRED" },
      });
    });
  });

  describe("PUT /api/athlete-profile", () => {
    // The gate and the recheck are two different refusals and only one of them
    // was covered. The gate (403, above) answers "this account owes a consent
    // it has not settled". This one answers "the consent was live when the
    // request arrived and was gone by the time the write took the lock" — the
    // fitmind-9yz race, seen from outside. Every test here therefore passes the
    // gate with a live health consent, so the only thing that can produce a 422
    // is the repository's in-lock recheck.
    function withSettledConsents() {
      mockedConsentStatus.mockResolvedValue(
        consentStatus({
          hasCrossBorderConsent: true,
          hasHealthConsent: true,
          hasStoredInjuryData: true,
        }),
      );
    }

    function putProfile(injuryConstraints: string[]) {
      return request("/api/athlete-profile", {
        method: "PUT",
        headers: asUser(),
        body: JSON.stringify({
          goal: "strength",
          weeklyDays: 3,
          availableEquipment: [],
          injuryConstraints,
        }),
      });
    }

    it("answers 422 CONSENT_REQUIRED when the in-lock recheck finds no consent", async () => {
      withSettledConsents();
      mockedSaveProfile.mockResolvedValueOnce({ status: "consent_missing" });

      const result = await putProfile(["knee"]);

      expect(result.status).toBe(422);
      expect(result.payload).toMatchObject({
        ok: false,
        error: {
          code: "CONSENT_REQUIRED",
          details: { consent_type: "sensitive_health_data" },
        },
      });
      // Proves the refusal came from the write path rather than the gate: the
      // request reached the repository, carrying the injury data, and was
      // turned away there.
      expect(mockedSaveProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          injuryConstraints: ["knee"],
        }),
      );
    });

    it("answers 422 with the current version when the consent is for a superseded policy", async () => {
      withSettledConsents();
      mockedSaveProfile.mockResolvedValueOnce({ status: "consent_stale" });

      const result = await putProfile(["shoulder"]);

      expect(result.status).toBe(422);
      expect(result.payload).toMatchObject({
        ok: false,
        error: {
          code: "CONSENT_REQUIRED",
          details: {
            consent_type: "sensitive_health_data",
            expected_policy_version: CURRENT_PRIVACY_POLICY_VERSION,
          },
        },
      });
    });

    // The two flags travel together and must be allowed to disagree. A user
    // holding only a superseded-version consent has to be asked again *and*
    // offered the withdrawal; one boolean cannot say both, and collapsing them
    // is what hid the control from those users.
    it("reports asking-again and withdrawable separately", async () => {
      // GET reads the profile too; without this the stub resolves undefined and
      // the 500 that follows would hide whatever this test meant to assert.
      vi.mocked(getAthleteProfileByUserId).mockResolvedValueOnce(null);
      mockedConsentStatus.mockResolvedValue(
        consentStatus({
          hasCrossBorderConsent: true,
          hasHealthConsent: false,
          hasWithdrawableHealthConsent: true,
        }),
      );

      const result = await request("/api/athlete-profile", {
        headers: asUser(),
      });

      expect(result.status).toBe(200);
      expect(result.payload).toMatchObject({
        ok: true,
        data: {
          health_consent_on_file: false,
          withdrawable_health_consent: true,
        },
      });
    });

    // The other half: without this, "everything 422s" would also pass.
    it("saves and reports the consent state when the write is accepted", async () => {
      withSettledConsents();
      mockedSaveProfile.mockResolvedValueOnce({
        status: "saved",
        row: {
          user_id: USER_ID,
          goal: "strength",
          weekly_days: 3,
          available_equipment: [],
          injury_constraints: ["knee"],
          created_at: "2026-08-06T00:00:00.000Z",
          updated_at: "2026-08-06T00:00:00.000Z",
        },
      });

      const result = await putProfile(["knee"]);

      expect(result.status).toBe(200);
      expect(result.payload).toMatchObject({
        ok: true,
        data: {
          profile: { injuryConstraints: ["knee"] },
          health_consent_on_file: true,
        },
      });
    });

    // fitmind-lmy, seen from outside: clearing the text and pressing Save has to
    // come back as a completed withdrawal, not as a save that quietly kept the
    // permission alive. `health_consent_on_file` is what the form reads to decide
    // whether to ask again, so it is the observable half of that promise.
    it("reports the consent as gone after an empty injury list is saved", async () => {
      mockedConsentStatus.mockResolvedValueOnce(
        consentStatus({
          hasCrossBorderConsent: true,
          hasHealthConsent: true,
          hasStoredInjuryData: true,
        }),
      );
      // The read the controller does *after* the write, by which time the empty
      // save has revoked the consent inside its transaction.
      mockedConsentStatus.mockResolvedValue(
        consentStatus({ hasCrossBorderConsent: true }),
      );
      mockedSaveProfile.mockResolvedValueOnce({
        status: "saved",
        row: {
          user_id: USER_ID,
          goal: "strength",
          weekly_days: 3,
          available_equipment: [],
          injury_constraints: [],
          created_at: "2026-08-06T00:00:00.000Z",
          updated_at: "2026-08-06T00:00:00.000Z",
        },
      });

      const result = await request("/api/athlete-profile", {
        method: "PUT",
        headers: asUser(),
        body: JSON.stringify({
          goal: "strength",
          weeklyDays: 3,
          availableEquipment: [],
          injuryConstraints: [],
        }),
      });

      expect(result.status).toBe(200);
      expect(result.payload).toMatchObject({
        ok: true,
        data: {
          profile: { injuryConstraints: [] },
          health_consent_on_file: false,
        },
      });
      expect(mockedSaveProfile).toHaveBeenCalledWith(
        expect.objectContaining({ injuryConstraints: [] }),
      );
    });
  });

  describe("router mounting", () => {
    // Several routers are mounted at the same  prefix. A path-less
    //  runs for every request that passes through
    // its router, including ones it has no handler for — so before the gates
    // were scoped to their own prefixes, a request walked through five of them
    // on the way to a handler, and anything mounted last was gated by everything
    // in front of it.
    it("asks the database about consent at most once per request", async () => {
      mockedConsentStatus.mockResolvedValue(
        consentStatus({ hasCrossBorderConsent: true }),
      );
      mockedListUserWorkouts.mockResolvedValueOnce({
        items: [],
        next_cursor: null,
      });

      const result = await request("/api/workouts", { headers: asUser() });

      expect(result.status).toBe(200);
      expect(mockedConsentStatus).toHaveBeenCalledTimes(1);
      expect(mockedVerifyJwt).toHaveBeenCalledTimes(1);
    });

    // Regression: this endpoint is unauthenticated by design (it carries its own
    // cron secret), but it is mounted last, so every gate in front of it
    // returned 401 before the handler could run. It was unreachable in
    // production and nothing noticed.
    it("leaves the unauthenticated cron endpoint reachable", async () => {
      const result = await request("/api/cron/weekly-reports", {
        method: "POST",
      });

      // Both the gate and this endpoint's own credential check answer 401, so
      // the status alone cannot tell them apart. The message can: reaching the
      // controller means the request got past every router in front of it.
      expect(result.payload).toMatchObject({
        error: { message: "Invalid cron credentials." },
      });
    });

    // The other half of the same change: scoping the gates must not have opened
    // any business route up.
    it("still refuses unauthenticated business requests", async () => {
      for (const path of [
        "/api/workouts",
        "/api/athlete-profile",
        "/api/planned-workouts",
        "/api/training/summary",
        "/api/assistant/insights",
      ]) {
        const result = await request(path);

        expect(result.status, path).toBe(401);
      }
    });

    it("keeps the public dictionary routes open", async () => {
      const result = await request("/api/muscle-groups");

      expect(result.status).not.toBe(401);
      expect(result.status).not.toBe(403);
    });
  });
});

// Its own app, because the shared one above deliberately runs with a limiter
// large enough that no test trips it.
describe("account deletion re-authentication is rate limited", () => {
  const app = createApp({
    authRateLimiter: createAiRateLimiter({
      perMinute: 2,
      perDay: 100_000,
      now: () => 0,
    }),
  });
  const server = app.listen(0);

  afterAll(() => {
    server.close();
  });

  async function attempt() {
    const address = server.address();

    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    vi.mocked(verifyJwt).mockResolvedValue({ userId: USER_ID });
    vi.mocked(getConsentStatus).mockResolvedValue(
      consentStatus({ hasCrossBorderConsent: true, hasHealthConsent: true }),
    );
    vi.mocked(findUserById).mockResolvedValue(userRow);
    vi.mocked(comparePassword).mockResolvedValue(false);

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/auth/account`,
      {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer any-token",
        },
        body: JSON.stringify({ password: "guess" }),
      },
    );

    return response.status;
  }

  // The login limiter does not cover this path: deletion re-authenticates
  // without going through /api/auth/login. Unlimited guesses against a
  // password that unlocks an irreversible delete is not a second factor, and
  // each guess also buys a deliberately slow bcrypt comparison.
  it("stops repeated password guesses", async () => {
    expect(await attempt()).toBe(401);
    expect(await attempt()).toBe(401);
    expect(await attempt()).toBe(429);
  });
});
