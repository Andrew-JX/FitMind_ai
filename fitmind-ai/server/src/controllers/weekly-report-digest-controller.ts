import { timingSafeEqual } from "node:crypto";

import type { Request, Response } from "express";
import { z } from "zod";

import { loadServerEnv } from "../env.js";
import {
  dismissWeeklyReportDigest,
  getLatestWeeklyReportDigest,
  runWeeklyReportDigestCron,
} from "../services/training/weekly-report-digest-service.js";
import { createSuccessResponse } from "../utils/api-response.js";
import { HttpError } from "../utils/http-error.js";

type AuthLocals = {
  userId: string;
};

const digestParamsSchema = z.object({
  id: z.string().uuid(),
});

const dismissDigestBodySchema = z
  .object({
    dismissed: z.literal(true),
  })
  .strict();

/**
 * Run the scheduled weekly report digest generator.
 *
 * @param req - Express request carrying the cron bearer header.
 * @param res - Express response.
 * @returns Cron-safe count response.
 */
export async function postWeeklyReportCronController(
  req: Request,
  res: Response,
) {
  assertCronBearer(req);

  const result = await runWeeklyReportDigestCron();

  return res.status(200).json(createSuccessResponse(result));
}

/**
 * Return the latest undismissed weekly report digest for the authenticated user.
 *
 * @param req - Express request.
 * @param res - Express response with authenticated locals.
 * @returns Latest digest or null.
 */
export async function getWeeklyReportDigestController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  void req;

  const digest = await getLatestWeeklyReportDigest(res.locals.userId);

  return res.status(200).json(createSuccessResponse({ digest }));
}

/**
 * Mark one weekly report digest as dismissed for the authenticated user.
 *
 * @param req - Express request with digest id and dismissed=true body.
 * @param res - Express response with authenticated locals.
 * @returns Dismissed digest id.
 */
export async function patchWeeklyReportDigestController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const params = digestParamsSchema.parse(req.params);

  dismissDigestBodySchema.parse(req.body);

  const digest = await dismissWeeklyReportDigest({
    id: params.id,
    userId: res.locals.userId,
  });

  return res
    .status(200)
    .json(createSuccessResponse({ dismissed: true, id: digest.id }));
}

function assertCronBearer(req: Request): void {
  const expectedSecret = loadServerEnv().weeklyReportCronSecret;
  const headerValue = req.header("authorization");
  const [scheme, token] = headerValue?.split(" ") ?? [];

  if (
    expectedSecret === undefined ||
    scheme !== "Bearer" ||
    token === undefined ||
    !safeSecretEquals(token, expectedSecret)
  ) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid cron credentials.");
  }
}

function safeSecretEquals(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}
