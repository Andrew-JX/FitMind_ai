import { describe, expect, it } from "vitest";

import type { RegistrationPolicyData } from "../../../../shared/src/consent";
import { deriveRegistrationConsentState } from "./registration-consent-state";

const OVERSEAS_POLICY: RegistrationPolicyData = {
  registration_open: true,
  policy_version: "policy-under-test",
  data_residency: "overseas",
  cross_border_consent_required: true,
};

describe("deriveRegistrationConsentState", () => {
  it("keeps registration closed while the policy is loading", () => {
    expect(deriveRegistrationConsentState(null, false)).toEqual({
      isPolicyLoading: true,
      isRegistrationOpen: false,
      policyVersion: null,
      requiresCrossBorderConsent: false,
    });
  });

  it("fails registration closed when the policy read failed", () => {
    expect(deriveRegistrationConsentState(null, true)).toEqual({
      isPolicyLoading: false,
      isRegistrationOpen: false,
      policyVersion: null,
      requiresCrossBorderConsent: false,
    });
  });

  it("requires separate cross-border consent on an overseas instance", () => {
    expect(deriveRegistrationConsentState(OVERSEAS_POLICY, false)).toEqual({
      isPolicyLoading: false,
      isRegistrationOpen: true,
      policyVersion: "policy-under-test",
      requiresCrossBorderConsent: true,
    });
  });

  it("does not invent cross-border processing on a mainland instance", () => {
    expect(
      deriveRegistrationConsentState(
        {
          ...OVERSEAS_POLICY,
          data_residency: "mainland",
          cross_border_consent_required: false,
        },
        false,
      ),
    ).toEqual({
      isPolicyLoading: false,
      isRegistrationOpen: true,
      policyVersion: "policy-under-test",
      requiresCrossBorderConsent: false,
    });
  });

  it("keeps an explicitly closed deployment closed", () => {
    expect(
      deriveRegistrationConsentState(
        { ...OVERSEAS_POLICY, registration_open: false },
        false,
      ),
    ).toMatchObject({ isRegistrationOpen: false });
  });
});
