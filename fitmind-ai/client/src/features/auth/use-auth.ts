import { useEffect, useState } from "react";

import type {
  AuthUserDto,
  LoginRequest,
  RegisterRequest,
} from "../../../../shared/src/auth";
import type { PendingConsentDto } from "../../../../shared/src/consent";

import { getReadableAuthErrorMessage } from "./auth-error-message";
import {
  deleteAccountRequest,
  fetchCurrentUser,
  loginWithEmail,
  logoutRequest,
  recordConsent,
  registerWithEmail,
} from "./auth-api";

export type AuthStatus =
  | "anonymous"
  | "authenticating"
  | "authenticated"
  | "error";

export interface AuthState {
  status: AuthStatus;
  token: string | null;
  user: AuthUserDto | null;
  errorMessage: string | null;
  /**
   * Consents the signed-in account still owes. Non-empty only for accounts
   * created before the consent seam existed; the app blocks on it rather than
   * letting them keep using a service they never agreed to the terms of.
   */
  pendingConsents: PendingConsentDto[];
}

export interface UseAuthResult extends AuthState {
  acceptPendingConsent: (consent: PendingConsentDto) => Promise<void>;
  bootstrap: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  clearAuth: () => void;
  login: (input: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  setToken: (nextToken: string) => Promise<void>;
}

/**
 * Opaque marker stored in `token` when the session is restored from the
 * HttpOnly cookie (whose JWT is not readable by JS).
 *
 * @remarks
 * Requests authenticate via the cookie (`credentials: "include"`), so the
 * in-memory token is now only a truthy "authenticated" gate for data hooks.
 * This sentinel is sent as a harmless bearer that the server ignores in favor
 * of the cookie, and it is never decoded on the client.
 */
export const COOKIE_SESSION_TOKEN = "cookie-session";

let activeToken: string | null = null;
let activeUser: AuthUserDto | null = null;
let activeStatus: AuthStatus = "anonymous";
let activeErrorMessage: string | null = null;
let activePendingConsents: PendingConsentDto[] = [];

const listeners = new Set<(state: AuthState) => void>();

/**
 * Exposes the client-side auth session backed by an HttpOnly cookie.
 *
 * @returns Auth state plus helpers for bootstrapping, logging in/out, and validating the session
 *
 * @remarks
 * The auth credential lives in an HttpOnly cookie the browser sends automatically,
 * so the session survives reloads. The in-memory token is retained only as a
 * transient convenience for the current tab.
 */
export function useAuth(): UseAuthResult {
  const [state, setState] = useState<AuthState>(getSnapshot);

  useEffect(() => {
    listeners.add(setState);

    return () => {
      listeners.delete(setState);
    };
  }, []);

  return {
    ...state,
    acceptPendingConsent,
    bootstrap,
    deleteAccount,
    clearAuth,
    login,
    logout,
    refreshAuth,
    register,
    setToken,
  };
}

/**
 * Restores an existing session from the HttpOnly cookie on app load.
 *
 * @returns Resolves after `/api/auth/me` confirms or denies an active session
 *
 * @remarks
 * A missing or invalid cookie is the normal first-visit case and resolves to
 * the anonymous state without surfacing an error.
 */
export async function bootstrap(): Promise<void> {
  activeStatus = "authenticating";
  activeErrorMessage = null;
  notify();

  try {
    const response = await fetchCurrentUser();

    // The real JWT lives in the HttpOnly cookie; store a sentinel so data hooks
    // that gate on a truthy token still load while the cookie carries auth.
    activeToken = COOKIE_SESSION_TOKEN;
    activeUser = response.user;
    activePendingConsents = readPendingConsents(response);
    activeStatus = "authenticated";
    activeErrorMessage = null;
    notify();
  } catch {
    activeToken = null;
    activeUser = null;
    activeStatus = "anonymous";
    activeErrorMessage = null;
    notify();
  }
}

/**
 * Ends the session by clearing the server cookie and local auth state.
 *
 * @returns Resolves after the logout request settles and local state is cleared
 */
export async function logout(): Promise<void> {
  try {
    await logoutRequest();
  } catch {
    // Clear local state even if the network logout call fails.
  }

  clearAuth();
}

/**
 * Stores a token in memory and validates it against `/api/auth/me`.
 *
 * @param nextToken - JWT returned by the FitMind API
 * @returns Resolves when validation finishes
 */
export async function setToken(nextToken: string): Promise<void> {
  activeToken = nextToken;
  activeStatus = "authenticating";
  activeErrorMessage = null;
  notify();

  await refreshAuth();
}

/**
 * Clears the in-memory auth session.
 *
 * @returns nothing
 */
export function clearAuth(): void {
  activeToken = null;
  activeUser = null;
  activePendingConsents = [];
  activeStatus = "anonymous";
  activeErrorMessage = null;
  notify();
}

/**
 * Registers a new user and stores the returned token in memory.
 *
 * @param input - Register form payload
 * @returns Resolves when the new session is active
 */
export async function register(input: RegisterRequest): Promise<void> {
  activeStatus = "authenticating";
  activeErrorMessage = null;
  notify();

  try {
    const response = await registerWithEmail(input);
    activeToken = response.token;
    activeUser = response.user;
    activePendingConsents = readPendingConsents(response);
    activeStatus = "authenticated";
    activeErrorMessage = null;
    notify();
  } catch (error) {
    handleAuthFailure(error);
  }
}

/**
 * Logs an existing user in and stores the returned token in memory.
 *
 * @param input - Login form payload
 * @returns Resolves when the new session is active
 */
export async function login(input: LoginRequest): Promise<void> {
  activeStatus = "authenticating";
  activeErrorMessage = null;
  notify();

  try {
    const response = await loginWithEmail(input);
    activeToken = response.token;
    activeUser = response.user;
    activePendingConsents = readPendingConsents(response);
    activeStatus = "authenticated";
    activeErrorMessage = null;
    notify();
  } catch (error) {
    handleAuthFailure(error);
  }
}

/**
 * Re-validates the current in-memory token by calling `/api/auth/me`.
 *
 * @returns Resolves after the current token has been accepted or rejected
 */
export async function refreshAuth(): Promise<void> {
  if (!activeToken) {
    clearAuth();
    return;
  }

  activeStatus = "authenticating";
  activeErrorMessage = null;
  notify();

  try {
    const response = await fetchCurrentUser(activeToken);

    activeUser = response.user;
    activePendingConsents = readPendingConsents(response);
    activeStatus = "authenticated";
    activeErrorMessage = null;
    notify();
  } catch (error) {
    handleAuthFailure(error);
  }
}

/**
 * Deletes the signed-in account and returns the app to the anonymous state.
 *
 * @returns Resolves once the server confirms deletion
 *
 * @remarks
 * Local state is cleared only after the request succeeds. Clearing first would
 * show the login screen whether or not anything was actually deleted, which is
 * the exact class of lie this batch has been unwinding.
 */
export async function deleteAccount(password: string): Promise<void> {
  await deleteAccountRequest(password);
  clearAuth();
}

/**
 * Records one outstanding consent for the signed-in user.
 *
 * @param consent - The pending consent the user just agreed to
 * @returns Resolves once the server has stored it and local state is updated
 *
 * @remarks
 * Only ever called from an explicit user action. There is no code path that
 * records a consent the user did not perform, which is why accounts predating
 * this seam are asked rather than backfilled.
 *
 * The version submitted is the one the server said was outstanding, so a stale
 * tab cannot record agreement to superseded wording — and if it somehow does,
 * the server rejects it.
 */
export async function acceptPendingConsent(
  consent: PendingConsentDto,
): Promise<void> {
  await recordConsent({
    consent_type: consent.consent_type,
    accepted: true,
    policy_version: consent.policy_version,
  });

  activePendingConsents = activePendingConsents.filter(
    (pending) => pending.consent_type !== consent.consent_type,
  );
  notify();
}

/**
 * Reads `pending_consents` from an auth response, tolerating its absence.
 *
 * @param response - An auth or session response from the API
 * @returns The outstanding consents, or an empty list when the field is missing
 *
 * @remarks
 * Defaulting to empty rather than crashing is safe because the server refuses
 * independently: an account that owes a consent gets `403 CONSENT_REQUIRED`
 * from every business endpoint, whatever this client believes. Missing the
 * prompt therefore degrades into a visibly broken app rather than into silent
 * unconsented processing.
 *
 * An earlier version of this comment claimed the server enforced this while no
 * such gate existed — the block was only in `App.tsx`. Keep the two in step: if
 * `createAuthMiddleware`'s gate is ever removed, this default becomes a hole.
 */
function readPendingConsents(response: {
  pending_consents?: PendingConsentDto[] | undefined;
}): PendingConsentDto[] {
  return response.pending_consents ?? [];
}

/**
 * Drops one consent from the local outstanding list.
 *
 * @param consentType - The consent that no longer applies
 *
 * @remarks
 * Used after withdrawing the sensitive data, where the debt disappears because
 * its subject is gone rather than because it was settled.
 *
 * Deliberately not a `refreshAuth()`. That call cannot fail loudly — it
 * swallows errors into `handleAuthFailure`, which clears the session — so a
 * momentary `/me` failure right after a successful withdrawal would log the
 * user out and show an authentication error, immediately after they exercised
 * a privacy right. The server re-checks on the very next request anyway, so
 * there is nothing to gain by asking it again here.
 */
export function clearPendingConsent(consentType: string): void {
  activePendingConsents = activePendingConsents.filter(
    (pending) => pending.consent_type !== consentType,
  );
  notify();
}

function getSnapshot(): AuthState {
  return {
    status: activeStatus,
    token: activeToken,
    user: activeUser,
    errorMessage: activeErrorMessage,
    pendingConsents: activePendingConsents,
  };
}

function notify(): void {
  const snapshot = getSnapshot();

  for (const listener of listeners) {
    listener(snapshot);
  }
}

function handleAuthFailure(error: unknown): void {
  activeToken = null;
  activeUser = null;
  activeStatus = "error";
  activeErrorMessage = getReadableAuthErrorMessage(error);
  notify();
}
