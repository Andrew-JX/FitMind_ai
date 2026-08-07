import type { ConsentDecision, PendingConsentDto } from "./consent";

export interface AuthUserDto {
  id: string;
  email: string;
  display_name: string | null;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name?: string | undefined;
  /**
   * Art. 39 consent to storing personal information abroad.
   *
   * Optional in the type because a mainland instance does not need it; the
   * server decides whether it is required from its own configuration, and
   * rejects the request when it is required and missing. Clients must never
   * decide this for themselves — the previous version enforced the check only
   * in React, so `POST /api/auth/register` created accounts without it.
   */
  cross_border_consent?: ConsentDecision | undefined;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthSuccessData {
  user: AuthUserDto;
  token: string;
  /** See {@link MeResponseData.pending_consents}. Always empty after register. */
  pending_consents: PendingConsentDto[];
}

export interface MeResponseData {
  user: AuthUserDto;
  /**
   * Consents this account owes before the app can be used normally — empty for
   * an account created after the consent seam landed.
   *
   * Accounts that predate it appear here instead of being backfilled. Writing
   * a consent row on their behalf would be signing for them: the operator
   * notified those users offline, and being notified is not the same act as
   * agreeing.
   */
  pending_consents: PendingConsentDto[];
}

export interface LogoutResponseData {
  success: boolean;
}
