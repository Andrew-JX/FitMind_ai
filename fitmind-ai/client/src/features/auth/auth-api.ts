import type {
  AuthSuccessData,
  LoginRequest,
  LogoutResponseData,
  MeResponseData,
  RegisterRequest,
} from "../../../../shared/src/auth";

import { requestJson } from "../../services/http-client";

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
 * Ends the current session by clearing the server-side auth cookie.
 *
 * @returns Resolves when the session cookie has been cleared
 */
export async function logoutRequest(): Promise<LogoutResponseData> {
  return requestJson<LogoutResponseData>("/api/auth/logout", {
    method: "POST",
  });
}
