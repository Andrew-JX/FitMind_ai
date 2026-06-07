import { describe, expect, it } from "vitest";

import {
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
  embedTextsWithVoyage,
} from "./voyage-embedding-client.js";

const vector = Array.from({ length: EMBEDDING_DIMENSION }, (_, index) =>
  index === 0 ? 0.25 : 0,
);

describe("embedTextsWithVoyage", () => {
  it("requests Voyage embeddings with the configured model and input type", async () => {
    const requests: unknown[] = [];
    const fetchImpl: typeof fetch = async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));

      return new Response(
        JSON.stringify({
          data: [{ embedding: vector }],
        }),
        { status: 200 },
      );
    };

    const embeddings = await embedTextsWithVoyage({
      apiKey: "test-key",
      texts: ["RPE source text"],
      inputType: "document",
      fetchImpl,
    });

    expect(embeddings).toEqual([vector]);
    expect(requests).toEqual([
      {
        input: ["RPE source text"],
        model: EMBEDDING_MODEL,
        input_type: "document",
        output_dimension: EMBEDDING_DIMENSION,
        output_dtype: "float",
      },
    ]);
  });

  it("throws a descriptive error when Voyage returns an API error", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ error: { message: "rate limited" } }), {
        status: 429,
      });

    await expect(
      embedTextsWithVoyage({
        apiKey: "test-key",
        texts: ["query"],
        inputType: "query",
        fetchImpl,
      }),
    ).rejects.toThrow("Voyage embedding request failed with 429");
  });

  it("rejects malformed embedding payloads", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ data: [{ embedding: "bad" }] }), {
        status: 200,
      });

    await expect(
      embedTextsWithVoyage({
        apiKey: "test-key",
        texts: ["query"],
        inputType: "query",
        fetchImpl,
      }),
    ).rejects.toThrow("Voyage embedding response did not contain vectors");
  });

  it("rejects vectors with the wrong dimension", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          data: [{ embedding: [0.1, 0.2] }],
        }),
        { status: 200 },
      );

    await expect(
      embedTextsWithVoyage({
        apiKey: "test-key",
        texts: ["query"],
        inputType: "query",
        fetchImpl,
      }),
    ).rejects.toThrow("Expected Voyage embedding dimension 1024");
  });
});
