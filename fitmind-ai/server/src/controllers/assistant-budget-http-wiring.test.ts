import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AssistantIpRateLimitLocals } from "../middleware/assistant-ip-rate-limit-middleware.js";
import type { AssistantTurnExecutionResult } from "../services/assistant/assistant-orchestrator-service.js";

const { runTurn, logTurn, logFailedTurn } = vi.hoisted(() => ({
  runTurn: vi.fn(),
  logTurn: vi.fn(),
  logFailedTurn: vi.fn(),
}));

vi.mock("../services/assistant/assistant-orchestrator-service.js", () => ({
  AssistantTurnError: class AssistantTurnError extends Error {},
  runMockAssistantTurn: runTurn,
}));

vi.mock("../services/assistant/assistant-turn-observability.js", () => ({
  logAssistantTurnEvent: logTurn,
  logFailedAssistantTurnEvent: logFailedTurn,
}));

import {
  postAssistantStreamTurnController,
  postMockAssistantTurnController,
} from "./assistant-stream-controller.js";
import { assistantRouter } from "../routes/assistant.js";

const ipFallbackDecision = {
  kind: "fallback" as const,
  fallback_provider: "mock" as const,
  telemetry: {
    budget_fallback: true as const,
    budget_reason: "per_ip_daily_limit_exceeded" as const,
    budget_scope: "ip" as const,
    budget_ip_minute_count: 3,
    budget_ip_minute_limit: 10,
    budget_ip_day_count: 30,
    budget_ip_day_limit: 30,
    budget_retry_after_seconds: 60,
  },
};

const turnResult: AssistantTurnExecutionResult = {
  response: {
    session_id: "session-1",
    message_id: "message-1",
    mode: "weekly_report",
    assistant_type: "deterministic_mock",
    intent: "weekly_report",
    tool_calls: [],
    answer: {
      summary: "Deterministic fallback answer.",
      bullets: [],
      conclusion: "Completed safely.",
      recommendation: "Review the report.",
      evidence: {
        source: "deterministic_mock_provider",
        tool_names: [],
        workout_ids: [],
        set_ids: [],
        calculation_rules: [],
      },
      sources: [],
      intent: "weekly_report",
      limitations: [],
    },
  },
  telemetry: {
    budgetFallback: ipFallbackDecision.telemetry,
  },
};

interface RouterLayerView {
  name: string;
  route?: {
    path: string;
    stack: Array<{ handle: { name: string } }>;
  };
}

function routeHandlerNames(path: string): string[] {
  const layers = (assistantRouter as unknown as { stack: RouterLayerView[] })
    .stack;
  const route = layers.find((layer) => layer.route?.path === path)?.route;

  return route?.stack.map((layer) => layer.handle.name) ?? [];
}

function createJsonResponse() {
  const response = {
    locals: {
      userId: "user-1",
      assistantIpGuardDecision: ipFallbackDecision,
    },
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);

  return response;
}

function createSseResponse() {
  const writes: string[] = [];
  const response = {
    locals: {
      userId: "user-1",
      assistantIpGuardDecision: ipFallbackDecision,
    },
    writableEnded: false,
    destroyed: false,
    status: vi.fn(),
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => {
      writes.push(chunk);
      return true;
    }),
    end: vi.fn(() => {
      response.writableEnded = true;
    }),
  };
  response.status.mockReturnValue(response);

  return { response, writes };
}

describe("assistant HTTP budget wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runTurn.mockImplementation(async (_userId, _body, options) => {
      await options?.onEvent?.({
        type: "done",
        message_id: "message-1",
        session_id: "session-1",
      });
      return turnResult;
    });
  });

  it("mounts auth globally and per-user then per-IP only on both turn routes", () => {
    const layers = (assistantRouter as unknown as { stack: RouterLayerView[] })
      .stack;

    // Names the gated variant specifically: this asserts the assistant routes
    // sit behind the consent gate, not merely behind some auth middleware.
    expect(layers[0]?.name).toBe("authenticateWithConsentGate");
    expect(routeHandlerNames("/assistant/mock-turn")).toEqual([
      "aiRateLimit",
      "assistantIpRateLimit",
      "postMockAssistantTurnController",
    ]);
    expect(routeHandlerNames("/assistant/stream-turn")).toEqual([
      "aiRateLimit",
      "assistantIpRateLimit",
      "postAssistantStreamTurnController",
    ]);
    const insightHandlers = layers
      .filter((layer) => layer.route?.path.startsWith("/assistant/insights"))
      .flatMap(
        (layer) => layer.route?.stack.map((item) => item.handle.name) ?? [],
      );
    expect(insightHandlers).not.toContain("assistantIpRateLimit");
    expect(insightHandlers).not.toContain("aiRateLimit");
  });

  it("passes the IP decision through the JSON path and still returns 200", async () => {
    const response = createJsonResponse();

    await postMockAssistantTurnController(
      { body: { mode: "weekly_report" } } as Request,
      response as unknown as Response<unknown, AssistantIpRateLimitLocals>,
    );

    expect(runTurn).toHaveBeenCalledWith(
      "user-1",
      { mode: "weekly_report" },
      { assistantIpGuardDecision: ipFallbackDecision },
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.status).not.toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith({
      ok: true,
      data: turnResult.response,
    });
    expect(logFailedTurn).not.toHaveBeenCalled();
  });

  it("passes the IP decision through SSE and completes with done, not error", async () => {
    const { response, writes } = createSseResponse();

    await postAssistantStreamTurnController(
      { body: { mode: "weekly_report" } } as Request,
      response as unknown as Response<unknown, AssistantIpRateLimitLocals>,
    );

    expect(runTurn).toHaveBeenCalledTimes(1);
    const options = runTurn.mock.calls[0]?.[2];
    expect(options.assistantIpGuardDecision).toEqual(ipFallbackDecision);
    expect(options.onEvent).toEqual(expect.any(Function));
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.status).not.toHaveBeenCalledWith(429);
    expect(writes.join("")).toContain("event: done");
    expect(writes.join("")).not.toContain("event: error");
    expect(response.end).toHaveBeenCalledTimes(1);
    expect(logFailedTurn).not.toHaveBeenCalled();
  });

  // A proxy that buffers turns the stream into one late blob, which reads as
  // "the assistant is slow" rather than as a misconfiguration.
  it("tells the reverse proxy not to buffer the stream", async () => {
    const { response } = createSseResponse();

    await postAssistantStreamTurnController(
      { body: { mode: "weekly_report" } } as Request,
      response as unknown as Response<unknown, AssistantIpRateLimitLocals>,
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "text/event-stream",
    );
    expect(response.setHeader).toHaveBeenCalledWith("X-Accel-Buffering", "no");
  });

  it("passes budget telemetry to the turn logger without replacing provider fallback", async () => {
    const response = createJsonResponse();

    await postMockAssistantTurnController(
      { body: {} } as Request,
      response as unknown as Response<unknown, AssistantIpRateLimitLocals>,
    );

    expect(logTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        budgetFallback: ipFallbackDecision.telemetry,
        providerErrorFallback: null,
      }),
    );
  });
});
