import type {
  AuthSuccessData,
  LoginRequest,
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
export async function loginWithEmail(input: LoginRequest): Promise<AuthSuccessData> {
  return requestJson<AuthSuccessData, LoginRequest>("/api/auth/login", {
    method: "POST",
    body: input,
  });
}

/**
 * Fetches the current authenticated user for the supplied token.
 *
 * @param token - JWT returned by the FitMind auth API
 * @returns The current authenticated user
 */
export async function fetchCurrentUser(token: string): Promise<MeResponseData> {
  return requestJson<MeResponseData>("/api/auth/me", {
    token,
  });
}
