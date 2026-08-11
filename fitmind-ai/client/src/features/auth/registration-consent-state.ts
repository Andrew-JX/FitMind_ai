import type { RegistrationPolicyData } from "../../../../shared/src/consent";

export interface RegistrationConsentState {
  isPolicyLoading: boolean;
  isRegistrationOpen: boolean;
  policyVersion: string | null;
  requiresCrossBorderConsent: boolean;
}

/** Derive fail-closed registration controls from the published site policy. */
export function deriveRegistrationConsentState(
  policy: RegistrationPolicyData | null,
  policyFailed: boolean,
): RegistrationConsentState {
  return {
    isPolicyLoading: policy === null && !policyFailed,
    isRegistrationOpen: policy?.registration_open === true,
    policyVersion: policy?.policy_version ?? null,
    requiresCrossBorderConsent: policy?.cross_border_consent_required === true,
  };
}
