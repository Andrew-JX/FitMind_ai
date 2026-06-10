import type { Request, Response } from "express";
import { z } from "zod";

import { submitProductFeedback } from "../services/product-feedback-service.js";
import { createSuccessResponse } from "../utils/api-response.js";

type AuthLocals = {
  userId: string;
};

const feedbackBodySchema = z
  .object({
    message: z.string().max(2000).optional(),
    rating: z.number().int().min(1).max(5).optional(),
    sourceRoute: z.string().max(300).optional(),
  })
  .strict();

export async function postProductFeedbackController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const body = feedbackBodySchema.parse(req.body);
  const feedback = await submitProductFeedback({
    message: body.message,
    rating: body.rating,
    sourceRoute: body.sourceRoute,
    userAgent: req.header("user-agent"),
    userId: res.locals.userId,
  });

  return res.status(201).json(createSuccessResponse({ feedback }));
}
