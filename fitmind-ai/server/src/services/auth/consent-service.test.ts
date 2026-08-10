import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  assertCrossBorderConsent,
  CURRENT_PRIVACY_POLICY_VERSION,
  getPendingConsents,
  getRegistrationPolicy,
  recordConsent,
} from "./consent-service.js";

const overseasPolicy = {
  registration_open: true,
  policy_version: CURRENT_PRIVACY_POLICY_VERSION,
  data_residency: "overseas" as const,
  cross_border_consent_required: true,
};

/**
 * Stubs `getConsentStatus`. Everything defaults to "nothing on file, no injury
 * data", so each test only states the fact it is about.
 */
function status(overrides: {
  hasCrossBorderConsent?: boolean;
  hasHealthConsent?: boolean;
  hasWithdrawableHealthConsent?: boolean;
  hasStoredInjuryData?: boolean;
  hasStoredHealthData?: boolean;
}) {
  const hasHealthConsent = overrides.hasHealthConsent ?? false;

  return vi.fn().mockResolvedValue({
    hasCrossBorderConsent: overrides.hasCrossBorderConsent ?? false,
    hasHealthConsent,
    hasWithdrawableHealthConsent:
      overrides.hasWithdrawableHealthConsent ?? hasHealthConsent,
    hasStoredInjuryData: overrides.hasStoredInjuryData ?? false,
    hasStoredHealthData:
      overrides.hasStoredHealthData ?? overrides.hasStoredInjuryData ?? false,
  });
}

const mainlandPolicy = {
  ...overseasPolicy,
  data_residency: "mainland" as const,
  cross_border_consent_required: false,
};

function readRepoFile(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../../../${relativePath}`, import.meta.url)),
    "utf8",
  );
}

// The policy version lives in three places that cannot import each other: the
// server (here), the shared types the client reads, and the static legal page,
// which is plain HTML with no build step. Nothing but this test stops them from
// drifting — and a drifted version is not a cosmetic bug: the server would
// reject every consent the client submits, or store agreement against a version
// string the user never saw on the page.
describe("policy version stays in sync across the repo", () => {
  it("matches the version declared in shared/src/consent.ts", () => {
    const shared = readRepoFile("shared/src/consent.ts");

    expect(shared).toContain(
      `export const CURRENT_PRIVACY_POLICY_VERSION = "${CURRENT_PRIVACY_POLICY_VERSION}";`,
    );
  });

  it("matches the version printed on the privacy policy page", () => {
    const policyPage = readRepoFile("client/public/legal/privacy.html");

    expect(policyPage).toContain(
      `<code>${CURRENT_PRIVACY_POLICY_VERSION}</code>`,
    );
  });
});

describe("getRegistrationPolicy", () => {
  it("requires cross-border consent on an overseas instance", () => {
    const policy = getRegistrationPolicy({ dataResidency: "overseas" });

    expect(policy.cross_border_consent_required).toBe(true);
  });

  it("does not require cross-border consent on a mainland instance", () => {
    const policy = getRegistrationPolicy({ dataResidency: "mainland" });

    expect(policy.cross_border_consent_required).toBe(false);
  });

  // The two ways of being wrong are not symmetric. An unconfigured mainland
  // instance shows one unnecessary checkbox; an unconfigured overseas instance
  // exports personal information with no consent at all. The default has to
  // land on the first.
  it("defaults to requiring consent when residency is unconfigured", () => {
    const policy = getRegistrationPolicy();

    expect(policy.data_residency).toBe("overseas");
    expect(policy.cross_border_consent_required).toBe(true);
  });

  it("reports registration as closed under the invite-only flag", () => {
    expect(
      getRegistrationPolicy({ registrationInviteOnly: true }).registration_open,
    ).toBe(false);
    expect(
      getRegistrationPolicy({ registrationInviteOnly: false })
        .registration_open,
    ).toBe(true);
  });
});

describe("assertCrossBorderConsent", () => {
  it("accepts a consent to the current policy version", () => {
    expect(() =>
      assertCrossBorderConsent(
        { accepted: true, policy_version: CURRENT_PRIVACY_POLICY_VERSION },
        overseasPolicy,
      ),
    ).not.toThrow();
  });

  it("rejects a missing consent", () => {
    expect(() =>
      assertCrossBorderConsent(undefined, overseasPolicy),
    ).toThrowError(/requires consent/i);
  });

  it("rejects a declined consent", () => {
    expect(() =>
      assertCrossBorderConsent(
        { accepted: false, policy_version: CURRENT_PRIVACY_POLICY_VERSION },
        overseasPolicy,
      ),
    ).toThrowError(/requires consent/i);
  });

  it("rejects a consent to superseded wording", () => {
    expect(() =>
      assertCrossBorderConsent(
        { accepted: true, policy_version: "2026-01-01" },
        overseasPolicy,
      ),
    ).toThrowError(/privacy policy has changed/i);
  });

  it("asks nothing of an instance that stores no data abroad", () => {
    expect(() =>
      assertCrossBorderConsent(undefined, mainlandPolicy),
    ).not.toThrow();
  });
});

describe("getPendingConsents", () => {
  const overseas = { dataResidency: "overseas" } as const;

  it("owes a cross-border consent when none is on file", async () => {
    const pending = await getPendingConsents("u1", overseas, {
      readConsentStatus: status({}),
    });

    expect(pending).toEqual([
      {
        consent_type: "cross_border_transfer",
        policy_version: CURRENT_PRIVACY_POLICY_VERSION,
      },
    ]);
  });

  // Health consent is owed because of what is stored, not because of what a
  // request says. This is what stops a caller from manufacturing the context.
  it("owes a health consent only when injury data is actually stored", async () => {
    const withData = await getPendingConsents("u1", overseas, {
      readConsentStatus: status({
        hasCrossBorderConsent: true,
        hasStoredInjuryData: true,
      }),
    });
    const withoutData = await getPendingConsents("u1", overseas, {
      readConsentStatus: status({ hasCrossBorderConsent: true }),
    });

    expect(withData.map((entry) => entry.consent_type)).toEqual([
      "sensitive_health_data",
    ]);
    expect(withoutData).toEqual([]);
  });

  it("owes nothing once both consents are on file", async () => {
    const pending = await getPendingConsents("u1", overseas, {
      readConsentStatus: status({
        hasCrossBorderConsent: true,
        hasHealthConsent: true,
        hasStoredInjuryData: true,
      }),
    });

    expect(pending).toEqual([]);
  });
});

describe("recordConsent", () => {
  const overseas = { dataResidency: "overseas" } as const;

  it("settles a consent the account actually owes", async () => {
    const record = vi.fn().mockResolvedValue({ id: "c1" });

    await recordConsent(
      {
        userId: "u1",
        consentType: "cross_border_transfer",
        accepted: true,
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      },
      overseas,
      { readConsentStatus: status({}), record },
    );

    expect(record).toHaveBeenCalledWith({
      userId: "u1",
      consentType: "cross_border_transfer",
      policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      source: "consent_catchup",
    });
  });

  // The hole this closes: without the "do you owe it" check, a client could
  // POST a health consent from nowhere and only afterwards save injury data,
  // turning "asked at the moment the field is filled in" into "asked whenever
  // the caller likes" — consent detached from the processing it authorizes.
  it("refuses a health consent from a user with no injury data stored", async () => {
    const record = vi.fn();

    await expect(
      recordConsent(
        {
          userId: "u1",
          consentType: "sensitive_health_data",
          accepted: true,
          policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        },
        overseas,
        { readConsentStatus: status({ hasCrossBorderConsent: true }), record },
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "CONSENT_REQUIRED",
    });

    expect(record).not.toHaveBeenCalled();
  });

  it("accepts a health consent for injury data that predates the seam", async () => {
    const record = vi.fn().mockResolvedValue({ id: "c1" });

    await recordConsent(
      {
        userId: "u1",
        consentType: "sensitive_health_data",
        accepted: true,
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      },
      overseas,
      {
        readConsentStatus: status({
          hasCrossBorderConsent: true,
          hasStoredInjuryData: true,
        }),
        record,
      },
    );

    expect(record).toHaveBeenCalled();
  });

  it("refuses to re-record a consent already on file", async () => {
    const record = vi.fn();

    await expect(
      recordConsent(
        {
          userId: "u1",
          consentType: "cross_border_transfer",
          accepted: true,
          policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        },
        overseas,
        { readConsentStatus: status({ hasCrossBorderConsent: true }), record },
      ),
    ).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });

    expect(record).not.toHaveBeenCalled();
  });

  it("refuses a declined consent", async () => {
    const record = vi.fn();

    await expect(
      recordConsent(
        {
          userId: "u1",
          consentType: "cross_border_transfer",
          accepted: false,
          policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        },
        overseas,
        { readConsentStatus: status({}), record },
      ),
    ).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });

    expect(record).not.toHaveBeenCalled();
  });
});
