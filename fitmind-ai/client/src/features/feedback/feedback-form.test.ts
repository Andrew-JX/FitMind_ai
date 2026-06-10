import { describe, expect, it } from "vitest";

import { buildFeedbackSubmission } from "./feedback-form";

describe("feedback form helpers", () => {
  it("rejects empty feedback", () => {
    expect(
      buildFeedbackSubmission({
        message: "   ",
        rating: null,
        sourceRoute: "/assistant",
      }),
    ).toBeNull();
  });

  it("builds rating-only feedback", () => {
    expect(
      buildFeedbackSubmission({
        message: "",
        rating: 5,
        sourceRoute: "/assistant",
      }),
    ).toEqual({
      rating: 5,
      sourceRoute: "/assistant",
    });
  });

  it("builds message-only feedback", () => {
    expect(
      buildFeedbackSubmission({
        message: "  more concrete next-week plans  ",
        rating: null,
        sourceRoute: "/assistant",
      }),
    ).toEqual({
      message: "more concrete next-week plans",
      sourceRoute: "/assistant",
    });
  });
});
