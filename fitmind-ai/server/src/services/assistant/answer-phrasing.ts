import type { AssistantStructuredAnswer } from "./assistant-answer-composer.js";
import type { AnswerFaithfulnessResult } from "./answer-faithfulness.js";

/** Outcome of a re-phrasing attempt: the answer to use + whether the rewrite won. */
export interface FaithfulPhrasingResult {
  answer: AssistantStructuredAnswer;
  phrasingApplied: boolean;
}

/**
 * Decide whether to adopt an LLM-rewritten summary (Slice 11.3b).
 *
 * The rewrite only replaces `summary`; every other field (bullets, conclusion,
 * recommendation, evidence, sources) stays deterministic. The candidate is kept
 * only when runtime faithfulness verifies it — so a rewrite can never introduce an
 * unverified number; on any doubt we fall back to the deterministic draft. A blank
 * or unchanged rewrite is treated as a no-op.
 *
 * @param draft - The deterministic answer (source of truth).
 * @param phrasedSummary - The provider's re-phrased summary candidate.
 * @param verify - Faithfulness check for a candidate answer (bound to this turn's tool outputs).
 * @returns The answer to use and whether the rewrite was applied.
 */
export function applyFaithfulPhrasing(
  draft: AssistantStructuredAnswer,
  phrasedSummary: string,
  verify: (answer: AssistantStructuredAnswer) => AnswerFaithfulnessResult,
): FaithfulPhrasingResult {
  const trimmed = phrasedSummary.trim();

  if (trimmed.length === 0 || trimmed === draft.summary) {
    return { answer: draft, phrasingApplied: false };
  }

  const candidate: AssistantStructuredAnswer = { ...draft, summary: trimmed };

  if (verify(candidate).status === "verified") {
    return { answer: candidate, phrasingApplied: true };
  }

  return { answer: draft, phrasingApplied: false };
}
