export type AssistantChatStatus =
  | "idle"
  | "thinking"
  | "planning"
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
      state:
        | "thinking"
        | "planning"
        | "tool_calling"
        | "retrieving"
        | "answering";
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
  | {
      type: "agent_step_started";
      index: number;
      kind: AssistantAgentStepKind;
      title: string;
      thought: string;
      tool_name: string | null;
    }
  | {
      type: "agent_step_finished";
      index: number;
      status: AssistantAgentStepStatus;
      duration_ms: number;
      observation: string;
    }
  | { type: "answer_delta"; text: string }
  | { type: "structured_output"; output: AssistantStructuredOutput }
  | {
      type: "done";
      message_id?: string | undefined;
      session_id?: string | undefined;
    }
  | { type: "error"; code: string; message: string };

export type AssistantAgentStepKind = "tool" | "retrieval" | "synthesis";
export type AssistantAgentStepStatus =
  | "running"
  | "success"
  | "error"
  | "skipped";

export interface AssistantAgentTraceStep {
  index: number;
  kind: AssistantAgentStepKind;
  title: string;
  thought: string;
  toolName: string | null;
  observation?: string | undefined;
  status: AssistantAgentStepStatus;
  durationMs?: number | undefined;
}

export interface AssistantAgentTrace {
  goal?: string | undefined;
  steps: AssistantAgentTraceStep[];
  stopReason?: string | undefined;
}

export type AssistantPlanStrategy =
  | "consolidate"
  | "add_frequency"
  | "maintain";

export interface AssistantPlannedExercise {
  exerciseName: string;
  sets: number;
  repMin: number;
  repMax: number;
  targetWeightKg: number | null;
  basis: string;
}

export interface AssistantPlanDraft {
  strategy: AssistantPlanStrategy;
  exercises: AssistantPlannedExercise[];
  notes: string[];
}

export interface AssistantMessageFaithfulness {
  status: "verified" | "flagged";
  checkedNumbers: number;
  unverifiedClaimCount: number;
}

export type AssistantMessageRole = "user" | "assistant";

export interface AssistantChatMessage {
  id: string;
  messageId?: string | undefined;
  role: AssistantMessageRole;
  text: string;
  evidence?: AssistantMessageEvidence | undefined;
  intent?: string | undefined;
  isStreaming?: boolean | undefined;
  limitations?: string[] | undefined;
  sources?: AssistantMessageSource[] | undefined;
  agentTrace?: AssistantAgentTrace | undefined;
  plan?: AssistantPlanDraft | undefined;
  faithfulness?: AssistantMessageFaithfulness | undefined;
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
  message_id?: string | undefined;
  agent_trace?:
    | {
        goal?: string | undefined;
        stop_reason?: string | undefined;
        steps?:
          | Array<{
              index?: number | undefined;
              kind?: string | undefined;
              title?: string | undefined;
              thought?: string | undefined;
              tool_name?: string | null | undefined;
              observation?: string | undefined;
              status?: string | undefined;
              duration_ms?: number | undefined;
            }>
          | undefined;
      }
    | undefined;
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
  plan?:
    | {
        strategy?: string | undefined;
        exercises?:
          | Array<{
              exercise_name?: string | undefined;
              sets?: number | undefined;
              rep_min?: number | undefined;
              rep_max?: number | undefined;
              target_weight_kg?: number | null | undefined;
              basis?: string | undefined;
            }>
          | undefined;
        notes?: string[] | undefined;
      }
    | undefined;
  faithfulness?:
    | {
        status?: string | undefined;
        checkedNumbers?: number | undefined;
        unverifiedClaims?: string[] | undefined;
      }
    | undefined;
}
