import { describe, expect, it } from "vitest";

import {
  buildKnowledgeSearchText,
  parseKnowledgeFixture,
} from "./knowledge-ingestion.js";

describe("knowledge ingestion parser", () => {
  it("parses JSON knowledge fixtures", () => {
    const documents = parseKnowledgeFixture(
      JSON.stringify({
        documents: [
          {
            slug: "rpe",
            title: "RPE scale",
            category: "training_concept",
            tags: ["rpe", "intensity"],
            chunks: ["RPE estimates reps in reserve."],
          },
        ],
      }),
      "json",
    );

    expect(documents).toEqual([
      {
        slug: "rpe",
        title: "RPE scale",
        category: "training_concept",
        tags: ["rpe", "intensity"],
        chunks: ["RPE estimates reps in reserve."],
      },
    ]);
  });

  it("parses Markdown knowledge fixtures with frontmatter and chunk markers", () => {
    const documents = parseKnowledgeFixture(
      [
        "---",
        "slug: bench-plateau",
        "title: Bench plateau",
        "category: exercise_progress",
        "tags: bench, plateau, volume",
        "---",
        "Check technique first.",
        "<!-- chunk -->",
        "Then review volume and recovery.",
      ].join("\n"),
      "markdown",
    );

    expect(documents).toEqual([
      {
        slug: "bench-plateau",
        title: "Bench plateau",
        category: "exercise_progress",
        tags: ["bench", "plateau", "volume"],
        chunks: ["Check technique first.", "Then review volume and recovery."],
      },
    ]);
  });

  it("builds embedding/search text from document metadata and chunk text", () => {
    const text = buildKnowledgeSearchText({
      title: "Deload",
      category: "recovery",
      tags: ["fatigue", "volume"],
      chunk: "Reduce training stress for one week.",
    });

    expect(text).toBe(
      "Deload recovery Reduce training stress for one week. fatigue volume",
    );
  });
});
