export interface AssistantProviderToolDefinition {
  name: string;
  description: string;
  input_fields: string[];
}

export interface AssistantProviderSimulationHint {
  scenario: "default" | "message" | "error";
  normalized_message: string;
}

export interface AssistantProviderRequest {
  conversation: {
    user_message: string;
  };
  assistant_context: {
    mode: "training_overview" | "exercise_progress" | "recommendation_context";
    start_date: string;
    end_date: string;
    exercise_id: string | null;
  };
  allowed_tools: AssistantProviderToolDefinition[];
  simulation: AssistantProviderSimulationHint;
}

export interface AssistantProviderMessageResponse {
  kind: "message";
  message: string;
}

export interface AssistantProviderToolCallResponse {
  kind: "tool_call";
  tool_name: string;
  tool_args: Record<string, string>;
}

export interface AssistantProviderErrorResponse {
  kind: "error";
  error_code: string;
  message: string;
}

export type AssistantProviderResponse =
  | AssistantProviderMessageResponse
  | AssistantProviderToolCallResponse
  | AssistantProviderErrorResponse;

export interface AssistantProvider {
  run(request: AssistantProviderRequest): Promise<AssistantProviderResponse>;
}
