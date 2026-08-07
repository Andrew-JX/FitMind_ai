import type {
  AuthSuccessData,
  LoginRequest,
  LogoutResponseData,
  MeResponseData,
  RegisterRequest,
} from "../../../../shared/src/auth";
import type {
  RecordConsentRequest,
  RegistrationPolicyData,
} from "../../../../shared/src/consent";

import { requestJson } from "../../services/http-client";

/**
 * Reads the registration policy this instance is serving.
 *
 * @returns Whether sign-up is open, the current policy version, and whether
 *   cross-border consent must accompany a registration
 *
 * @remarks
 * Unauthenticated, and read before the sign-up form renders. The client used
 * to hardcode every one of these facts — including which countries hold the
 * data — which made the same bundle wrong on whichever deployment it was not
 * written for.
 */
export async function fetchRegistrationPolicy(): Promise<RegistrationPolicyData> {
  return requestJson<RegistrationPolicyData>("/api/auth/registration-policy");
}

/**
 * Records a consent for the signed-in user.
 *
 * @param input - Consent type, decision, and the policy version consented to
 * @returns Resolves once the consent is stored
 *
 * @remarks
 * Used by the catch-up flow for accounts that predate the consent seam, and by
 * the profile form for health data. Registration sends its consent inside the
 * register request instead, so the account and the consent share a transaction.
 */
export async function recordConsent(
  input: RecordConsentRequest,
): Promise<unknown> {
  return requestJson<unknown, RecordConsentRequest>("/api/auth/consents", {
    method: "POST",
    body: input,
  });
}

/**
 * Registers a new user against the FitMind auth API.
 *
 * @param input - Register request payload
 * @returns The authenticated user plus the issued token
 */
export async function registerWithEmail(
  input: RegisterRequest,
): Promise<AuthSuccessData> {
  return requestJson<AuthSuccessData, RegisterRequest>("/api/auth/register", {
    method: "POST",
    body: input,
  });
}

/**
 * Logs an existing user into the FitMind auth API.
 *
 * @param input - Login request payload
 * @returns The authenticated user plus the issued token
 */
export async function loginWithEmail(
  input: LoginRequest,
): Promise<AuthSuccessData> {
  return requestJson<AuthSuccessData, LoginRequest>("/api/auth/login", {
    method: "POST",
    body: input,
  });
}

/**
 * Fetches the current authenticated user.
 *
 * @param token - Optional bearer token; omit to rely on the session cookie
 * @returns The current authenticated user
 *
 * @remarks
 * With the HttpOnly cookie session the browser authenticates via cookie, so the
 * token argument is optional and only used as a fallback for non-cookie callers.
 */
export async function fetchCurrentUser(
  token?: string | null | undefined,
): Promise<MeResponseData> {
  return requestJson<MeResponseData>("/api/auth/me", {
    token,
  });
}

/**
 * Deletes the signed-in account from the active database.
 *
 * @param password - Current password, re-checked server-side before deleting
 * @returns Resolves once the account is gone and the session cookie is cleared
 *
 * @remarks
 * Callable while a consent is still outstanding — that is the whole point. It
 * is what "decline" offers instead of a logout that left the data in place.
 *
 * The password is not a formality. A session token is valid for seven days, so
 * without re-authentication a leaked cookie would be enough to destroy an
 * account permanently, and the confirmation dialog in the UI would not be in
 * the attacker's way at all.
 */
export async function deleteAccountRequest(
  password: string,
): Promise<LogoutResponseData> {
  return requestJson<LogoutResponseData, { password: string }>(
    "/api/auth/account",
    { method: "DELETE", body: { password } },
  );
}

/**
 * Ends the current session by clearing the server-side auth cookie.
 *
 * @returns Resolves when the session cookie has been cleared
 */
export async function logoutRequest(): Promise<LogoutResponseData> {
  return requestJson<LogoutResponseData>("/api/auth/logout", {
    method: "POST",
  });
}
