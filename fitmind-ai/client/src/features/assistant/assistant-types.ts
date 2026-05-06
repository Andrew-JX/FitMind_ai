export type AssistantChatStatus =
  | "idle"
  | "thinking"
  | "tool_calling"
  | "answering"
  | "done"
  | "error";

export type AssistantMode =
  | "training_overview"
  | "exercise_progress"
  | "recommendation_context";

export interface AssistantChatRequestPayload {
  mode: AssistantMode;
  message: string;
  start_date: string;
  end_date: string;
  exercise_id?: string | undefined;
  session_id?: string | undefined;
}

export type AssistantStreamEvent =
  | { type: "state"; state: "thinking" | "tool_calling" | "answering" }
  | { type: "session"; session_id: string }
  | { type: "provider_selected"; provider: "mock" | "anthropic" }
  | { type: "tool_call_started"; tool_name: string }
  | {
      type: "tool_call_finished";
      tool_name: string;
      status: "success" | "error";
      duration_ms: number;
    }
  | { type: "answer_delta"; text: string }
  | {
      type: "done";
      message_id?: string | undefined;
      session_id?: string | undefined;
    }
  | { type: "error"; code: string; message: string };

export type AssistantMessageRole = "user" | "assistant";

export interface AssistantChatMessage {
  id: string;
  role: AssistantMessageRole;
  text: string;
  isStreaming?: boolean | undefined;
}

export interface AssistantActiveToolCall {
  toolName: string;
  status: "running" | "success" | "error";
  durationMs?: number | undefined;
}

export type AssistantProvider = "mock" | "anthropic";
