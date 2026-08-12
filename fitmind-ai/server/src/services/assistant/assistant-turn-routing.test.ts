import { describe, expect, it, vi } from "vitest";

import { HttpError } from "../../utils/http-error.js";
import type { AssistantRoutedIntent } from "./assistant-intent-router.js";
import * as routingModule from "./assistant-turn-routing.js";
import {
  buildProviderRequest,
  ensureAllowedProviderTool,
  resolveExecutionModeForIntent,
  resolveRoutedIntent,
  type AssistantTurnRoutingInput,
} from "./assistant-turn-routing.js";
import type { LlmIntentRouter } from "./llm-intent-router.js";
import type {
  AssistantIntentMode,
  AssistantProviderToolDefinition,
} from "./provider-types.js";

function autoInput(message: string): AssistantTurnRoutingInput {
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
      call: {
        attempted: true,
        errored: false,
        provider: "groq" as const,
        model: "llama-3.3-70b-versatile",
        usage,
      },
    })),
  };
}

const explicitModeCases = [
  ["training_overview", "summary"],
  ["weekly_report", "weekly_report"],
  ["exercise_progress", "progress"],
  ["plateau_diagnosis", "plateau_diagnosis"],
  ["next_training_focus", "recommendation"],
  ["next_week_plan", "next_week_plan"],
  ["muscle_balance", "imbalance"],
  ["training_imbalance", "imbalance"],
  ["recovery_check", "recommendation"],
  ["evidence_explain", "evidence"],
  ["unsupported", "unsupported"],
] as const satisfies ReadonlyArray<
  readonly [AssistantIntentMode, AssistantRoutedIntent]
>;

const executionModeCases = [
  ["weekly_report", undefined, "weekly_report"],
  ["plateau_diagnosis", "exercise-id", "plateau_diagnosis"],
  ["plateau_diagnosis", undefined, "exercise_progress"],
  ["next_week_plan", undefined, "next_week_plan"],
  ["summary", undefined, "training_overview"],
  ["exercise_history", undefined, "training_overview"],
  ["progress", undefined, "exercise_progress"],
  ["imbalance", undefined, "training_imbalance"],
  ["recommendation", undefined, "next_training_focus"],
  ["evidence", undefined, "evidence_explain"],
  ["mixed_tool_rag", undefined, "next_training_focus"],
  ["knowledge", undefined, "unsupported"],
  ["unsupported", undefined, "unsupported"],
] as const satisfies ReadonlyArray<
  readonly [AssistantRoutedIntent, string | undefined, AssistantIntentMode]
>;

const allowedToolCases = [
  [
    "training_overview",
    [
      "get_training_summary",
      "get_exercise_progress",
      "get_weekly_training_report",
      "get_recommendation_context",
    ],
  ],
  [
    "weekly_report",
    [
      "get_weekly_training_report",
      "get_training_summary",
      "get_exercise_progress",
      "get_recommendation_context",
    ],
  ],
  [
    "exercise_progress",
    [
      "get_exercise_progress",
      "get_training_summary",
      "get_weekly_training_report",
      "get_recommendation_context",
    ],
  ],
  [
    "next_training_focus",
    [
      "get_recommendation_context",
      "get_training_summary",
      "get_exercise_progress",
      "get_weekly_training_report",
    ],
  ],
] as const satisfies ReadonlyArray<
  readonly [AssistantIntentMode, readonly string[]]
>;

describe("assistant turn routing", () => {
  it("exposes only the four public routing functions at runtime", () => {
    expect(Object.keys(routingModule).sort()).toEqual([
      "buildProviderRequest",
      "ensureAllowedProviderTool",
      "resolveExecutionModeForIntent",
      "resolveRoutedIntent",
    ]);
  });

  it("uses the keyword match and never calls the LLM on a confident hit", async () => {
    const router = fakeRouter("recommendation");

    const routed = await resolveRoutedIntent(
      autoInput("帮我做本周训练报告"),
      router,
    );

    expect(routed.intent).toBe("weekly_report");
    expect(routed.routerCall.attempted).toBe(false);
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
    expect(routed.routerCall.attempted).toBe(true);
    expect(routed.routerCall.usage).toEqual({
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
    expect(routed.routerCall.attempted).toBe(true);
  });

  it("keeps out-of-scope messages refused without calling the LLM", async () => {
    const router = fakeRouter("recommendation");

    const routed = await resolveRoutedIntent(
      autoInput("今天天气怎么样"),
      router,
    );

    expect(routed.intent).toBe("unsupported");
    expect(routed.routerCall.attempted).toBe(false);
    expect(router.classify).not.toHaveBeenCalled();
  });

  it("stays deterministic on a fallthrough when no router is available", async () => {
    const routed = await resolveRoutedIntent(autoInput("明天练啥"), null);

    expect(routed.intent).toBe("unsupported");
    expect(routed.routerCall.attempted).toBe(false);
  });

  it("maps an explicit mode without consulting keyword or LLM", async () => {
    const router = fakeRouter("recommendation");

    const routed = await resolveRoutedIntent(
      { ...autoInput("anything"), mode: "weekly_report" },
      router,
    );

    expect(routed.intent).toBe("weekly_report");
    expect(routed.routerCall.attempted).toBe(false);
    expect(router.classify).not.toHaveBeenCalled();
  });

  it.each(explicitModeCases)(
    "maps explicit mode %s to %s without routing",
    async (mode, expectedIntent) => {
      const router = fakeRouter("knowledge");

      const routed = await resolveRoutedIntent(
        { ...autoInput("free text must be ignored"), mode },
        router,
      );

      expect(routed.intent).toBe(expectedIntent);
      expect(routed.routerCall).toEqual({
        attempted: false,
        errored: false,
        provider: null,
        model: null,
      });
      expect(router.classify).not.toHaveBeenCalled();
    },
  );

  it.each(executionModeCases)(
    "maps routed intent %s with exercise %s to execution mode %s",
    (intent, exerciseId, expectedMode) => {
      expect(
        resolveExecutionModeForIntent(
          { ...autoInput("anything"), exercise_id: exerciseId },
          intent,
        ),
      ).toBe(expectedMode);
    },
  );

  it("keeps an explicit input mode as the execution mode", () => {
    expect(
      resolveExecutionModeForIntent(
        { ...autoInput("anything"), mode: "recovery_check" },
        "unsupported",
      ),
    ).toBe("recovery_check");
  });

  it("builds the provider request without rewriting the original message", () => {
    const input = {
      ...autoInput("plain request"),
      exercise_id: "exercise-id",
    };

    const request = buildProviderRequest(input, "weekly_report");

    expect(request).toMatchObject({
      conversation: { user_message: "plain request" },
      assistant_context: {
        mode: "weekly_report",
        start_date: "2026-05-19",
        end_date: "2026-06-17",
        exercise_id: "exercise-id",
      },
      simulation: {
        scenario: "default",
        normalized_message: "plain request",
      },
    });
  });

  it("parses a trimmed mock text prefix only into the simulation hint", () => {
    const message = "  [mock:text] rewritten answer  ";
    const request = buildProviderRequest(
      autoInput(message),
      "training_overview",
    );

    expect(request.conversation.user_message).toBe(message);
    expect(request.simulation).toEqual({
      scenario: "message",
      normalized_message: "rewritten answer",
    });
  });

  it("parses a mock error prefix and preserves its normalized detail", () => {
    const request = buildProviderRequest(
      autoInput("[mock:error] provider unavailable"),
      "training_overview",
    );

    expect(request.simulation).toEqual({
      scenario: "error",
      normalized_message: "provider unavailable",
    });
  });

  it.each(allowedToolCases)(
    "orders and deduplicates allowed tools for %s",
    (mode, expectedNames) => {
      const request = buildProviderRequest(autoInput("anything"), mode);

      expect(request.allowed_tools.map((tool) => tool.name)).toEqual(
        expectedNames,
      );
      expect(new Set(request.allowed_tools.map((tool) => tool.name)).size).toBe(
        request.allowed_tools.length,
      );
    },
  );

  it.each([
    { kind: "message", message: "provider prose" } as const,
    { kind: "error", error_code: "UPSTREAM", message: "failed" } as const,
  ])("does not apply a tool whitelist to $kind responses", (response) => {
    expect(() => ensureAllowedProviderTool(response, [])).not.toThrow();
  });

  it("allows a tool call present in the request whitelist", () => {
    const allowedTools: AssistantProviderToolDefinition[] = [
      {
        name: "get_training_summary",
        description: "summary",
        input_fields: ["start_date", "end_date"],
      },
    ];

    expect(() =>
      ensureAllowedProviderTool(
        {
          kind: "tool_call",
          tool_name: "get_training_summary",
          tool_args: {},
        },
        allowedTools,
      ),
    ).not.toThrow();
  });

  it("rejects a provider tool call outside the request whitelist", () => {
    expect(() =>
      ensureAllowedProviderTool(
        {
          kind: "tool_call",
          tool_name: "delete_user",
          tool_args: {},
        },
        [],
      ),
    ).toThrowError(
      expect.objectContaining({
        statusCode: 502,
        code: "AI_PROVIDER_ERROR",
        message: "Provider requested unsupported tool delete_user.",
      }) as Partial<HttpError>,
    );
  });
});
