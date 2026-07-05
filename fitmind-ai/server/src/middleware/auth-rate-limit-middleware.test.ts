import express from "express";
import { afterAll, describe, expect, it } from "vitest";

import { createAiRateLimiter } from "../services/assistant/ai-rate-limiter.js";
import { createErrorResponse } from "../utils/api-response.js";
import { isHttpError } from "../utils/http-error.js";
import { createAuthRateLimitMiddleware } from "./auth-rate-limit-middleware.js";

function createTestServer(now: () => number) {
  const app = express();
  const limiter = createAiRateLimiter({
    perMinute: 1,
    perDay: 100,
    now,
  });

  app.set("trust proxy", 1);
  app.post(
    "/api/auth/login",
    createAuthRateLimitMiddleware({ route: "login", limiter }),
    (_req, res) => {
      res.json({ ok: true });
    },
  );
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      void _next;

      if (isHttpError(error)) {
        return res
          .status(error.statusCode)
          .json(createErrorResponse(error.toApiError()));
      }

      return res.status(500).json(
        createErrorResponse({
          code: "INTERNAL_ERROR",
          message: "Internal server error.",
        }),
      );
    },
  );

  const server = app.listen(0);

  return {
    close: () => server.close(),
    request: async () => {
      const address = server.address();

      if (address === null || typeof address === "string") {
        throw new Error("Expected the test server to bind to a TCP port");
      }

      return fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
        method: "POST",
      });
    },
  };
}

describe("createAuthRateLimitMiddleware", () => {
  const servers: Array<{ close: () => void }> = [];

  afterAll(() => {
    for (const server of servers) {
      server.close();
    }
  });

  it("allows requests within the configured auth route limit", async () => {
    const server = createTestServer(() => 0);
    servers.push(server);

    const response = await server.request();

    expect(response.status).toBe(200);
  });

  it("rejects excess auth requests with retry details", async () => {
    const server = createTestServer(() => 0);
    servers.push(server);

    await server.request();
    const response = await server.request();
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload).toEqual({
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: "Rate limited.",
        details: {
          retry_after_seconds: 60,
        },
      },
    });
  });

  it("allows requests again after the one-minute window resets", async () => {
    let now = 0;
    const server = createTestServer(() => now);
    servers.push(server);

    await server.request();
    const blocked = await server.request();
    now = 60_000;
    const reset = await server.request();

    expect(blocked.status).toBe(429);
    expect(reset.status).toBe(200);
  });
});
