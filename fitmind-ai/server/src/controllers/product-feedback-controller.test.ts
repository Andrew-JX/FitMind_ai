import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/product-feedback-service.js", () => ({
  submitProductFeedback: vi.fn(),
}));

import { submitProductFeedback } from "../services/product-feedback-service.js";
import { postProductFeedbackController } from "./product-feedback-controller.js";

const mockedSubmitProductFeedback = vi.mocked(submitProductFeedback);

function createResponse() {
  const response = {
    json: vi.fn(),
    locals: {
      userId: "11111111-1111-4111-8111-111111111111",
    },
    status: vi.fn(),
  };
  response.status.mockReturnValue(response);

  return response as unknown as Response<unknown, { userId: string }>;
}

function createRequest(body: unknown): Request {
  return {
    body,
    header: vi.fn().mockReturnValue("vitest-agent"),
  } as unknown as Request;
}

describe("product-feedback-controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates rating-only feedback", async () => {
    mockedSubmitProductFeedback.mockResolvedValueOnce({
      createdAt: "2026-06-10T09:00:00.000Z",
      id: "feedback-1",
      message: null,
      rating: 5,
      sourceRoute: "/assistant",
    });
    const response = createResponse();

    await postProductFeedbackController(
      createRequest({
        rating: 5,
        sourceRoute: "/assistant",
      }),
      response,
    );

    expect(mockedSubmitProductFeedback).toHaveBeenCalledWith({
      message: undefined,
      rating: 5,
      sourceRoute: "/assistant",
      userAgent: "vitest-agent",
      userId: "11111111-1111-4111-8111-111111111111",
    });
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({
      ok: true,
      data: {
        feedback: {
          createdAt: "2026-06-10T09:00:00.000Z",
          id: "feedback-1",
          message: null,
          rating: 5,
          sourceRoute: "/assistant",
        },
      },
    });
  });

  it("creates message-only feedback", async () => {
    mockedSubmitProductFeedback.mockResolvedValueOnce({
      createdAt: "2026-06-10T09:00:00.000Z",
      id: "feedback-2",
      message: "more concrete plans",
      rating: null,
      sourceRoute: "/assistant",
    });
    const response = createResponse();

    await postProductFeedbackController(
      createRequest({
        message: "more concrete plans",
        sourceRoute: "/assistant",
      }),
      response,
    );

    expect(mockedSubmitProductFeedback).toHaveBeenCalledWith({
      message: "more concrete plans",
      rating: undefined,
      sourceRoute: "/assistant",
      userAgent: "vitest-agent",
      userId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("creates rating and message feedback", async () => {
    mockedSubmitProductFeedback.mockResolvedValueOnce({
      createdAt: "2026-06-10T09:00:00.000Z",
      id: "feedback-3",
      message: "useful",
      rating: 4,
      sourceRoute: "/training",
    });
    const response = createResponse();

    await postProductFeedbackController(
      createRequest({
        message: "useful",
        rating: 4,
        sourceRoute: "/training",
      }),
      response,
    );

    expect(mockedSubmitProductFeedback).toHaveBeenCalledWith({
      message: "useful",
      rating: 4,
      sourceRoute: "/training",
      userAgent: "vitest-agent",
      userId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("rejects out-of-range ratings before calling the service", async () => {
    await expect(
      postProductFeedbackController(
        createRequest({ rating: 6 }),
        createResponse(),
      ),
    ).rejects.toBeTruthy();
    expect(mockedSubmitProductFeedback).not.toHaveBeenCalled();
  });

  it("does not accept user_id from the request body", async () => {
    await expect(
      postProductFeedbackController(
        createRequest({
          rating: 5,
          user_id: "22222222-2222-4222-8222-222222222222",
        }),
        createResponse(),
      ),
    ).rejects.toBeTruthy();
    expect(mockedSubmitProductFeedback).not.toHaveBeenCalled();
  });
});
