import { describe, expect, it, vi } from "vitest";

import {
  resolveRoutedIntent,
  type MockAssistantTurnInput,
} from "./assistant-orchestrator-service.js";
import type { AssistantRoutedIntent } from "./assistant-intent-router.js";
import type { LlmIntentRouter } from "./llm-intent-router.js";

function autoInput(message: string): MockAssistantTurnInput {
  return {
    mode: "auto",
    message,
    start_date: "2026-05-19",
    end_date: "2026-06-17",
  };
}

function fakeRouter(
  intent: AssistantRoutedIntent | null,
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  },
): LlmIntentRouter {
  return {
    classify: vi.fn(async () => ({
      intent,
      usage,
      attempted: true,
      errored: false,
    })),
  };
}

describe("resolveRoutedIntent (Slice 11.2b keyword-first + LLM rescue)", () => {
  it("uses the keyword match and never calls the LLM on a confident hit", async () => {
    const router = fakeRouter("recommendation");

    const routed = await resolveRoutedIntent(
      autoInput("帮我做本周训练报告"),
      router,
    );

    expect(routed.intent).toBe("weekly_report");
    expect(routed.routerAttempted).toBe(false);
    expect(router.classify).not.toHaveBeenCalled();
  });

  it("rescues a keyword fallthrough via the LLM router and surfaces its usage", async () => {
    const router = fakeRouter("recommendation", {
      prompt_tokens: 40,
      completion_tokens: 3,
      total_tokens: 43,
    });

    const routed = await resolveRoutedIntent(autoInput("明天练啥"), router);

    expect(routed.intent).toBe("recommendation");
    expect(routed.routerAttempted).toBe(true);
    expect(routed.routerUsage).toEqual({
      prompt_tokens: 40,
      completion_tokens: 3,
      total_tokens: 43,
    });
    expect(router.classify).toHaveBeenCalledWith("明天练啥");
  });

  it("falls back to unsupported when the LLM router returns null", async () => {
    const router = fakeRouter(null);

    const routed = await resolveRoutedIntent(autoInput("明天练啥"), router);

    expect(routed.intent).toBe("unsupported");
    expect(routed.routerAttempted).toBe(true);
  });

  it("keeps out-of-scope messages refused without calling the LLM", async () => {
    const router = fakeRouter("recommendation");

    const routed = await resolveRoutedIntent(
      autoInput("今天天气怎么样"),
      router,
    );

    expect(routed.intent).toBe("unsupported");
    expect(routed.routerAttempted).toBe(false);
    expect(router.classify).not.toHaveBeenCalled();
  });

  it("stays deterministic (unsupported) on a fallthrough when no router is available", async () => {
    const routed = await resolveRoutedIntent(autoInput("明天练啥"), null);

    expect(routed.intent).toBe("unsupported");
    expect(routed.routerAttempted).toBe(false);
  });

  it("maps explicit (non-auto) modes without consulting keyword or LLM", async () => {
    const router = fakeRouter("recommendation");

    const routed = await resolveRoutedIntent(
      { ...autoInput("anything"), mode: "weekly_report" },
      router,
    );

    expect(routed.intent).toBe("weekly_report");
    expect(routed.routerAttempted).toBe(false);
    expect(router.classify).not.toHaveBeenCalled();
  });
});
