import { HttpError } from "../../utils/http-error.js";
import {
  classifyAssistantIntent,
  isOutOfScopeMessage,
  type AssistantRoutedIntent,
} from "./assistant-intent-router.js";
import { getToolDefinitionForMode } from "./assistant-tool-routing.js";
import type { AssistantLlmCallRecord } from "./assistant-turn-observability.js";
import type { LlmIntentRouter } from "./llm-intent-router.js";
import type {
  AssistantIntentMode,
  AssistantProviderRequest,
  AssistantProviderResponse,
  AssistantProviderToolDefinition,
} from "./provider-types.js";

export interface AssistantTurnRoutingInput {
  mode: AssistantIntentMode;
  message: string;
  start_date: string;
  end_date: string;
  exercise_id?: string | undefined;
}

interface ProviderSimulationResult {
  scenario: "default" | "message" | "error";
  normalizedMessage: string;
}

function parseProviderSimulation(message: string): ProviderSimulationResult {
  const trimmed = message.trim();

  if (trimmed.startsWith("[mock:text]")) {
    return {
      scenario: "message",
      normalizedMessage: trimmed.slice("[mock:text]".length).trim(),
    };
  }

  if (trimmed.startsWith("[mock:error]")) {
    return {
      scenario: "error",
      normalizedMessage: trimmed.slice("[mock:error]".length).trim(),
    };
  }

  return {
    scenario: "default",
    normalizedMessage: message,
  };
}

/**
 * Resolved intent plus the rescue-classifier (Groq) call record made while routing.
 * The router call is billed, so its telemetry must reach the turn telemetry even on
 * paths (knowledge/unsupported) that make no further provider call.
 */
export interface ResolvedRoutedIntent {
  intent: AssistantRoutedIntent;
  routerCall: AssistantLlmCallRecord;
}

/** A record for a call site that issued no LLM call. */
const NO_ROUTER_CALL: AssistantLlmCallRecord = {
  attempted: false,
  errored: false,
  provider: null,
  model: null,
};

/** Wrap an intent resolved without any rescue-classifier call. */
function withoutRouterCall(
  intent: AssistantRoutedIntent,
): ResolvedRoutedIntent {
  return { intent, routerCall: NO_ROUTER_CALL };
}

function mapExplicitModeToIntent(
  mode: AssistantTurnRoutingInput["mode"],
): AssistantRoutedIntent {
  switch (mode) {
    case "training_overview":
      return "summary";
    case "weekly_report":
      return "weekly_report";
    case "exercise_progress":
      return "progress";
    case "plateau_diagnosis":
      return "plateau_diagnosis";
    case "next_week_plan":
      return "next_week_plan";
    case "next_training_focus":
    case "recovery_check":
      return "recommendation";
    case "muscle_balance":
    case "training_imbalance":
      return "imbalance";
    case "evidence_explain":
      return "evidence";
    case "auto":
    case "unsupported":
      return "unsupported";
    default:
      return "unsupported";
  }
}

export async function resolveRoutedIntent(
  input: AssistantTurnRoutingInput,
  router: LlmIntentRouter | null,
): Promise<ResolvedRoutedIntent> {
  if (input.mode === "auto") {
    const keywordIntent = classifyAssistantIntent(input.message).intent;

    // Fast path: a confident keyword match wins (deterministic, eval-stable, no LLM call).
    if (keywordIntent !== "unsupported") {
      return withoutRouterCall(keywordIntent);
    }

    // Slice 11.2b: keyword fell through. Genuinely out-of-scope (blocklist/empty)
    // stays a refusal; otherwise let the LLM rescue-route into the known intent
    // set (validated upstream; null → unsupported). No LLM → keep deterministic.
    if (isOutOfScopeMessage(input.message)) {
      return withoutRouterCall("unsupported");
    }

    if (router === null) {
      return withoutRouterCall("unsupported");
    }

    const classification = await router.classify(input.message);

    return {
      intent: classification.intent ?? "unsupported",
      routerCall: classification.call,
    };
  }

  return withoutRouterCall(mapExplicitModeToIntent(input.mode));
}

export function resolveExecutionModeForIntent(
  input: AssistantTurnRoutingInput,
  intent: AssistantRoutedIntent,
): AssistantIntentMode {
  if (input.mode !== "auto") {
    return input.mode;
  }

  switch (intent) {
    case "weekly_report":
      return "weekly_report";
    case "plateau_diagnosis":
      return input.exercise_id ? "plateau_diagnosis" : "exercise_progress";
    case "next_week_plan":
      return "next_week_plan";
    case "summary":
    case "exercise_history":
      return "training_overview";
    case "progress":
      return "exercise_progress";
    case "imbalance":
      return "training_imbalance";
    case "recommendation":
      return "next_training_focus";
    case "evidence":
      return "evidence_explain";
    case "mixed_tool_rag":
      return "next_training_focus";
    case "knowledge":
    case "unsupported":
      return "unsupported";
  }
}

function getAllowedToolDefinitions(
  mode: AssistantTurnRoutingInput["mode"],
): AssistantProviderToolDefinition[] {
  const prioritizedTools = [
    getToolDefinitionForMode(mode),
    getToolDefinitionForMode("training_overview"),
    getToolDefinitionForMode("exercise_progress"),
    getToolDefinitionForMode("weekly_report"),
    getToolDefinitionForMode("next_training_focus"),
  ];

  return prioritizedTools.filter(
    (tool, index, tools) =>
      tools.findIndex((candidate) => candidate.name === tool.name) === index,
  );
}

export function buildProviderRequest(
  input: AssistantTurnRoutingInput,
  executionMode: AssistantIntentMode,
): AssistantProviderRequest {
  const simulation = parseProviderSimulation(input.message);

  return {
    conversation: {
      user_message: input.message,
    },
    assistant_context: {
      mode: executionMode,
      start_date: input.start_date,
      end_date: input.end_date,
      exercise_id: input.exercise_id ?? null,
    },
    allowed_tools: getAllowedToolDefinitions(executionMode),
    simulation: {
      scenario: simulation.scenario,
      normalized_message: simulation.normalizedMessage,
    },
  };
}

export function ensureAllowedProviderTool(
  response: AssistantProviderResponse,
  allowedTools: AssistantProviderToolDefinition[],
): void {
  if (response.kind !== "tool_call") {
    return;
  }

  const isAllowed = allowedTools.some(
    (tool) => tool.name === response.tool_name,
  );

  if (!isAllowed) {
    throw new HttpError(
      502,
      "AI_PROVIDER_ERROR",
      `Provider requested unsupported tool ${response.tool_name}.`,
    );
  }
}
