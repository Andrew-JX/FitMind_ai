import type { NextFunction, Request, Response } from "express";

import { loadServerEnv } from "../env.js";
import { HttpError } from "../utils/http-error.js";

export interface RegistrationGateMiddlewareOptions {
  /**
   * Explicit invite-only override. Tests and callers that already know the mode
   * inject it here instead of mutating `process.env`.
   */
  inviteOnly?: boolean | undefined;
}

/** Client-facing message for a closed registration endpoint. */
const REGISTRATION_CLOSED_MESSAGE = "Registration is invite-only.";

/**
 * Builds middleware that blocks self-service registration in invite-only mode.
 *
 * @param options - Optional explicit invite-only override
 * @returns Express middleware that throws `403 REGISTRATION_CLOSED` when closed
 *
 * @remarks
 * The env-derived mode is read per request rather than captured at construction
 * so that the deployed process never serves a stale registration policy. This
 * is a compliance control, not a hot path: it only guards `POST
 * /api/auth/register`, which is already IP rate-limited to 5 requests/minute.
 *
 * `REGISTRATION_INVITE_ONLY` is fail-safe closed (unset, blank, and typos all
 * keep registration closed); see `docs/china-launch-plan.md` §3.2a for why the
 * default points that way.
 */
export function createRegistrationGateMiddleware(
  options?: RegistrationGateMiddlewareOptions,
) {
  return function registrationGate(
    _req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    const inviteOnly =
      options?.inviteOnly ?? loadServerEnv().registrationInviteOnly;

    if (!inviteOnly) {
      next();
      return;
    }

    throw new HttpError(
      403,
      "REGISTRATION_CLOSED",
      REGISTRATION_CLOSED_MESSAGE,
    );
  };
}

/** Process-wide default registration gate reading `REGISTRATION_INVITE_ONLY`. */
export const registrationGateMiddleware = createRegistrationGateMiddleware();
