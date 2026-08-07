import { Router } from "express";

import {
  deleteInjuryConstraintsController,
  getAthleteProfileController,
  putAthleteProfileController,
} from "../controllers/athlete-profile-controller.js";
import {
  authMiddleware,
  authMiddlewareAllowingPendingConsents,
} from "../middleware/auth-middleware.js";

/**
 * Sensitive-data withdrawal, in its own router so it can be mounted ahead of
 * every gated router in `app.ts`.
 *
 * @remarks
 * It cannot live in `athleteProfileRouter`, and the reason is an Express
 * subtlety worth stating: several routers are mounted with `app.use("/api",
 * router)` and gate themselves with a path-less `router.use(authMiddleware)`.
 * A path-less `use` runs for *every* request routed into that router, not only
 * the ones it has handlers for — so `/api/athlete-profile/injury-constraints`
 * passes through the assistant router's gate on its way past, and gets a 403
 * before this router is ever consulted.
 *
 * The exemption therefore only holds if this route is reached before any of
 * those routers. Mount order in `app.ts` is load-bearing here, not cosmetic —
 * an HTTP test covers it, because nothing else would notice it breaking.
 */
export const injuryWithdrawalRouter = Router();

injuryWithdrawalRouter.delete(
  "/athlete-profile/injury-constraints",
  authMiddlewareAllowingPendingConsents,
  deleteInjuryConstraintsController,
);

export const athleteProfileRouter = Router();

athleteProfileRouter.use("/athlete-profile", authMiddleware);
athleteProfileRouter.get("/athlete-profile", getAthleteProfileController);
athleteProfileRouter.put("/athlete-profile", putAthleteProfileController);
