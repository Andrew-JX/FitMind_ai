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

  it("normalizes a next-week plan draft onto the message", () => {
    const messages: AssistantChatMessage[] = [
      { id: "assistant-1", role: "assistant", text: "草案" },
    ];

    const result = mergeStructuredOutputIntoMessage(messages, "assistant-1", {
      intent: "next_week_plan",
      plan: {
        strategy: "add_frequency",
        exercises: [
          {
            exercise_name: "Barbell Bench Press",
            sets: 4,
            rep_min: 6,
            rep_max: 10,
            target_weight_kg: 72.5,
            basis: "基于估算 1RM 的 72%",
          },
          {
            exercise_name: "Barbell Squat",
            sets: 4,
            rep_min: 6,
            rep_max: 10,
            target_weight_kg: null,
            basis: "沿用上次训练重量",
          },
        ],
        notes: ["一次只改一个变量。"],
      },
    });

    expect(result[0]?.plan?.strategy).toBe("add_frequency");
    expect(result[0]?.plan?.exercises).toHaveLength(2);
    expect(result[0]?.plan?.exercises[0]?.targetWeightKg).toBe(72.5);
    expect(result[0]?.plan?.exercises[1]?.targetWeightKg).toBeNull();
    expect(result[0]?.plan?.notes).toContain("一次只改一个变量。");
  });

  it("leaves plan undefined when there are no planned exercises", () => {
    const messages: AssistantChatMessage[] = [
      { id: "assistant-1", role: "assistant", text: "回答" },
    ];

    const result = mergeStructuredOutputIntoMessage(messages, "assistant-1", {
      intent: "summary",
    });

    expect(result[0]?.plan).toBeUndefined();
  });

  it("normalizes a flagged faithfulness result with the claim count", () => {
    const messages: AssistantChatMessage[] = [
      { id: "assistant-1", role: "assistant", text: "回答" },
    ];

    const result = mergeStructuredOutputIntoMessage(messages, "assistant-1", {
      intent: "weekly_report",
      faithfulness: {
        status: "flagged",
        checkedNumbers: 5,
        unverifiedClaims: ["999", "42"],
      },
    });

    expect(result[0]?.faithfulness?.status).toBe("flagged");
    expect(result[0]?.faithfulness?.unverifiedClaimCount).toBe(2);
    expect(result[0]?.faithfulness?.checkedNumbers).toBe(5);
  });

  it("ignores an unchecked / unknown faithfulness status", () => {
    const messages: AssistantChatMessage[] = [
      { id: "assistant-1", role: "assistant", text: "回答" },
    ];

    const result = mergeStructuredOutputIntoMessage(messages, "assistant-1", {
      intent: "knowledge",
    });

    expect(result[0]?.faithfulness).toBeUndefined();
  });

  it("normalizes an exercise clarification into candidate options", () => {
    const messages: AssistantChatMessage[] = [
      { id: "assistant-1", role: "assistant", text: "需要确认动作" },
    ];

    const result = mergeStructuredOutputIntoMessage(messages, "assistant-1", {
      clarification: {
        kind: "exercise",
        options: [
          { exercise_id: "ex-1", exercise_name: "杠铃卧推" },
          { exercise_id: "ex-2", exercise_name: "哑铃卧推" },
        ],
        reason: "ambiguous",
      },
      intent: "unsupported",
    });

    expect(result[0]?.clarification).toEqual({
      kind: "exercise",
      options: [
        { exerciseId: "ex-1", exerciseName: "杠铃卧推" },
        { exerciseId: "ex-2", exerciseName: "哑铃卧推" },
      ],
      reason: "ambiguous",
    });
  });

  it("keeps an unresolved exercise clarification that carries no options", () => {
    const messages: AssistantChatMessage[] = [
      { id: "assistant-1", role: "assistant", text: "请告诉我动作名" },
    ];

    const result = mergeStructuredOutputIntoMessage(messages, "assistant-1", {
      clarification: { kind: "exercise", options: [], reason: "unresolved" },
    });

    expect(result[0]?.clarification).toEqual({
      kind: "exercise",
      options: [],
      reason: "unresolved",
    });
  });

  it("drops candidate options that are missing an id or a name", () => {
    const messages: AssistantChatMessage[] = [
      { id: "assistant-1", role: "assistant", text: "需要确认动作" },
    ];

    const result = mergeStructuredOutputIntoMessage(messages, "assistant-1", {
      clarification: {
        kind: "exercise",
        options: [
          { exercise_id: "ex-1", exercise_name: "杠铃卧推" },
          { exercise_name: "缺 id 的候选" },
          { exercise_id: "ex-3" },
        ],
        reason: "ambiguous",
      },
    });

    expect(result[0]?.clarification?.options).toEqual([
      { exerciseId: "ex-1", exerciseName: "杠铃卧推" },
    ]);
  });

  it("ignores a clarification of an unknown kind", () => {
    const messages: AssistantChatMessage[] = [
      { id: "assistant-1", role: "assistant", text: "回答" },
    ];

    const result = mergeStructuredOutputIntoMessage(messages, "assistant-1", {
      clarification: { kind: "muscle_group", options: [] },
    });

    expect(result[0]?.clarification).toBeUndefined();
  });
});
