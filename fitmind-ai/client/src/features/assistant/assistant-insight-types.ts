import type { SemanticTone } from "../../theme/tokens";
import type { AssistantPromptSuggestion } from "./assistant-types";

export type AssistantInsightType =
  | "next_training_focus"
  | "training_imbalance"
  | "recovery_check"
  | "exercise_progress"
  | "evidence_explain";

export interface AssistantInsightOverview {
  set_count: number;
  total_volume: number;
  workout_count: number;
}

export interface AssistantInsightCard {
  type: AssistantInsightType;
  title: string;
  summary: string;
  tone: SemanticTone;
  hint?: string | undefined;
  evidenceSummary?: string | undefined;
  suggestedPrompt?: AssistantPromptSuggestion | undefined;
}

export interface AssistantInsightSnapshot {
  range: {
    end_date: string;
    start_date: string;
  };
  overview: AssistantInsightOverview;
  cards: AssistantInsightCard[];
  limitations: string[];
}
