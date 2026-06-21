import { z } from "zod";

import { getGroqAssistantProviderConfig } from "./provider-config.js";
import type { AssistantRoutedIntent } from "./assistant-intent-router.js";

const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";
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

const groqChatCompletionSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable().optional() }) }))
    .min(1),
});

/** Classifies a free-text message into one routed intent, or null when unavailable. */
export interface LlmIntentRouter {
  classify(message: string): Promise<AssistantRoutedIntent | null>;
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
  const normalized = content.trim().toLowerCase().replace(/[^a-z_]/gu, "");
  const parsed = routableIntentSchema.safeParse(normalized);

  return parsed.success ? parsed.data : null;
}

/**
 * Build a Groq-backed intent router.
 *
 * Used only as a rescue when the deterministic keyword classifier returns
 * `unsupported` for a non-blocklisted message. Any failure (missing key, HTTP
 * error, bad shape, unrecognized label) resolves to `null` so the caller falls
 * back to the deterministic unsupported handling — the LLM never crashes or
 * forces an out-of-set intent.
 *
 * @returns An {@link LlmIntentRouter}.
 */
export function createGroqIntentRouter(): LlmIntentRouter {
  return {
    async classify(message: string): Promise<AssistantRoutedIntent | null> {
      try {
        const config = getGroqAssistantProviderConfig();
        const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: CLASSIFIER_MAX_TOKENS,
            temperature: 0,
            messages: [
              { role: "system", content: buildClassifierSystemPrompt() },
              { role: "user", content: message },
            ],
          }),
        });

        if (!response.ok) {
          return null;
        }

        const parsed = groqChatCompletionSchema.safeParse(await response.json());

        if (!parsed.success) {
          return null;
        }

        const content = parsed.data.choices[0]?.message.content ?? "";

        return parseRoutedIntent(content);
      } catch {
        return null;
      }
    },
  };
}
