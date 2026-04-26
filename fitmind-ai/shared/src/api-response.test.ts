import { describe, expect, it } from "vitest";

import type { ApiResponse } from "./api-response";

describe("ApiResponse", () => {
  it("supports success payloads with typed data", () => {
    const response: ApiResponse<{ status: string }> = {
      ok: true,
      data: {
        status: "ok",
      },
    };

    expect(response.ok).toBe(true);

    if (response.ok) {
      expect(response.data.status).toBe("ok");
    }
  });

  it("supports error payloads with a stable error code", () => {
    const response: ApiResponse<never> = {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected failure",
      },
    };

    expect(response.ok).toBe(false);

    if (!response.ok) {
      expect(response.error.code).toBe("INTERNAL_ERROR");
    }
  });
});
