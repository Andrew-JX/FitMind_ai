import type {
  AssistantProviderErrorResponse,
  AssistantProviderResponse,
  AssistantProviderToolCallResponse,
  AssistantProviderToolDefinition,
} from "./provider-types.js";

/** A provider response that has already passed the error guard. */
export type NonErrorProviderResponse = Extract<
  AssistantProviderResponse,
  { kind: "message" | "tool_call" }
>;

export interface EvidenceToolArgSource {
  start_date: string;
  end_date: string;
  exercise_id?: string | undefined;
}

export interface ProviderErrorFallbackTelemetry {
  provider_error_fallback: true;
  provider_error_code: string;
  provider_error_message_sanitized: string;
  provider_error_status: number | null;
  fallback_provider: "mock";
  fallback_reason: "provider_error";
}

export type ProviderErrorFallbackDecision =
  | {
      kind: "tool_call";
      response: AssistantProviderToolCallResponse;
      telemetry: ProviderErrorFallbackTelemetry;
    }
  | {
      kind: "missing_required_args";
      missing_input_fields: string[];
      telemetry: ProviderErrorFallbackTelemetry;
    };

function resolveToolArg(
  field: string,
  argSource: EvidenceToolArgSource,
): string | undefined {
  return field === "start_date"
    ? argSource.start_date
    : field === "end_date"
      ? argSource.end_date
      : field === "exercise_id"
        ? argSource.exercise_id
        : undefined;
}

function inferProviderErrorStatus(message: string): number | null {
  if (/\btimeout\b|\btimed out\b/iu.test(message)) {
    return 0;
  }

  const match = /\bHTTP\s+(\d{3})\b|\((\d{3})\)/iu.exec(message);
  const rawStatus = match?.[1] ?? match?.[2];
  if (rawStatus === undefined) {
    return null;
  }

  const status = Number.parseInt(rawStatus, 10);

  return Number.isInteger(status) ? status : null;
}

function buildProviderErrorFallbackTelemetry(
  response: AssistantProviderErrorResponse,
): ProviderErrorFallbackTelemetry {
  return {
    provider_error_fallback: true,
    provider_error_code: response.error_code,
    provider_error_message_sanitized: response.message,
    provider_error_status: inferProviderErrorStatus(response.message),
    fallback_provider: "mock",
    fallback_reason: "provider_error",
  };
}

export function decideProviderErrorFallback(
  response: AssistantProviderErrorResponse,
  tool: AssistantProviderToolDefinition,
  argSource: EvidenceToolArgSource,
): ProviderErrorFallbackDecision {
  const telemetry = buildProviderErrorFallbackTelemetry(response);
  const args: Record<string, string> = {};
  const missingInputFields: string[] = [];

  for (const field of tool.input_fields) {
    const value = resolveToolArg(field, argSource);

    if (value === undefined) {
      missingInputFields.push(field);
      continue;
    }

    args[field] = value;
  }

  if (missingInputFields.length > 0) {
    return {
      kind: "missing_required_args",
      missing_input_fields: missingInputFields,
      telemetry,
    };
  }

  return {
    kind: "tool_call",
    response: { kind: "tool_call", tool_name: tool.name, tool_args: args },
    telemetry,
  };
}

/**
 * Provider-path safety net (Slice 11.2a): every intent that reaches the provider
 * path is a data question, so a plain text reply (no tool call) is never the
 * desired final answer — it degrades to a generic non-answer (routing issue ①).
 * When the provider returns a message, run the mode's default tool instead.
 *
 * This is deterministic and provider-independent: it fixes ① whether the
 * configured provider is `mock` (which often fails to pick a tool) or `groq`
 * (which usually does, but might occasionally answer in prose). It only coerces
 * when every required tool arg is present, so exercise-scoped tools without an
 * `exercise_id` keep their guidance message instead of erroring.
 *
 * @param response - The non-error provider response.
 * @param tool - The mode's default tool definition.
 * @param argSource - Request-derived args available for the tool.
 * @returns The original response, or a synthesized tool call for the default tool.
 */
export function coerceMessageToEvidenceToolCall(
  response: NonErrorProviderResponse,
  tool: AssistantProviderToolDefinition,
  argSource: EvidenceToolArgSource,
): NonErrorProviderResponse {
  if (response.kind !== "message") {
    return response;
  }

  const args: Record<string, string> = {};
  for (const field of tool.input_fields) {
    const value =
      field === "start_date"
        ? argSource.start_date
        : field === "end_date"
          ? argSource.end_date
          : field === "exercise_id"
            ? argSource.exercise_id
            : undefined;

    if (value === undefined) {
      return response;
    }

    args[field] = value;
  }

  return { kind: "tool_call", tool_name: tool.name, tool_args: args };
}
