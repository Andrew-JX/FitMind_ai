import { z } from "zod";

import { runGroqChatCompletion } from "./groq-chat-client.js";
import type { AssistantRoutedIntent } from "./assistant-intent-router.js";
import type { AssistantProviderUsage } from "./provider-types.js";

const CLASSIFIER_MAX_TOKENS = 16;

/** Intents the LLM may return. Mirrors AssistantRoutedIntent exactly. */
const ROUTABLE_INTENTS = [
  "summary",
  "progress",
  "weekly_report",
  "plateau_diagnosis",
  "next_week_plan",
  "recommendation",
  "imbalance",
  "evidence",
  "exercise_history",
  "knowledge",
  "mixed_tool_rag",
  "unsupported",
] as const;

const routableIntentSchema = z.enum(ROUTABLE_INTENTS);

/**
 * Outcome of one rescue classification.
 *
 * `attempted` is true when a Groq call was issued (so the turn telemetry can count
 * it); `errored` is true when that call failed (HTTP/shape/network). `intent` is
 * null when no call ran, the call failed, or the model returned an unusable label.
 * `usage` carries token usage when reported.
 */
export interface LlmIntentClassification {
  intent: AssistantRoutedIntent | null;
  usage?: AssistantProviderUsage | undefined;
  attempted: boolean;
  errored: boolean;
}

/** Classifies a free-text message into one routed intent (with call telemetry). */
export interface LlmIntentRouter {
  classify(message: string): Promise<LlmIntentClassification>;
}

function buildClassifierSystemPrompt(): string {
  return [
    "You classify a fitness-training assistant message into exactly one intent id.",
    "Reply with ONLY the intent id, lowercase, no punctuation, no explanation.",
    "Intent ids and meanings:",
    "- summary: overall training volume / frequency summary",
    "- progress: progress or improvement of a specific exercise",
    "- weekly_report: a weekly training report",
    "- plateau_diagnosis: plateau / stagnation diagnosis",
    "- next_week_plan: a plan or draft for next week's training",
    "- recommendation: what to train today/next, which body part, training advice",
    "- imbalance: whether training is imbalanced across muscle groups",
    "- evidence: on what basis / why the assistant concluded something",
    "- exercise_history: previous / historical training records",
    "- knowledge: a training concept explanation (e.g. RPE, progressive overload)",
    "- mixed_tool_rag: needs both the user's training data and training knowledge",
    "- unsupported: not training-related, or cannot be mapped to the above",
  ].join("\n");
}

function parseRoutedIntent(content: string): AssistantRoutedIntent | null {
  const normalized = content
    .trim()
    .toLowerCase()
    .replace(/[^a-z_]/gu, "");
  const parsed = routableIntentSchema.safeParse(normalized);

  return parsed.success ? parsed.data : null;
}

/**
 * Build a Groq-backed intent router.
 *
 * Used only as a rescue when the deterministic keyword classifier returns
 * `unsupported` for a non-blocklisted message. Any failure (missing key, HTTP
 * error, bad shape, unrecognized label) yields `intent: null` so the caller falls
 * back to deterministic unsupported handling — the LLM never crashes or forces an
 * out-of-set intent. The result also reports `attempted`/`errored`/`usage` so the
 * turn telemetry can count this billed call.
 *
 * @returns An {@link LlmIntentRouter}.
 */
export function createGroqIntentRouter(): LlmIntentRouter {
  return {
    async classify(message: string): Promise<LlmIntentClassification> {
      const result = await runGroqChatCompletion({
        messages: [
          { role: "system", content: buildClassifierSystemPrompt() },
          { role: "user", content: message },
        ],
        maxTokens: CLASSIFIER_MAX_TOKENS,
        temperature: 0,
      });

      if (!result.ok) {
        // attempted but failed → errored; config-failure (not attempted) → not errored.
        return {
          intent: null,
          usage: result.usage,
          attempted: result.attempted,
          errored: result.attempted,
        };
      }

      return {
        intent: parseRoutedIntent(result.content ?? ""),
        usage: result.usage,
        attempted: true,
        errored: false,
      };
    },
  };
}
