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
  /** Omitted unless the user picked an explicit window; the server resolves it. */
  start_date?: string | undefined;
  end_date?: string | undefined;
  /** IANA zone, so the server reads "今天" and 本周 on the user calendar. */
  timezone?: string | undefined;
  exercise_id?: string | undefined;
  session_id?: string | undefined;
  plan_preferences?: AssistantPlanPreferencesWire | undefined;
}

export type AssistantPlanEquipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "kettlebell";

export type AssistantPlanFocusArea =
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "legs"
  | "glutes"
  | "core";

export interface AssistantPlanPreferencesWire {
  weekly_days?: number | undefined;
  session_duration_minutes?: 30 | 45 | 60 | 75 | 90 | undefined;
  available_equipment?: AssistantPlanEquipment[] | undefined;
  readiness?: "ready" | "fatigued" | undefined;
  focus_areas?: AssistantPlanFocusArea[] | undefined;
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
  exerciseId?: string | undefined;
  exerciseName: string;
  sets: number;
  repMin: number;
  repMax: number;
  targetWeightKg: number | null;
  restSeconds?: number | undefined;
  equipment?: string | null | undefined;
  movementPattern?: string | null | undefined;
  primaryMuscles?: string[] | undefined;
  alternatives?: AssistantPlanExerciseAlternative[] | undefined;
  basis: string;
}

export interface AssistantPlanExerciseAlternative {
  exerciseId: string;
  exerciseName: string;
  equipment: string | null;
  movementPattern: string | null;
  primaryMuscles: string[];
  restSeconds: number;
}

export interface AssistantPlanSession {
  sessionIndex: number;
  title: string;
  focusAreas: string[];
  estimatedDurationMinutes: number;
  exercises: AssistantPlannedExercise[];
}

export interface AssistantPlanDraft {
  strategy: AssistantPlanStrategy;
  exercises: AssistantPlannedExercise[];
  sessions?: AssistantPlanSession[] | undefined;
  notes: string[];
}

export interface AssistantPlannedExerciseWire {
  exercise_id?: string | undefined;
  exercise_name?: string | undefined;
  sets?: number | undefined;
  rep_min?: number | undefined;
  rep_max?: number | undefined;
  target_weight_kg?: number | null | undefined;
  rest_seconds?: number | undefined;
  equipment?: string | null | undefined;
  movement_pattern?: string | null | undefined;
  primary_muscles?: string[] | undefined;
  alternatives?:
    | Array<{
        exercise_id?: string | undefined;
        exercise_name?: string | undefined;
        equipment?: string | null | undefined;
        movement_pattern?: string | null | undefined;
        primary_muscles?: string[] | undefined;
        rest_seconds?: number | undefined;
      }>
    | undefined;
  basis?: string | undefined;
}

export interface AssistantMessageFaithfulness {
  status: "verified" | "flagged";
  checkedNumbers: number;
  unverifiedClaimCount: number;
}

export type AssistantMessageRole = "user" | "assistant";

export interface AssistantExerciseClarificationOption {
  exerciseId: string;
  exerciseName: string;
}

export interface AssistantDateRangeClarificationOption {
  label: string;
  startDate: string;
  endDate: string;
}

/**
 * A turn the server could not answer without one more piece of information.
 *
 * Mirrors the server's `assistantClarificationSchema` discriminated union. The
 * date-range arm exists because it is part of the contract, but the server only
 * produces it once ER-2 lands, so nothing renders it yet.
 */
export type AssistantClarification =
  | {
      kind: "exercise";
      // "missing": no exercise was named. "unresolved": one was named but the
      // dictionary does not have it. Collapsing them here would throw away the
      // distinction the server composes different copy for.
      reason: "ambiguous" | "missing" | "unresolved";
      options: AssistantExerciseClarificationOption[];
    }
  | {
      kind: "date_range";
      reason: "ambiguous";
      options: AssistantDateRangeClarificationOption[];
    };

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
  clarification?: AssistantClarification | undefined;
}

export interface AssistantActiveToolCall {
  toolName: string;
  status: "running" | "success" | "error";
  durationMs?: number | undefined;
}

export type AssistantProvider = "mock" | "anthropic" | "groq";

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
  clarification?:
    | {
        kind?: string | undefined;
        reason?: string | undefined;
        options?:
          | Array<{
              exercise_id?: string | undefined;
              exercise_name?: string | undefined;
              label?: string | undefined;
              start_date?: string | undefined;
              end_date?: string | undefined;
            }>
          | undefined;
      }
    | undefined;
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
        exercises?: AssistantPlannedExerciseWire[] | undefined;
        sessions?:
          | Array<{
              session_index?: number | undefined;
              title?: string | undefined;
              focus_areas?: string[] | undefined;
              estimated_duration_minutes?: number | undefined;
              exercises?: AssistantPlannedExerciseWire[] | undefined;
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
