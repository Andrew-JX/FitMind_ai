export type AssistantStreamEvent =
  | {
      type: "state";
      state: "thinking" | "tool_calling" | "retrieving" | "answering";
    }
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
  | { type: "structured_output"; output: unknown }
  | {
      type: "done";
      message_id?: string | undefined;
      session_id?: string | undefined;
    }
  | { type: "error"; code: string; message: string };

export interface AssistantStreamOptions {
  onEvent?: ((event: AssistantStreamEvent) => void | Promise<void>) | undefined;
}
