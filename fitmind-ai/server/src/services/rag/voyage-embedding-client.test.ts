import { describe, expect, it } from "vitest";

import {
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
  RERANK_MODEL,
  embedTextsWithVoyage,
  rerankWithVoyage,
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

describe("rerankWithVoyage", () => {
  it("requests Voyage rerank without returning documents", async () => {
    const requests: unknown[] = [];
    const headers: unknown[] = [];
    const fetchImpl: typeof fetch = async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      headers.push(init?.headers);

      return new Response(
        JSON.stringify({
          data: [
            {
              index: 1,
              relevance_score: 0.91,
            },
            {
              index: 0,
              relevance_score: 0.42,
            },
          ],
          usage: {
            total_tokens: 37,
          },
        }),
        { status: 200 },
      );
    };

    const result = await rerankWithVoyage({
      apiKey: "test-key",
      query: "RPE",
      documents: ["first", "second"],
      topK: 2,
      fetchImpl,
    });

    expect(result).toEqual({
      results: [
        {
          index: 1,
          relevanceScore: 0.91,
        },
        {
          index: 0,
          relevanceScore: 0.42,
        },
      ],
      totalTokens: 37,
    });
    expect(requests).toEqual([
      {
        query: "RPE",
        documents: ["first", "second"],
        model: RERANK_MODEL,
        top_k: 2,
        return_documents: false,
        truncation: true,
      },
    ]);
    expect(headers).toEqual([
      {
        Authorization: "Bearer test-key",
        "Content-Type": "application/json",
      },
    ]);
    expect(JSON.stringify(requests)).not.toContain("test-key");
  });

  it("throws a descriptive error when Voyage rerank returns an API error", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ error: { message: "rate limited" } }), {
        status: 429,
      });

    await expect(
      rerankWithVoyage({
        apiKey: "test-key",
        query: "RPE",
        documents: ["source"],
        topK: 1,
        fetchImpl,
      }),
    ).rejects.toThrow("Voyage rerank request failed with 429");
  });

  it("rejects malformed rerank payloads", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ data: [{ index: "bad" }] }), {
        status: 200,
      });

    await expect(
      rerankWithVoyage({
        apiKey: "test-key",
        query: "RPE",
        documents: ["source"],
        topK: 1,
        fetchImpl,
      }),
    ).rejects.toThrow("Voyage rerank response did not contain rankings");
  });
});
