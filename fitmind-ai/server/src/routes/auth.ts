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
import type { AiRateLimiter } from "../services/assistant/ai-rate-limiter.js";

export interface AuthRouterOptions {
  authRateLimiter?: AiRateLimiter;
}

/**
 * Creates the auth router with injectable rate limiter state for tests.
 *
 * @param options - Optional shared auth rate limiter override
 * @returns Express router for `/api/auth`
 */
export function createAuthRouter(options?: AuthRouterOptions) {
  const router = Router();
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

  router.post("/register", registerLimiter, registerController);
  router.post("/login", loginLimiter, loginController);
  router.post("/logout", logoutController);
  router.get("/me", authMiddleware, meController);

  return router;
}

export const authRouter = createAuthRouter();
