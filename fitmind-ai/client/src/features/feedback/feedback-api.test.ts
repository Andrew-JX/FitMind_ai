import { afterEach, describe, expect, it, vi } from "vitest";

import { submitFeedback } from "./feedback-api";

describe("feedback api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts feedback with the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            feedback: {
              createdAt: "2026-06-10T09:00:00.000Z",
              id: "feedback-1",
              message: "useful",
              rating: 5,
              sourceRoute: "/assistant",
            },
          },
        }),
        {
          headers: {
            "content-type": "application/json",
          },
          status: 201,
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitFeedback("token-1", {
      message: "useful",
      rating: 5,
      sourceRoute: "/assistant",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/feedback",
      expect.objectContaining({
        body: JSON.stringify({
          message: "useful",
          rating: 5,
          sourceRoute: "/assistant",
        }),
        method: "POST",
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Headers).get("Authorization")).toBe(
      "Bearer token-1",
    );
    expect(result).toEqual({
      createdAt: "2026-06-10T09:00:00.000Z",
      id: "feedback-1",
      message: "useful",
      rating: 5,
      sourceRoute: "/assistant",
    });
  });
});
