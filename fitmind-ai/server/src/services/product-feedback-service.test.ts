import { describe, expect, it, vi } from "vitest";

import {
  submitProductFeedback,
  type SubmitProductFeedbackInput,
} from "./product-feedback-service.js";

const feedbackRow = {
  created_at: "2026-06-10T09:00:00.000Z",
  id: "feedback-1",
  message: null,
  rating: 5,
  source_route: "/assistant",
  user_agent: "vitest",
  user_id: "user-1",
};

function createDependencies() {
  return {
    createFeedback: vi.fn().mockResolvedValue(feedbackRow),
  };
}

async function submit(
  input: Partial<SubmitProductFeedbackInput>,
  dependencies = createDependencies(),
) {
  const result = await submitProductFeedback(
    {
      userId: "user-1",
      ...input,
    },
    dependencies,
  );

  return { dependencies, result };
}

describe("product-feedback-service", () => {
  it("submits rating-only feedback", async () => {
    const { dependencies, result } = await submit({
      rating: 5,
      sourceRoute: "/assistant",
    });

    expect(dependencies.createFeedback).toHaveBeenCalledWith({
      message: null,
      rating: 5,
      sourceRoute: "/assistant",
      userAgent: null,
      userId: "user-1",
    });
    expect(result).toEqual({
      createdAt: "2026-06-10T09:00:00.000Z",
      id: "feedback-1",
      message: null,
      rating: 5,
      sourceRoute: "/assistant",
    });
  });

  it("submits message-only feedback after trimming text", async () => {
    const dependencies = createDependencies();
    dependencies.createFeedback.mockResolvedValueOnce({
      ...feedbackRow,
      message: "more specific next-week plan",
      rating: null,
    });

    await submit(
      {
        message: "  more specific next-week plan  ",
        sourceRoute: "  /assistant  ",
      },
      dependencies,
    );

    expect(dependencies.createFeedback).toHaveBeenCalledWith({
      message: "more specific next-week plan",
      rating: null,
      sourceRoute: "/assistant",
      userAgent: null,
      userId: "user-1",
    });
  });

  it("submits rating and message feedback together", async () => {
    const { dependencies } = await submit({
      message: "useful",
      rating: 4,
      userAgent: "vitest",
    });

    expect(dependencies.createFeedback).toHaveBeenCalledWith({
      message: "useful",
      rating: 4,
      sourceRoute: null,
      userAgent: "vitest",
      userId: "user-1",
    });
  });

  it("rejects empty feedback", async () => {
    const dependencies = createDependencies();

    await expect(
      submitProductFeedback(
        {
          message: "   ",
          rating: null,
          userId: "user-1",
        },
        dependencies,
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message:
        "\u8bf7\u81f3\u5c11\u9009\u62e9\u661f\u7ea7\u6216\u586b\u5199\u53cd\u9988\u5185\u5bb9\u3002",
      statusCode: 400,
    });
    expect(dependencies.createFeedback).not.toHaveBeenCalled();
  });
});
