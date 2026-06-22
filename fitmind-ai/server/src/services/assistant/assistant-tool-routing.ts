import type {
  AssistantIntentMode,
  AssistantProviderToolDefinition,
} from "./provider-types.js";

/**
 * Map an assistant intent mode to its provider tool definition.
 *
 * Single source of truth for "which deterministic tool backs this mode": both the
 * orchestrator (allowed-tools list + provider-path coercion) and the mock provider
 * read from here, so the keyword/LLM router (`resolveRoutedIntent`) stays the only
 * message→intent classifier. The mock provider no longer re-classifies messages.
 *
 * @param mode - The resolved assistant intent mode.
 * @returns The provider tool definition, whose `input_fields` lists only the
 *   tool's REQUIRED args (optional args like the weekly report's `exercise_id`
 *   are intentionally omitted so coercion and Groq treat them as optional).
 */
export function getToolDefinitionForMode(
  mode: AssistantIntentMode,
): AssistantProviderToolDefinition {
  switch (mode) {
    case "auto":
      return {
        name: "get_recommendation_context",
        description: "Return a deterministic recommendation context package.",
        input_fields: ["start_date", "end_date"],
      };
    case "training_overview":
      return {
        name: "get_training_summary",
        description: "Return one deterministic training range summary.",
        input_fields: ["start_date", "end_date"],
      };
    case "weekly_report":
    case "next_week_plan":
      // exercise_id is OPTIONAL in the real schema (weeklyTrainingReportArgsSchema),
      // so it must not appear here: input_fields models REQUIRED args only. Listing
      // it would (1) make coerceMessageToEvidenceToolCall bail when no exercise is
      // selected (周报 prose leaks instead of running the tool) and (2) tell Groq the
      // field is required, risking a "null" arg that fails uuid validation → 400/502.
      return {
        name: "get_weekly_training_report",
        description: "Return one deterministic weekly training coach report.",
        input_fields: ["start_date", "end_date"],
      };
    case "exercise_progress":
    case "plateau_diagnosis":
      return {
        name: "get_exercise_progress",
        description: "Return deterministic progress data for one exercise.",
        input_fields: ["exercise_id", "start_date", "end_date"],
      };
    case "next_training_focus":
    case "muscle_balance":
    case "training_imbalance":
    case "recovery_check":
    case "evidence_explain":
    case "unsupported":
      return {
        name: "get_recommendation_context",
        description: "Return a deterministic recommendation context package.",
        input_fields: ["start_date", "end_date"],
      };
  }
}
