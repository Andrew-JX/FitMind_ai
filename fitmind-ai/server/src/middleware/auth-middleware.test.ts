import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createErrorResponse } from "../utils/api-response.js";
import { HttpError, isHttpError } from "../utils/http-error.js";

vi.mock("../services/auth/jwt.js", () => ({
  verifyJwt: vi.fn(),
}));

import { verifyJwt } from "../services/auth/jwt.js";
import { authMiddleware } from "./auth-middleware.js";

const mockedVerifyJwt = vi.mocked(verifyJwt);

async function makeRequest(
  authorizationHeader?: string | undefined,
  cookieHeader?: string | undefined,
): Promise<{
  status: number;
  payload: unknown;
}> {
  const app = express();

  app.get("/secure", authMiddleware, (_req, res) => {
    return res.status(200).json({
      ok: true,
      data: {
        userId: res.locals.userId,
      },
    });
  });

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      void next;

      if (isHttpError(error)) {
        return res
          .status(error.statusCode)
          .json(createErrorResponse(error.toApiError()));
      }

      const fallbackError = new HttpError(
        500,
        "INTERNAL_ERROR",
        "Internal server error.",
      );

      return res
        .status(500)
        .json(createErrorResponse(fallbackError.toApiError()));
    },
  );

  const server = app.listen(0);

  try {
    const address = server.address();

    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    const headers = new Headers();

    if (authorizationHeader !== undefined) {
      headers.set("Authorization", authorizationHeader);
    }

    if (cookieHeader !== undefined) {
      headers.set("Cookie", cookieHeader);
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/secure`, {
      headers,
    });

    return {
      status: response.status,
      payload: await response.json(),
    };
  } finally {
    server.close();
  }
}

describe("auth-middleware", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests without a cookie or authorization header", async () => {
    const result = await makeRequest();

    expect(result.status).toBe(401);
    expect(result.payload).toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing authentication credentials.",
      },
    });
  });

  it("rejects malformed bearer headers", async () => {
    const result = await makeRequest("Token abc");

    expect(result.status).toBe(401);
    expect(result.payload).toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid Authorization header.",
      },
    });
  });

  it("rejects invalid bearer tokens", async () => {
    mockedVerifyJwt.mockRejectedValueOnce(
      new HttpError(401, "UNAUTHORIZED", "Invalid authentication token."),
    );

    const result = await makeRequest("Bearer bad-token");

    expect(result.status).toBe(401);
    expect(result.payload).toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid authentication token.",
      },
    });
  });

  it("passes through valid bearer tokens", async () => {
    mockedVerifyJwt.mockResolvedValueOnce({
      userId: "11111111-1111-4111-8111-111111111111",
    });

    const result = await makeRequest("Bearer good-token");

    expect(result.status).toBe(200);
    expect(result.payload).toEqual({
      ok: true,
      data: {
        userId: "11111111-1111-4111-8111-111111111111",
      },
    });
  });

  it("passes through a valid session cookie", async () => {
    mockedVerifyJwt.mockResolvedValueOnce({
      userId: "22222222-2222-4222-8222-222222222222",
    });

    const result = await makeRequest(undefined, "fitmind_token=good-cookie");

    expect(mockedVerifyJwt).toHaveBeenCalledWith("good-cookie");
    expect(result.status).toBe(200);
    expect(result.payload).toEqual({
      ok: true,
      data: {
        userId: "22222222-2222-4222-8222-222222222222",
      },
    });
  });

  it("prefers the session cookie over the authorization header", async () => {
    mockedVerifyJwt.mockResolvedValueOnce({
      userId: "33333333-3333-4333-8333-333333333333",
    });

    const result = await makeRequest(
      "Bearer header-token",
      "fitmind_token=cookie-token",
    );

    expect(mockedVerifyJwt).toHaveBeenCalledWith("cookie-token");
    expect(result.status).toBe(200);
  });
});
