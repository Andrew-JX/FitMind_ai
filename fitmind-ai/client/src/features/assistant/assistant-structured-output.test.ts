import { describe, expect, it } from "vitest";

import { mergeStructuredOutputIntoMessage } from "./assistant-structured-output";
import type { AssistantChatMessage } from "./assistant-types";

describe("mergeStructuredOutputIntoMessage", () => {
  it("attaches intent, evidence, sources, and limitations to the target assistant message", () => {
    const messages: AssistantChatMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        text: "初始回答",
      },
    ];

    const result = mergeStructuredOutputIntoMessage(messages, "assistant-1", {
      intent: "mixed_tool_rag",
      answer: {
        evidence: {
          tool_names: ["get_recommendation_context"],
          workout_ids: ["workout-1"],
          set_ids: ["set-1"],
          calculation_rules: ["training_summary_30d"],
        },
        sources: [
          {
            id: "bench-plateau",
            title: "卧推进步停滞",
            category: "exercise_progress",
            chunk_text: "卧推短期没进步可能和训练容量不足有关。",
            source_type: "seed",
            tags: ["卧推"],
          },
        ],
        limitations: ["当前不是医疗或康复建议。"],
      },
    });

    expect(result[0]?.intent).toBe("mixed_tool_rag");
    expect(result[0]?.evidence?.toolNames).toContain(
      "get_recommendation_context",
    );
    expect(result[0]?.sources?.[0]?.title).toBe("卧推进步停滞");
    expect(result[0]?.limitations).toContain("当前不是医疗或康复建议。");
  });
});
