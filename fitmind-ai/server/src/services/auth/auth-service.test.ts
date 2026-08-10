import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db/repositories/index.js", () => ({
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
}));

vi.mock("../../db/user-consent-repository.js", () => ({
  createUserWithConsents: vi.fn(),
  getConsentStatus: vi.fn(),
  recordUserConsent: vi.fn(),
}));

vi.mock("./password.js", () => ({
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("./jwt.js", () => ({
  signJwt: vi.fn(),
}));

import { findUserByEmail, findUserById } from "../../db/repositories/index.js";
import {
  createUserWithConsents,
  getConsentStatus,
} from "../../db/user-consent-repository.js";
import { getCurrentUser, login, register } from "./auth-service.js";
import { CURRENT_PRIVACY_POLICY_VERSION } from "./consent-service.js";
import { signJwt } from "./jwt.js";
import { comparePassword, hashPassword } from "./password.js";

const mockedCreateUserWithConsents = vi.mocked(createUserWithConsents);
const mockedConsentStatus = vi.mocked(getConsentStatus);

/** Convenience for the "nothing on file, no injury data" baseline. */
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
    hasWithdrawableHealthConsent:
      overrides?.hasWithdrawableHealthConsent ?? hasHealthConsent,
    hasStoredInjuryData: overrides?.hasStoredInjuryData ?? false,
    hasStoredHealthData:
      overrides?.hasStoredHealthData ?? overrides?.hasStoredInjuryData ?? false,
  };
}
const mockedFindUserByEmail = vi.mocked(findUserByEmail);
const mockedFindUserById = vi.mocked(findUserById);
const mockedHashPassword = vi.mocked(hashPassword);
const mockedComparePassword = vi.mocked(comparePassword);
const mockedSignJwt = vi.mocked(signJwt);

const userRow = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "user@example.com",
  passwordHash: "stored-hash",
  displayName: "Andrew",
  createdAt: "2026-04-28T00:00:00.000Z",
  updatedAt: "2026-04-28T00:00:00.000Z",
};

/** An instance that stores data abroad, so art. 39 consent is required. */
const overseas = { dataResidency: "overseas" } as const;
/** An instance that stores nothing abroad, so no such consent applies. */
const mainland = { dataResidency: "mainland" } as const;

const validConsent = {
  accepted: true,
  policy_version: CURRENT_PRIVACY_POLICY_VERSION,
};

describe("auth-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedConsentStatus.mockResolvedValue(consentStatus());
  });

  it("registers a user and returns a signed token", async () => {
    mockedFindUserByEmail.mockResolvedValueOnce(null);
    mockedHashPassword.mockResolvedValueOnce("hashed-password");
    mockedCreateUserWithConsents.mockResolvedValueOnce(userRow);
    mockedSignJwt.mockResolvedValueOnce("signed-token");

    const result = await register(
      {
        email: "user@example.com",
        password: "password123",
        display_name: "Andrew",
        cross_border_consent: validConsent,
      },
      overseas,
    );

    expect(result).toEqual({
      user: {
        id: userRow.id,
        email: userRow.email,
        display_name: "Andrew",
      },
      token: "signed-token",
      pending_consents: [],
    });
  });

  // The consent row is not a side effect to check separately: it is written by
  // the same call that writes the user, which is what makes "account exists
  // without recorded consent" unrepresentable rather than merely unlikely.
  it("writes the consent alongside the user in one call", async () => {
    mockedFindUserByEmail.mockResolvedValueOnce(null);
    mockedHashPassword.mockResolvedValueOnce("hashed-password");
    mockedCreateUserWithConsents.mockResolvedValueOnce(userRow);
    mockedSignJwt.mockResolvedValueOnce("signed-token");

    await register(
      {
        email: "user@example.com",
        password: "password123",
        cross_border_consent: validConsent,
      },
      overseas,
    );

    expect(mockedCreateUserWithConsents).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@example.com",
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

  // This is the shape of the bug this batch exists to close. The checkbox lived
  // in React, so a caller that was not the sign-up form — curl, a script, a
  // stale bundle — reached the same endpoint with no consent at all and got an
  // account. These tests call the service directly for exactly that reason:
  // driving the UI would only ever prove the checkbox renders.
  it("refuses to create an account when consent is absent entirely", async () => {
    await expect(
      register(
        {
          email: "user@example.com",
          password: "password123",
        },
        overseas,
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "CONSENT_REQUIRED",
    });

    expect(mockedCreateUserWithConsents).not.toHaveBeenCalled();
  });

  it("refuses to create an account when consent is explicitly declined", async () => {
    await expect(
      register(
        {
          email: "user@example.com",
          password: "password123",
          cross_border_consent: {
            accepted: false,
            policy_version: CURRENT_PRIVACY_POLICY_VERSION,
          },
        },
        overseas,
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "CONSENT_REQUIRED",
    });

    expect(mockedCreateUserWithConsents).not.toHaveBeenCalled();
  });

  it("refuses consent given for a superseded policy version", async () => {
    await expect(
      register(
        {
          email: "user@example.com",
          password: "password123",
          cross_border_consent: {
            accepted: true,
            policy_version: "2026-01-01",
          },
        },
        overseas,
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "CONSENT_REQUIRED",
      details: { expected_policy_version: CURRENT_PRIVACY_POLICY_VERSION },
    });

    expect(mockedCreateUserWithConsents).not.toHaveBeenCalled();
  });

  // Refusing before hashing is not a micro-optimization: bcrypt is deliberately
  // slow, and a request that cannot succeed should not be able to buy that work.
  it("rejects a consentless registration before hashing the password", async () => {
    await expect(
      register(
        { email: "user@example.com", password: "password123" },
        overseas,
      ),
    ).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });

    expect(mockedHashPassword).not.toHaveBeenCalled();
  });

  // The mainland instance stores nothing abroad, so demanding art. 39 consent
  // there would be asking the user to agree to something that does not happen.
  it("registers without cross-border consent on a mainland instance", async () => {
    mockedFindUserByEmail.mockResolvedValueOnce(null);
    mockedHashPassword.mockResolvedValueOnce("hashed-password");
    mockedCreateUserWithConsents.mockResolvedValueOnce(userRow);
    mockedSignJwt.mockResolvedValueOnce("signed-token");

    await register(
      { email: "user@example.com", password: "password123" },
      mainland,
    );

    expect(mockedCreateUserWithConsents).toHaveBeenCalledWith(
      expect.objectContaining({ consents: [] }),
    );
  });

  it("rejects duplicate registration emails", async () => {
    mockedFindUserByEmail.mockResolvedValueOnce(userRow);

    await expect(
      register(
        {
          email: "user@example.com",
          password: "password123",
          display_name: "Andrew",
          cross_border_consent: validConsent,
        },
        overseas,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects login when the password is invalid", async () => {
    mockedFindUserByEmail.mockResolvedValueOnce(userRow);
    mockedComparePassword.mockResolvedValueOnce(false);

    await expect(
      login({
        email: "user@example.com",
        password: "wrong-password",
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("rejects current-user lookup when the user no longer exists", async () => {
    mockedFindUserById.mockResolvedValueOnce(null);

    await expect(
      getCurrentUser("11111111-1111-4111-8111-111111111111"),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  });

  // How the two pre-existing accounts are handled: surfaced and asked, never
  // backfilled. A migration that inserted rows for them would have made this
  // list empty and the problem invisible.
  it("reports an outstanding cross-border consent for an older account", async () => {
    mockedFindUserById.mockResolvedValueOnce(userRow);
    mockedConsentStatus.mockResolvedValueOnce(consentStatus());

    const result = await getCurrentUser(userRow.id, overseas);

    expect(result.pending_consents).toEqual([
      {
        consent_type: "cross_border_transfer",
        policy_version: CURRENT_PRIVACY_POLICY_VERSION,
      },
    ]);
  });

  it("reports nothing outstanding once the current version is on record", async () => {
    mockedFindUserById.mockResolvedValueOnce(userRow);
    mockedConsentStatus.mockResolvedValueOnce(
      consentStatus({ hasCrossBorderConsent: true }),
    );

    const result = await getCurrentUser(userRow.id, overseas);

    expect(result.pending_consents).toEqual([]);
  });

  // Consent to superseded wording is evidence of what they agreed to then, not
  // permission under the text being served now.
  it("treats a consent to an older policy version as still outstanding", async () => {
    mockedFindUserById.mockResolvedValueOnce(userRow);
    // The repository filters by version, so an old-version row simply is not
    // returned for the current one.
    mockedConsentStatus.mockResolvedValueOnce(consentStatus());

    const result = await getCurrentUser(userRow.id, overseas);

    expect(mockedConsentStatus).toHaveBeenCalledWith(
      userRow.id,
      CURRENT_PRIVACY_POLICY_VERSION,
    );
    expect(result.pending_consents).toHaveLength(1);
  });

  it("asks for health-data consent only from users who stored injury data", async () => {
    mockedFindUserById.mockResolvedValueOnce(userRow);
    mockedConsentStatus.mockResolvedValueOnce(
      consentStatus({ hasCrossBorderConsent: true, hasStoredInjuryData: true }),
    );

    const result = await getCurrentUser(userRow.id, overseas);

    expect(result.pending_consents).toEqual([
      {
        consent_type: "sensitive_health_data",
        policy_version: CURRENT_PRIVACY_POLICY_VERSION,
      },
    ]);
  });

  it("does not ask for health-data consent from a profile with no injuries", async () => {
    mockedFindUserById.mockResolvedValueOnce(userRow);
    mockedConsentStatus.mockResolvedValueOnce(
      consentStatus({ hasCrossBorderConsent: true }),
    );

    const result = await getCurrentUser(userRow.id, overseas);

    expect(result.pending_consents).toEqual([]);
  });
});
