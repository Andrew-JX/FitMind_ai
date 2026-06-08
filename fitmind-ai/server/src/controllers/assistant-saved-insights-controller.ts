import type { Request, Response } from "express";
import { z } from "zod";

import {
  deleteAssistantSavedInsight,
  getAssistantSavedInsight,
  listAssistantSavedInsights,
  saveAssistantInsightFromMessage,
} from "../services/assistant/assistant-saved-insights-service.js";
import { createSuccessResponse } from "../utils/api-response.js";

type AuthLocals = {
  userId: string;
};

const saveAssistantInsightBodySchema = z
  .object({
    message_id: z.string().uuid(),
  })
  .strict();

const assistantInsightParamsSchema = z.object({
  id: z.string().uuid(),
});

export async function postAssistantSavedInsightController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const body = saveAssistantInsightBodySchema.parse(req.body);
  const result = await saveAssistantInsightFromMessage({
    messageId: body.message_id,
    userId: res.locals.userId,
  });

  return res.status(201).json(createSuccessResponse(result));
}

export async function listAssistantSavedInsightsController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const result = await listAssistantSavedInsights(res.locals.userId);

  return res.status(200).json(createSuccessResponse({ items: result }));
}

export async function getAssistantSavedInsightController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const params = assistantInsightParamsSchema.parse(req.params);
  const result = await getAssistantSavedInsight({
    id: params.id,
    userId: res.locals.userId,
  });

  return res.status(200).json(createSuccessResponse(result));
}

export async function deleteAssistantSavedInsightController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const params = assistantInsightParamsSchema.parse(req.params);
  const result = await deleteAssistantSavedInsight({
    id: params.id,
    userId: res.locals.userId,
  });

  return res.status(200).json(createSuccessResponse(result));
}
