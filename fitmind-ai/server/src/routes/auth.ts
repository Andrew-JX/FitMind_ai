import { Router } from "express";

import {
  deleteAccountController,
  loginController,
  logoutController,
  meController,
  recordConsentController,
  registerController,
  registrationPolicyController,
} from "../controllers/auth-controller.js";
import {
  accountDeletionRateLimitMiddleware,
  createAuthRateLimitMiddleware,
  loginRateLimitMiddleware,
  registerRateLimitMiddleware,
} from "../middleware/auth-rate-limit-middleware.js";
import { authMiddlewareAllowingPendingConsents } from "../middleware/auth-middleware.js";
import {
  createRegistrationGateMiddleware,
  registrationGateMiddleware,
} from "../middleware/registration-gate-middleware.js";
import type { AiRateLimiter } from "../services/assistant/ai-rate-limiter.js";

export interface AuthRouterOptions {
  authRateLimiter?: AiRateLimiter;
  /** Overrides the env-derived registration mode; used by tests. */
  registrationInviteOnly?: boolean | undefined;
}

/**
 * Creates the auth router with injectable rate limiter state for tests.
 *
 * @param options - Optional shared auth rate limiter and registration mode overrides
 * @returns Express router for `/api/auth`
 */
export function createAuthRouter(options?: AuthRouterOptions) {
  const router = Router();
  const registrationGate =
    options?.registrationInviteOnly === undefined
      ? registrationGateMiddleware
      : createRegistrationGateMiddleware({
          inviteOnly: options.registrationInviteOnly,
        });
  const registerLimiter =
    options?.authRateLimiter === undefined
      ? registerRateLimitMiddleware
      : createAuthRateLimitMiddleware({
          route: "register",
          limiter: options.authRateLimiter,
        });
  const loginLimiter =
    options?.authRateLimiter === undefined
      ? loginRateLimitMiddleware
      : createAuthRateLimitMiddleware({
          route: "login",
          limiter: options.authRateLimiter,
        });
  const deletionLimiter =
    options?.authRateLimiter === undefined
      ? accountDeletionRateLimitMiddleware
      : createAuthRateLimitMiddleware({
          route: "account-deletion",
          limiter: options.authRateLimiter,
        });

  // Unauthenticated: the client reads this before it has an account, so that a
  // closed instance renders as closed instead of collecting a form and
  // rejecting it afterwards.
  router.get("/registration-policy", registrationPolicyController);

  // The gate runs before the limiter so blocked sign-ups never consume budget.
  router.post(
    "/register",
    registrationGate,
    registerLimiter,
    registerController,
  );
  router.post("/login", loginLimiter, loginController);
  router.post("/logout", logoutController);
  // These two are exempt from the consent gate on purpose: they are how an
  // account that owes a consent finds out what it owes and settles it. Gating
  // them would leave the user unable to proceed and unable to learn why.
  router.get("/me", authMiddlewareAllowingPendingConsents, meController);
  router.post(
    "/consents",
    authMiddlewareAllowingPendingConsents,
    recordConsentController,
  );
  // Also exempt: someone who declines the consent must be able to leave with
  // their data, and that is the one action the gate must never stand in front
  // of. Refusing and then being told you cannot delete would be worse than not
  // offering the choice.
  //
  // Rate-limited despite already being authenticated: the password check here
  // is a second factor against a leaked session, and an unlimited second factor
  // is not one. Each attempt also costs a deliberately slow bcrypt comparison.
  router.delete(
    "/account",
    authMiddlewareAllowingPendingConsents,
    deletionLimiter,
    deleteAccountController,
  );

  return router;
}

export const authRouter = createAuthRouter();
