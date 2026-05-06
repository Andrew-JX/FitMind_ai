import type { Request, Response } from "express";

import { runMockAssistantTurn } from "../services/assistant/assistant-orchestrator-service.js";
import type { AssistantStreamEvent } from "../services/assistant/assistant-stream-types.js";
import { createSuccessResponse } from "../utils/api-response.js";
import { isHttpError } from "../utils/http-error.js";

type AuthLocals = {
  userId: string;
};

function writeSseEvent(
  res: Response<unknown, AuthLocals>,
  event: AssistantStreamEvent,
): void {
  if (res.writableEnded || res.destroyed) {
    return;
  }

  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function normalizeStreamError(error: unknown): { code: string; message: string } {
  if (isHttpError(error)) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      code: "INTERNAL_ERROR",
      message: error.message,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "Internal server error.",
  };
}

/**
 * Execute one deterministic mock assistant turn for the authenticated user.
 *
 * @param req - Express request with mock assistant turn body.
 * @param res - Express response with authenticated locals.
 * @returns JSON deterministic mock assistant response.
 */
export async function postMockAssistantTurnController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  const result = await runMockAssistantTurn(res.locals.userId, req.body);

  return res.status(200).json(createSuccessResponse(result));
}

/**
 * Stream one deterministic assistant turn over SSE for the authenticated user.
 *
 * @param req - Express request with stream-turn body.
 * @param res - Express response with authenticated locals.
 * @returns SSE event stream that ends with done or error.
 */
export async function postAssistantStreamTurnController(
  req: Request,
  res: Response<unknown, AuthLocals>,
) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let errorEventSent = false;

  try {
    await runMockAssistantTurn(res.locals.userId, req.body, {
      onEvent: async (event) => {
        if (event.type === "error") {
          errorEventSent = true;
        }

        writeSseEvent(res, event);
      },
    });

    if (!res.writableEnded && !res.destroyed) {
      res.end();
    }
  } catch (error) {
    if (!errorEventSent) {
      writeSseEvent(res, {
        type: "error",
        ...normalizeStreamError(error),
      });
    }

    if (!res.writableEnded && !res.destroyed) {
      res.end();
    }
  }
}
