export type AssistantChatStatus =
  | "idle"
  | "thinking"
  | "tool_calling"
  | "retrieving"
  | "answering"
  | "done"
  | "error";

export type AssistantMode =
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

export interface AssistantChatRequestPayload {
  mode: AssistantMode;
  message: string;
  start_date: string;
  end_date: string;
  exercise_id?: string | undefined;
  session_id?: string | undefined;
}

export interface AssistantPromptSuggestion {
  message: string;
  mode: AssistantMode;
}

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
  | { type: "structured_output"; output: AssistantStructuredOutput }
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
  evidence?: AssistantMessageEvidence | undefined;
  intent?: string | undefined;
  isStreaming?: boolean | undefined;
  limitations?: string[] | undefined;
  sources?: AssistantMessageSource[] | undefined;
}

export interface AssistantActiveToolCall {
  toolName: string;
  status: "running" | "success" | "error";
  durationMs?: number | undefined;
}

export type AssistantProvider = "mock" | "anthropic";

export interface AssistantMessageEvidence {
  calculationRules: string[];
  setIds: string[];
  toolNames: string[];
  workoutIds: string[];
}

export interface AssistantMessageSource {
  category: string;
  chunkText: string;
  id: string;
  sourceType: string;
  tags: string[];
  title: string;
}

export interface AssistantStructuredOutput {
  intent?: string | undefined;
  answer?:
    | {
        evidence?:
          | {
              calculation_rules?: string[] | undefined;
              set_ids?: string[] | undefined;
              tool_names?: string[] | undefined;
              workout_ids?: string[] | undefined;
            }
          | undefined;
        limitations?: string[] | undefined;
        sources?:
          | Array<{
              category?: string | undefined;
              chunk_text?: string | undefined;
              id?: string | undefined;
              source_type?: string | undefined;
              tags?: string[] | undefined;
              title?: string | undefined;
            }>
          | undefined;
      }
    | undefined;
}
