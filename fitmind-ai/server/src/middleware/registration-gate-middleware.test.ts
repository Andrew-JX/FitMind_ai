import express from "express";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { createAiRateLimiter } from "../services/assistant/ai-rate-limiter.js";
import { createAuthRateLimitMiddleware } from "./auth-rate-limit-middleware.js";
import { createErrorResponse } from "../utils/api-response.js";
import { isHttpError } from "../utils/http-error.js";
import { createRegistrationGateMiddleware } from "./registration-gate-middleware.js";

interface TestServerOptions {
  inviteOnly?: boolean | undefined;
  /** Mount the auth rate limiter after the gate, mirroring the real router. */
  withRateLimiter?: boolean | undefined;
}

function createTestServer(options?: TestServerOptions) {
  const app = express();
  const handlers: express.RequestHandler[] = [
    createRegistrationGateMiddleware({ inviteOnly: options?.inviteOnly }),
  ];

  if (options?.withRateLimiter === true) {
    handlers.push(
      createAuthRateLimitMiddleware({
        route: "register",
        limiter: createAiRateLimiter({
          perMinute: 1,
          perDay: 100,
          now: () => 0,
        }),
      }),
    );
  }

  app.set("trust proxy", 1);
  app.post("/api/auth/register", ...handlers, (_req, res) => {
    res.status(201).json({ ok: true });
  });
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

      return fetch(`http://127.0.0.1:${address.port}/api/auth/register`, {
        method: "POST",
      });
    },
  };
}

describe("createRegistrationGateMiddleware", () => {
  const servers: Array<{ close: () => void }> = [];
  const originalInviteOnly = process.env.REGISTRATION_INVITE_ONLY;

  function startServer(options?: TestServerOptions) {
    const server = createTestServer(options);
    servers.push(server);

    return server;
  }

  afterEach(() => {
    if (originalInviteOnly === undefined) {
      delete process.env.REGISTRATION_INVITE_ONLY;
      return;
    }

    process.env.REGISTRATION_INVITE_ONLY = originalInviteOnly;
  });

  afterAll(() => {
    for (const server of servers) {
      server.close();
    }
  });

  it("closes registration when REGISTRATION_INVITE_ONLY is unset", async () => {
    delete process.env.REGISTRATION_INVITE_ONLY;
    const server = startServer();

    const response = await server.request();
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      ok: false,
      error: {
        code: "REGISTRATION_CLOSED",
        message: "Registration is invite-only.",
      },
    });
  });

  it("opens registration only for an explicit disable token", async () => {
    process.env.REGISTRATION_INVITE_ONLY = "off";
    const server = startServer();

    const response = await server.request();

    expect(response.status).toBe(201);
  });

  // Fail-safe pin: a typo must not read as "open". Swapping the env parser to
  // the default-false `booleanFlag` would silently open public registration.
  it("keeps registration closed for an unrecognized value", async () => {
    process.env.REGISTRATION_INVITE_ONLY = "maybe";
    const server = startServer();

    const response = await server.request();
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe("REGISTRATION_CLOSED");
  });

  // Ordering pin: the gate runs before the rate limiter, so blocked requests
  // never consume limiter budget. If the order flipped, the second request
  // would come back 429 instead of 403.
  it("rejects blocked requests before they consume rate-limit budget", async () => {
    const server = startServer({ inviteOnly: true, withRateLimiter: true });

    const first = await server.request();
    const second = await server.request();

    expect(first.status).toBe(403);
    expect(second.status).toBe(403);
  });
});
