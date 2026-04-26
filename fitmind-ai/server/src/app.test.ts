import { afterAll, describe, expect, it } from "vitest";

import { createApp } from "./app.js";

describe("createApp", () => {
  const app = createApp();
  const server = app.listen(0);

  afterAll(() => {
    server.close();
  });

  it("serves the health endpoint", async () => {
    const address = server.address();

    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    const payload = (await response.json()) as {
      ok: boolean;
      data: { status: string };
    };

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      data: {
        status: "ok",
      },
    });
  });
});
