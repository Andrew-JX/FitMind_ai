export type OpenAiCompatibleProviderName = "groq" | "openai_compatible";

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

/** Token usage for one provider (LLM) call; OpenAI-compatible shape. */
export interface AssistantProviderUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}
