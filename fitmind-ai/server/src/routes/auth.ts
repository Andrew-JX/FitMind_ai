import { Router } from "express";

import {
  loginController,
  logoutController,
  meController,
  registerController,
} from "../controllers/auth-controller.js";
import {
  createAuthRateLimitMiddleware,
  loginRateLimitMiddleware,
  registerRateLimitMiddleware,
} from "../middleware/auth-rate-limit-middleware.js";
import { authMiddleware } from "../middleware/auth-middleware.js";
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

  // The gate runs before the limiter so blocked sign-ups never consume budget.
  router.post(
    "/register",
    registrationGate,
    registerLimiter,
    registerController,
  );
  router.post("/login", loginLimiter, loginController);
  router.post("/logout", logoutController);
  router.get("/me", authMiddleware, meController);

  return router;
}

export const authRouter = createAuthRouter();
