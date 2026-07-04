import type { CookieOptions, Request, Response } from "express";

import { loadServerEnv } from "../env.js";

/** Name of the HttpOnly session cookie that carries the auth JWT. */
export const AUTH_COOKIE_NAME = "fitmind_token";

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Build the shared cookie options used for setting and clearing the auth cookie.
 *
 * @returns Cookie options with HttpOnly, SameSite=Lax, and prod-gated Secure flag.
 *
 * @remarks
 * `secure` is only enabled in production so local HTTP development still works.
 * `sameSite: "lax"` blocks the cookie on cross-site POST/fetch, which mitigates
 * CSRF for this same-origin deployment.
 */
function buildCookieOptions(): CookieOptions {
  const env = loadServerEnv();

  return {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
  };
}

/**
 * Write the auth JWT into an HttpOnly session cookie on the response.
 *
 * @param res - Express response.
 * @param token - Signed JWT to persist in the cookie.
 */
export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...buildCookieOptions(),
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

/**
 * Clear the auth session cookie on the response.
 *
 * @param res - Express response.
 */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, buildCookieOptions());
}

/**
 * Read the auth JWT from the request `Cookie` header without external parsers.
 *
 * @param req - Express request.
 * @returns The cookie token value, or undefined when not present.
 */
export function readAuthCookie(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie;

  if (cookieHeader === undefined) {
    return undefined;
  }

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const name = part.slice(0, separatorIndex).trim();

    if (name !== AUTH_COOKIE_NAME) {
      continue;
    }

    const rawValue = part.slice(separatorIndex + 1).trim();

    if (rawValue.length === 0) {
      return undefined;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch (error) {
      if (error instanceof URIError) {
        return undefined;
      }

      throw error;
    }
  }

  return undefined;
}
