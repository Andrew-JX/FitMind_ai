import type { Request, Response } from "express";

import {
  AssistantTurnError,
  runMockAssistantTurn,
} from "../services/assistant/assistant-orchestrator-service.js";
import type { AssistantTurnExecutionResult } from "../services/assistant/assistant-orchestrator-service.js";
import type { AssistantStreamEvent } from "../services/assistant/assistant-stream-types.js";
import type { AssistantIpRateLimitLocals } from "../middleware/assistant-ip-rate-limit-middleware.js";
import {
  logAssistantTurnEvent,
  logFailedAssistantTurnEvent,
} from "../services/assistant/assistant-turn-observability.js";
import { createSuccessResponse } from "../utils/api-response.js";
import { isHttpError } from "../utils/http-error.js";

function logTurnTelemetry(
  result: AssistantTurnExecutionResult,
  durationMs: number,
): void {
  const { response, telemetry } = result;

  logAssistantTurnEvent({
    intent: response.intent,
    durationMs,
    toolCalls: response.tool_calls,
    agentStepCount: response.agent_trace?.steps.length ?? null,
    faithfulness: response.faithfulness ?? null,
    hasPlan: response.plan !== undefined,
    llm: telemetry.llm ?? null,
    providerErrorFallback: telemetry.providerErrorFallback ?? null,
    budgetFallback: telemetry.budgetFallback ?? null,
    safety: telemetry.safety ?? null,
  });
}

function writeSseEvent(
  res: Response<unknown, AssistantIpRateLimitLocals>,
  event: AssistantStreamEvent,
): void {
  if (res.writableEnded || res.destroyed) {
    return;
  }

  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function logFailedTurn(error: unknown, durationMs: number): void {
  logFailedAssistantTurnEvent({
    durationMs,
    errorCode: normalizeStreamError(error).code,
    llm: error instanceof AssistantTurnError ? error.turnTelemetry.llm : null,
  });
}

function normalizeStreamError(error: unknown): {
  code: string;
  message: string;
} {
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
  res: Response<unknown, AssistantIpRateLimitLocals>,
) {
  const startedAt = Date.now();
  try {
    const result = await runMockAssistantTurn(res.locals.userId, req.body, {
      assistantIpGuardDecision: res.locals.assistantIpGuardDecision,
    });
    logTurnTelemetry(result, Date.now() - startedAt);

    return res.status(200).json(createSuccessResponse(result.response));
  } catch (error) {
    logFailedTurn(error, Date.now() - startedAt);
    throw error;
  }
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
  res: Response<unknown, AssistantIpRateLimitLocals>,
) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let errorEventSent = false;
  const startedAt = Date.now();

  try {
    const result = await runMockAssistantTurn(res.locals.userId, req.body, {
      assistantIpGuardDecision: res.locals.assistantIpGuardDecision,
      onEvent: async (event) => {
        if (event.type === "error") {
          errorEventSent = true;
        }

        writeSseEvent(res, event);
      },
    });
    logTurnTelemetry(result, Date.now() - startedAt);

    if (!res.writableEnded && !res.destroyed) {
      res.end();
    }
  } catch (error) {
    logFailedTurn(error, Date.now() - startedAt);

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
