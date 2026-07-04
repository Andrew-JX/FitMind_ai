import type { AssistantStructuredAnswer } from "./assistant-answer-composer.js";
import type { AnswerFaithfulnessResult } from "./answer-faithfulness.js";

/**
 * Length budget for an accepted rewrite, relative to the draft summary.
 *
 * The faithfulness gate is *numeric/reference* only (it verifies numbers + UUIDs,
 * not free-form non-numeric claims like "恢复得很好/可以放心加量"). As a conservative
 * defense-in-depth against the model padding the summary with unverifiable prose,
 * a rewrite may not grow much past the draft: `draft.length * RATIO + SLACK`.
 * This bounds (does not fully eliminate) injected non-numeric claims — hence the
 * feature stays opt-in and default off.
 */
const MAX_PHRASING_LENGTH_RATIO = 1.5;
/** Absolute slack (chars) so short summaries still allow natural rewording variance. */
const MAX_PHRASING_LENGTH_SLACK = 16;

/** Outcome of a re-phrasing attempt: the answer to use + whether the rewrite won. */
export interface FaithfulPhrasingResult {
  answer: AssistantStructuredAnswer;
  phrasingApplied: boolean;
}

/**
 * Decide whether to adopt an LLM-rewritten summary (Slice 11.3b).
 *
 * The rewrite only replaces `summary`; every other field (bullets, conclusion,
 * recommendation, evidence, sources) stays deterministic. A candidate is kept only
 * when it is **numeric/reference faithful** (no unverified number or UUID) *and*
 * within the length budget; on any doubt we fall back to the deterministic draft.
 * A blank or unchanged rewrite is a no-op.
 *
 * @remarks
 * The guarantee is "no unverified number/reference + bounded length", NOT "no new
 * non-numeric facts" — faithfulness cannot detect a fabricated qualitative claim.
 * The length cap only bounds how much such prose can be added.
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

  const lengthBudget =
    draft.summary.length * MAX_PHRASING_LENGTH_RATIO +
    MAX_PHRASING_LENGTH_SLACK;
  if (trimmed.length > lengthBudget) {
    return { answer: draft, phrasingApplied: false };
  }

  const candidate: AssistantStructuredAnswer = { ...draft, summary: trimmed };

  if (verify(candidate).status === "verified") {
    return { answer: candidate, phrasingApplied: true };
  }

  return { answer: draft, phrasingApplied: false };
}
