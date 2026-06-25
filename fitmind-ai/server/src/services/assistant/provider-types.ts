export interface AssistantProviderToolDefinition {
  name: string;
  description: string;
  input_fields: string[];
}

export interface AssistantProviderSimulationHint {
  scenario: "default" | "message" | "error";
  normalized_message: string;
}

export type AssistantIntentMode =
  | "auto"
  | "training_overview"
  | "weekly_report"
  | "exercise_progress"
  | "plateau_diagnosis"
  | "next_training_focus"
  | "next_week_plan"
  | "muscle_balance"
  | "training_imbalance"
  | "recovery_check"
  | "evidence_explain"
  | "unsupported";

export interface AssistantProviderRequest {
  conversation: {
    user_message: string;
  };
  assistant_context: {
    mode: AssistantIntentMode;
    start_date: string;
    end_date: string;
    exercise_id: string | null;
  };
  allowed_tools: AssistantProviderToolDefinition[];
  simulation: AssistantProviderSimulationHint;
}

/** Token usage for one provider (LLM) call; OpenAI-compatible shape. */
export interface AssistantProviderUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Telemetry for one provider (LLM) call, carried on every response variant —
 * including errors — so failed/edge calls are still countable. `provider`/`model`
 * come from the actual client config (not re-read downstream). Absent for the
 * deterministic mock provider, which makes no billed call.
 */
export interface AssistantProviderCallTelemetry {
  attempted: boolean;
  errored: boolean;
  provider: "groq" | null;
  model: string | null;
  usage?: AssistantProviderUsage | undefined;
}

export interface AssistantProviderMessageResponse {
  kind: "message";
  message: string;
  /** Per-call telemetry when the provider reports it (e.g. Groq); absent for mock. */
  telemetry?: AssistantProviderCallTelemetry | undefined;
}

export interface AssistantProviderToolCallResponse {
  kind: "tool_call";
  tool_name: string;
  tool_args: Record<string, string>;
  /** Per-call telemetry when the provider reports it (e.g. Groq); absent for mock. */
  telemetry?: AssistantProviderCallTelemetry | undefined;
}

export interface AssistantProviderErrorResponse {
  kind: "error";
  error_code: string;
  message: string;
  /** Per-call telemetry — present even on failure so the failed turn is countable. */
  telemetry?: AssistantProviderCallTelemetry | undefined;
}

export type AssistantProviderResponse =
  | AssistantProviderMessageResponse
  | AssistantProviderToolCallResponse
  | AssistantProviderErrorResponse;

export interface AssistantProvider {
  run(request: AssistantProviderRequest): Promise<AssistantProviderResponse>;
}
