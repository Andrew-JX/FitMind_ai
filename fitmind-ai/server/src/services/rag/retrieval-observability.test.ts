import { describe, expect, it, vi } from "vitest";

import {
  buildRetrievalLogEvent,
  logRetrievalEvent,
} from "./retrieval-observability.js";

describe("retrieval observability", () => {
  it("builds a safe structured retrieval event", () => {
    const event = buildRetrievalLogEvent({
      intent: "knowledge",
      retrievalMode: "hybrid",
      sources: [
        {
          title: "RPE scale",
          score: 0.82,
        },
      ],
      fallbackReason: "none",
    });

    expect(event).toEqual({
      event: "rag_retrieval",
      intent: "knowledge",
      retrieval_mode: "hybrid",
      top_source_titles: ["RPE scale"],
      score_summary: {
        count: 1,
        max: 0.82,
        min: 0.82,
      },
      fallback_reason: "none",
    });
    expect(JSON.stringify(event)).not.toContain("DATABASE_URL");
    expect(JSON.stringify(event)).not.toContain("VOYAGE_API_KEY");
    expect(JSON.stringify(event)).not.toContain("postgres://");
  });

  it("logs JSON without raw prompts or sensitive fields", () => {
    const logger = vi.fn();

    logRetrievalEvent(
      {
        intent: "mixed_tool_rag",
        retrievalMode: "keyword",
        sources: [],
        fallbackReason: "embedding_provider_unavailable",
      },
      logger,
    );

    expect(logger).toHaveBeenCalledWith(
      JSON.stringify({
        event: "rag_retrieval",
        intent: "mixed_tool_rag",
        retrieval_mode: "keyword",
        top_source_titles: [],
        score_summary: {
          count: 0,
          max: 0,
          min: 0,
        },
        fallback_reason: "embedding_provider_unavailable",
      }),
    );
  });
});
