import { useEffect, useState } from "react";

import type {
  AuthUserDto,
  LoginRequest,
  RegisterRequest,
} from "../../../../shared/src/auth";

import { HttpClientError } from "../../services/http-client";
import {
  fetchCurrentUser,
  loginWithEmail,
  logoutRequest,
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
}

export interface UseAuthResult extends AuthState {
  bootstrap: () => Promise<void>;
  clearAuth: () => void;
  login: (input: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  setToken: (nextToken: string) => Promise<void>;
}

let activeToken: string | null = null;
let activeUser: AuthUserDto | null = null;
let activeStatus: AuthStatus = "anonymous";
let activeErrorMessage: string | null = null;

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
    bootstrap,
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

    activeUser = response.user;
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
    activeStatus = "authenticated";
    activeErrorMessage = null;
    notify();
  } catch (error) {
    handleAuthFailure(error);
  }
}

function getSnapshot(): AuthState {
  return {
    status: activeStatus,
    token: activeToken,
    user: activeUser,
    errorMessage: activeErrorMessage,
  };
}

function notify(): void {
  const snapshot = getSnapshot();

  for (const listener of listeners) {
    listener(snapshot);
  }
}

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    if (
      error.status === 409 ||
      error.message === "An account with this email already exists."
    ) {
      return "这个邮箱已经注册过了，请直接登录或更换邮箱。";
    }

    if (error.message === "Invalid email or password.") {
      return "邮箱或密码不正确。";
    }

    return error.message;
  }

  return "Authentication could not be verified.";
}

function handleAuthFailure(error: unknown): void {
  activeToken = null;
  activeUser = null;
  activeStatus = "error";
  activeErrorMessage = getReadableErrorMessage(error);
  notify();
}
