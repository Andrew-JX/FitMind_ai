export type AssistantStreamEvent =
  | { type: "state"; state: "thinking" | "tool_calling" | "answering" }
  | { type: "provider_selected"; provider: "mock" | "anthropic" }
  | { type: "tool_call_started"; tool_name: string }
  | {
      type: "tool_call_finished";
      tool_name: string;
      status: "success" | "error";
      duration_ms: number;
    }
  | { type: "answer_delta"; text: string }
  | { type: "done"; message_id?: string | undefined }
  | { type: "error"; code: string; message: string };

export interface AssistantStreamOptions {
  onEvent?: ((event: AssistantStreamEvent) => void | Promise<void>) | undefined;
}
