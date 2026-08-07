import type {
  ConsentType,
  UserConsentRow,
} from "../../db/user-consent-repository.js";
import {
  getConsentStatus,
  recordUserConsent,
} from "../../db/user-consent-repository.js";
import { loadServerEnv } from "../../env.js";
import { HttpError } from "../../utils/http-error.js";

/**
 * Version of the privacy policy this build asks users to consent to.
 *
 * @remarks
 * Must match `shared/src/consent.ts` and the version printed in the footer of
 * `client/public/legal/privacy.html`. Bump all three together when the policy
 * changes what is collected, why, or who receives it: PIPL art. 14 requires
 * fresh consent for those changes, and a stored consent is only meaningful
 * next to the text it was given for.
 */
export const CURRENT_PRIVACY_POLICY_VERSION = "2026-08-04";

export type DataResidency = "overseas" | "mainland";

export interface RegistrationPolicy {
  registration_open: boolean;
  policy_version: string;
  data_residency: DataResidency;
  cross_border_consent_required: boolean;
}

export interface ConsentDecisionInput {
  accepted: boolean;
  policy_version: string;
}

export interface PendingConsent {
  consent_type: ConsentType;
  policy_version: string;
}

export interface RegistrationPolicyOverrides {
  /** Overrides the env-derived registration mode; used by tests. */
  registrationInviteOnly?: boolean | undefined;
  /** Overrides the env-derived data residency; used by tests. */
  dataResidency?: DataResidency | undefined;
}

/**
 * Resolve the registration policy this instance is currently serving.
 *
 * @param overrides - Optional explicit values, injected by tests
 * @returns The policy the client should render and the server will enforce
 *
 * @remarks
 * Read per call rather than captured at module load, for the same reason the
 * registration gate re-reads its flag: a deployed process must never keep
 * serving a policy the operator has already changed.
 */
export function getRegistrationPolicy(
  overrides?: RegistrationPolicyOverrides,
): RegistrationPolicy {
  const env = loadServerEnv();
  const dataResidency = overrides?.dataResidency ?? env.dataResidency;
  const inviteOnly =
    overrides?.registrationInviteOnly ?? env.registrationInviteOnly;

  return {
    registration_open: !inviteOnly,
    policy_version: CURRENT_PRIVACY_POLICY_VERSION,
    data_residency: dataResidency,
    cross_border_consent_required: dataResidency === "overseas",
  };
}

/**
 * Reject a registration that lacks the cross-border consent this instance
 * requires.
 *
 * @param decision - Consent as submitted, if any
 * @param policy - Policy resolved for this instance
 * @throws HttpError 422 CONSENT_REQUIRED when consent is required and absent,
 *   refused, or given for a superseded policy version
 *
 * @remarks
 * The three rejected cases are one rule: the account may only exist if a
 * consent to the *current* text exists alongside it. A stale `policy_version`
 * is refused rather than accepted-and-upgraded, because a client running
 * cached JavaScript would otherwise submit agreement to wording that is no
 * longer served, and the stored row would claim they agreed to text they never
 * saw.
 */
export function assertCrossBorderConsent(
  decision: ConsentDecisionInput | undefined,
  policy: RegistrationPolicy,
): void {
  if (!policy.cross_border_consent_required) {
    return;
  }

  if (decision === undefined || !decision.accepted) {
    throw new HttpError(
      422,
      "CONSENT_REQUIRED",
      "Creating an account on this instance requires consent to storing your data outside mainland China.",
      { consent_type: "cross_border_transfer" satisfies ConsentType },
    );
  }

  if (decision.policy_version !== policy.policy_version) {
    throw new HttpError(
      422,
      "CONSENT_REQUIRED",
      "The privacy policy has changed since this page was loaded. Reload and read the current version before consenting.",
      {
        consent_type: "cross_border_transfer" satisfies ConsentType,
        expected_policy_version: policy.policy_version,
      },
    );
  }
}

interface PendingConsentDeps {
  readConsentStatus?: typeof getConsentStatus;
}

/**
 * List consents this account still owes under the policy currently served.
 *
 * @param userId - Authenticated user id
 * @param overrides - Optional explicit policy values, injected by tests
 * @param deps - Optional data-access overrides, injected by tests
 * @returns Outstanding consents, empty when the account is fully covered
 *
 * @remarks
 * This is how accounts that predate the consent seam are handled, and the
 * reason no backfill migration exists. Inserting consent rows for those users
 * would be signing on their behalf; they were notified offline, and being
 * notified is a different act from agreeing. So they surface here and are
 * asked, once, in the app.
 *
 * `sensitive_health_data` is listed only for users who actually stored injury
 * constraints. Demanding it from someone who never entered health data would
 * be asking them to consent to something that has not happened, which is the
 * same mistake as bundling it into registration.
 */
export async function getPendingConsents(
  userId: string,
  overrides?: RegistrationPolicyOverrides,
  deps?: PendingConsentDeps,
): Promise<PendingConsent[]> {
  const policy = getRegistrationPolicy(overrides);
  const readConsentStatus = deps?.readConsentStatus ?? getConsentStatus;
  const status = await readConsentStatus(userId, policy.policy_version);
  const pending: PendingConsent[] = [];

  if (policy.cross_border_consent_required && !status.hasCrossBorderConsent) {
    pending.push({
      consent_type: "cross_border_transfer",
      policy_version: policy.policy_version,
    });
  }

  if (status.hasStoredInjuryData && !status.hasHealthConsent) {
    pending.push({
      consent_type: "sensitive_health_data",
      policy_version: policy.policy_version,
    });
  }

  return pending;
}

/**
 * Whether the user already holds health-data consent for the current policy.
 *
 * @param userId - Owner user id
 * @param deps - Optional data-access overrides, injected by tests
 * @returns True when a `sensitive_health_data` consent exists for this version
 */
export async function hasSensitiveHealthConsent(
  userId: string,
  deps?: { readConsentStatus?: typeof getConsentStatus },
): Promise<boolean> {
  const readConsentStatus = deps?.readConsentStatus ?? getConsentStatus;
  const status = await readConsentStatus(
    userId,
    CURRENT_PRIVACY_POLICY_VERSION,
  );

  return status.hasHealthConsent;
}

export interface HealthConsentFlags {
  /** Whether the form may skip asking: consent to the *current* text exists. */
  health_consent_on_file: boolean;
  /** Whether there is a permission on file the user could take back. */
  withdrawable_health_consent: boolean;
}

/**
 * Both health-consent facts the profile form needs, from one status read.
 *
 * @param userId - Owner user id
 * @param deps - Optional data-access overrides, injected by tests
 * @returns Whether to ask for consent, and whether there is one to withdraw
 *
 * @remarks
 * Two flags rather than one because they answer different questions and
 * disagree in a state that really occurs: a consent given under superseded
 * wording is *not* permission to store injury data today (so the form must ask
 * again) but *is* a live permission the user may revoke (so the withdrawal
 * control must appear). Collapsing them either suppresses the checkbox — and
 * the save then fails with 422 the user was never warned about — or hides the
 * withdrawal control, which is the fitmind-lmy bug in a new place.
 *
 * Returned together from a single `getConsentStatus` call so the two cannot be
 * read at different moments and describe different states.
 */
export async function getHealthConsentFlags(
  userId: string,
  deps?: { readConsentStatus?: typeof getConsentStatus },
): Promise<HealthConsentFlags> {
  const readConsentStatus = deps?.readConsentStatus ?? getConsentStatus;
  const status = await readConsentStatus(
    userId,
    CURRENT_PRIVACY_POLICY_VERSION,
  );

  return {
    health_consent_on_file: status.hasHealthConsent,
    withdrawable_health_consent: status.hasWithdrawableHealthConsent,
  };
}

export interface RecordConsentInput {
  userId: string;
  consentType: ConsentType;
  accepted: boolean;
  policyVersion: string;
}

interface RecordConsentDeps {
  readConsentStatus?: typeof getConsentStatus;
  record?: typeof recordUserConsent;
}

/**
 * Record a consent the user owes, given outside the registration flow.
 *
 * @param input - Consent as submitted by an authenticated user
 * @param overrides - Optional explicit policy values, injected by tests
 * @param deps - Optional data-access overrides, injected by tests
 * @returns The stored consent row
 * @throws HttpError 422 CONSENT_REQUIRED when refused, given for a superseded
 *   policy version, or submitted for something this account does not owe
 *
 * @remarks
 * This endpoint only settles debts. It will not record a consent the account
 * is not currently on the hook for, and that restriction is the point rather
 * than a nicety: without it a client could POST a `sensitive_health_data`
 * consent out of nowhere and *then* save injury constraints, which turns
 * "asked at the moment the field is filled in" into "asked whenever the caller
 * feels like it" — consent detached from the processing it authorizes, which is
 * exactly what art. 29's separate-consent requirement is aimed at.
 *
 * Consent for *new* health data is therefore not obtainable here at all; it
 * rides along with the profile write (`saveProfileWithHealthConsent`, which
 * records the consent and the profile in one transaction under the shared
 * per-user lock). What this path covers is the catch-up case: injury
 * constraints that are already stored, from before the consent seam existed.
 *
 * Refusal is rejected rather than stored as `accepted = false`. A row in this
 * table is evidence that permission was granted; a "no" is the absence of that
 * evidence, and recording it as a row would make the table's meaning depend on
 * a column instead of on a row existing. Users who decline simply keep owing
 * the consent, and the app keeps asking.
 */
export async function recordConsent(
  input: RecordConsentInput,
  overrides?: RegistrationPolicyOverrides,
  deps?: RecordConsentDeps,
): Promise<UserConsentRow> {
  if (!input.accepted) {
    throw new HttpError(
      422,
      "CONSENT_REQUIRED",
      "Consent was not granted, so nothing was recorded.",
      { consent_type: input.consentType },
    );
  }

  if (input.policyVersion !== CURRENT_PRIVACY_POLICY_VERSION) {
    throw new HttpError(
      422,
      "CONSENT_REQUIRED",
      "The privacy policy has changed since this page was loaded. Reload and read the current version before consenting.",
      {
        consent_type: input.consentType,
        expected_policy_version: CURRENT_PRIVACY_POLICY_VERSION,
      },
    );
  }

  // Only settles a debt this account actually has. `getPendingConsents` reads
  // the database — stored injury rows, existing consent rows — not the request,
  // so a caller cannot talk its way into a consent by asserting the context.
  const pending = await getPendingConsents(input.userId, overrides, {
    ...(deps?.readConsentStatus === undefined
      ? {}
      : { readConsentStatus: deps.readConsentStatus }),
  });

  if (!pending.some((entry) => entry.consent_type === input.consentType)) {
    throw new HttpError(
      422,
      "CONSENT_REQUIRED",
      "This account does not currently owe that consent, so nothing was recorded.",
      { consent_type: input.consentType },
    );
  }

  const record = deps?.record ?? recordUserConsent;

  return record({
    userId: input.userId,
    consentType: input.consentType,
    policyVersion: input.policyVersion,
    source: "consent_catchup",
  });
}
