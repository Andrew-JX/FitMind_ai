import { describe, expect, it } from "vitest";

import {
  coerceMessageToEvidenceToolCall,
  decideProviderErrorFallback,
} from "./assistant-provider-fallback.js";
import type { AssistantProviderToolDefinition } from "./provider-types.js";

const dateOnlyTool: AssistantProviderToolDefinition = {
  name: "get_recommendation_context",
  description: "Return a deterministic recommendation context package.",
  input_fields: ["start_date", "end_date"],
};

const exerciseTool: AssistantProviderToolDefinition = {
  name: "get_exercise_progress",
  description: "Return deterministic progress data for one exercise.",
  input_fields: ["exercise_id", "start_date", "end_date"],
};

const range = { start_date: "2026-05-19", end_date: "2026-06-17" };

describe("coerceMessageToEvidenceToolCall", () => {
  it("turns a bare message into the mode's default tool call for a date-only tool", () => {
    const result = coerceMessageToEvidenceToolCall(
      { kind: "message", message: "我目前更适合回答这些训练问题…" },
      dateOnlyTool,
      range,
    );

    expect(result).toEqual({
      kind: "tool_call",
      tool_name: "get_recommendation_context",
      tool_args: { start_date: "2026-05-19", end_date: "2026-06-17" },
    });
  });

  it("includes exercise_id when present", () => {
    const result = coerceMessageToEvidenceToolCall(
      { kind: "message", message: "..." },
      exerciseTool,
      { ...range, exercise_id: "ex-1" },
    );

    expect(result).toEqual({
      kind: "tool_call",
      tool_name: "get_exercise_progress",
      tool_args: {
        exercise_id: "ex-1",
        start_date: "2026-05-19",
        end_date: "2026-06-17",
      },
    });
  });

  it("leaves the message untouched when a required arg (exercise_id) is missing", () => {
    const response = {
      kind: "message" as const,
      message: "请先选择一个动作。",
    };

    const result = coerceMessageToEvidenceToolCall(
      response,
      exerciseTool,
      range,
    );

    expect(result).toBe(response);
  });

  it("passes through an existing tool call unchanged", () => {
    const response = {
      kind: "tool_call" as const,
      tool_name: "get_training_summary",
      tool_args: { start_date: "2026-05-19", end_date: "2026-06-17" },
    };

    const result = coerceMessageToEvidenceToolCall(
      response,
      dateOnlyTool,
      range,
    );

    expect(result).toBe(response);
  });
});

describe("decideProviderErrorFallback", () => {
  it("turns a provider error into a default tool-call fallback decision", () => {
    const result = decideProviderErrorFallback(
      {
        kind: "error",
        error_code: "GROQ_PROVIDER_ERROR",
        message: "Groq request failed (429): rate limited",
      },
      dateOnlyTool,
      range,
    );

    expect(result).toEqual({
      kind: "tool_call",
      response: {
        kind: "tool_call",
        tool_name: "get_recommendation_context",
        tool_args: { start_date: "2026-05-19", end_date: "2026-06-17" },
      },
      telemetry: {
        provider_error_fallback: true,
        provider_error_code: "GROQ_PROVIDER_ERROR",
        provider_error_message_sanitized:
          "Groq request failed (429): rate limited",
        provider_error_status: 429,
        fallback_provider: "mock",
        fallback_reason: "provider_error",
      },
    });
  });

  it("expresses provider-error fallback when required tool args are missing", () => {
    const result = decideProviderErrorFallback(
      {
        kind: "error",
        error_code: "OPENAI_COMPATIBLE_PROVIDER_ERROR",
        message: "OpenAI-compatible request timed out after 20000ms.",
      },
      exerciseTool,
      range,
    );

    expect(result).toEqual({
      kind: "missing_required_args",
      missing_input_fields: ["exercise_id"],
      telemetry: {
        provider_error_fallback: true,
        provider_error_code: "OPENAI_COMPATIBLE_PROVIDER_ERROR",
        provider_error_message_sanitized:
          "OpenAI-compatible request timed out after 20000ms.",
        provider_error_status: 0,
        fallback_provider: "mock",
        fallback_reason: "provider_error",
      },
    });
  });

  it("includes exercise_id when provider-error fallback can build an exercise tool call", () => {
    const result = decideProviderErrorFallback(
      {
        kind: "error",
        error_code: "OPENAI_COMPATIBLE_PROVIDER_ERROR",
        message: "OpenAI-compatible returned an unexpected response shape.",
      },
      exerciseTool,
      { ...range, exercise_id: "ex-1" },
    );

    expect(result).toEqual({
      kind: "tool_call",
      response: {
        kind: "tool_call",
        tool_name: "get_exercise_progress",
        tool_args: {
          exercise_id: "ex-1",
          start_date: "2026-05-19",
          end_date: "2026-06-17",
        },
      },
      telemetry: {
        provider_error_fallback: true,
        provider_error_code: "OPENAI_COMPATIBLE_PROVIDER_ERROR",
        provider_error_message_sanitized:
          "OpenAI-compatible returned an unexpected response shape.",
        provider_error_status: null,
        fallback_provider: "mock",
        fallback_reason: "provider_error",
      },
    });
  });

  it("preserves safe config-failure metadata without inventing a status", () => {
    const result = decideProviderErrorFallback(
      {
        kind: "error",
        error_code: "OPENAI_COMPATIBLE_PROVIDER_ERROR",
        message:
          "OpenAI-compatible config unavailable: OPENAI_COMPAT_API_KEY is required.",
      },
      dateOnlyTool,
      range,
    );

    expect(result.telemetry).toEqual({
      provider_error_fallback: true,
      provider_error_code: "OPENAI_COMPATIBLE_PROVIDER_ERROR",
      provider_error_message_sanitized:
        "OpenAI-compatible config unavailable: OPENAI_COMPAT_API_KEY is required.",
      provider_error_status: null,
      fallback_provider: "mock",
      fallback_reason: "provider_error",
    });
  });
});
