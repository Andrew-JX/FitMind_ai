import type { LlmIntentRouter } from "./llm-intent-router.js";

export type AssistantStreamEvent =
  | {
      type: "state";
      state:
        | "thinking"
        | "planning"
        | "tool_calling"
        | "retrieving"
        | "answering";
    }
  | { type: "session"; session_id: string }
  | { type: "provider_selected"; provider: "mock" | "anthropic" | "groq" }
  | { type: "tool_call_started"; tool_name: string }
  | {
      type: "tool_call_finished";
      tool_name: string;
      status: "success" | "error";
      duration_ms: number;
    }
  | {
      type: "agent_step_started";
      index: number;
      kind: "tool" | "retrieval" | "synthesis";
      title: string;
      thought: string;
      tool_name: string | null;
    }
  | {
      type: "agent_step_finished";
      index: number;
      status: "success" | "error" | "skipped";
      duration_ms: number;
      observation: string;
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
  /** Injectable LLM intent router (Slice 11.2b). Default resolves from provider config; tests inject a fake. */
  intentRouter?: LlmIntentRouter | null | undefined;
}
