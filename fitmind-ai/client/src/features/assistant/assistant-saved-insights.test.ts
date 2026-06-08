import { describe, expect, it } from "vitest";

import {
  buildAssistantInsightCopyText,
  isAssistantMessageSaveEligible,
} from "./assistant-saved-insights";
import type { AssistantChatMessage } from "./assistant-types";

describe("assistant saved insight helpers", () => {
  it("marks eligible coach replies as saveable", () => {
    const message: AssistantChatMessage = {
      id: "assistant-1",
      messageId: "message-1",
      role: "assistant",
      text: "Weekly report summary",
      intent: "weekly_report",
    };

    expect(isAssistantMessageSaveEligible(message)).toBe(true);
  });

  it("does not mark user, unsupported, streaming, or unpersisted messages as saveable", () => {
    expect(
      isAssistantMessageSaveEligible({
        id: "user-1",
        role: "user",
        text: "Save this",
      }),
    ).toBe(false);
    expect(
      isAssistantMessageSaveEligible({
        id: "assistant-1",
        messageId: "message-1",
        role: "assistant",
        text: "Unsupported",
        intent: "unsupported",
      }),
    ).toBe(false);
    expect(
      isAssistantMessageSaveEligible({
        id: "assistant-2",
        messageId: "message-2",
        role: "assistant",
        text: "Streaming",
        intent: "next_week_plan",
        isStreaming: true,
      }),
    ).toBe(false);
    expect(
      isAssistantMessageSaveEligible({
        id: "assistant-3",
        role: "assistant",
        text: "No persisted id",
        intent: "plateau_diagnosis",
      }),
    ).toBe(false);
  });

  it("builds stable copy text without raw ids", () => {
    const text = buildAssistantInsightCopyText({
      id: "assistant-1",
      messageId: "message-1",
      role: "assistant",
      text: "Keep next week conservative.",
      intent: "next_week_plan",
      evidence: {
        calculationRules: ["rule-1"],
        setIds: ["set-1", "set-2"],
        toolNames: ["get_weekly_training_report"],
        workoutIds: ["workout-1"],
      },
      limitations: ["Draft only."],
      sources: [
        {
          category: "programming",
          chunkText: "raw source excerpt",
          id: "source-1",
          sourceType: "markdown",
          tags: [],
          title: "Volume Landmarks",
        },
      ],
    });

    expect(text).toContain("类型：下周训练草案");
    expect(text).toContain("训练：1");
    expect(text).toContain("组数：2");
    expect(text).toContain("Volume Landmarks");
    expect(text).toContain("Draft only.");
    expect(text).not.toContain("workout-1");
    expect(text).not.toContain("set-1");
  });
});
