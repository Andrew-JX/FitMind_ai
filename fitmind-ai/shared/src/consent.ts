/**
 * Version of the privacy policy the current build asks users to consent to.
 *
 * @remarks
 * Bump this whenever `client/public/legal/privacy.html` changes what is
 * collected, why, or who receives it. A bump invalidates every stored consent
 * for the old version, which is the intended effect: PIPL art. 14 requires
 * consent to be obtained again when those things change, and the only way to
 * know whether a given user agreed to the current text is to record which text
 * they agreed to.
 *
 * The value is also rendered in the policy page footer, so the string a user
 * sees and the string stored against their consent can be compared by eye.
 */
export const CURRENT_PRIVACY_POLICY_VERSION = "2026-08-07";

/**
 * Consents tracked separately because they are asked separately.
 *
 * - `cross_border_transfer` — art. 39, storing personal information abroad.
 *   Asked at registration, because that is the moment data starts existing.
 * - `sensitive_health_data` — art. 28/29, injury constraints in the training
 *   profile. Asked in the profile form at the moment the field is filled in,
 *   not bundled into registration: at registration there is no health data yet
 *   and consent to a hypothetical is not consent.
 */
export type ConsentType = "cross_border_transfer" | "sensitive_health_data";

/** Where the consent was collected. Mirrors the `source` column. */
export type ConsentSource = "registration" | "profile_form" | "consent_catchup";

/**
 * A consent as submitted by a client.
 *
 * @remarks
 * `policy_version` is not decorative. Without it the server cannot tell a
 * consent to the current text from a consent to a superseded one, and a client
 * running stale cached JavaScript would keep submitting agreement to wording
 * that no longer exists.
 */
export interface ConsentDecision {
  accepted: boolean;
  policy_version: string;
}

/** Whether this deployment stores personal information outside mainland China. */
export type DataResidency = "overseas" | "mainland";

/**
 * Read-only registration policy, published so the client can render the truth
 * instead of guessing at it.
 *
 * @remarks
 * Every field here was previously either hardcoded in the client or knowable
 * only by submitting and reading the error. `registration_open` in particular
 * existed solely as a server-side gate: the sign-up form rendered
 * unconditionally and returned `403 REGISTRATION_CLOSED` after the user had
 * typed everything in.
 */
export interface RegistrationPolicyData {
  registration_open: boolean;
  policy_version: string;
  data_residency: DataResidency;
  /** True when this instance must obtain art. 39 consent before creating accounts. */
  cross_border_consent_required: boolean;
}

/** A consent this user still owes before the app can be used normally. */
export interface PendingConsentDto {
  consent_type: ConsentType;
  policy_version: string;
}

/** Payload for recording a consent outside the registration flow. */
export interface RecordConsentRequest {
  consent_type: ConsentType;
  accepted: boolean;
  policy_version: string;
}
