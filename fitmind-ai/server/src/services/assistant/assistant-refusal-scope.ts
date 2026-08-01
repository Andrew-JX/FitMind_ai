/** Which kind of refusal an unsupported turn deserves. */
export type AssistantUnsupportedScope = "out_of_scope" | "unrecognized";

/**
 * Training-domain markers that make a message "possibly relevant".
 *
 * Deliberately broad: goal words like 增肌 and modality words like 有氧 sit
 * inside training even when FitMind cannot answer the specific question. The
 * two failure directions are not symmetric — telling a lifter their training
 * question is outside the product is worse than asking someone to rephrase, so
 * the pattern errs toward `unrecognized`.
 */
const TRAINING_DOMAIN_PATTERN =
  /训练|练|健身|动作|组数|组|次数|重量|公斤|kg|rpe|1rm|力量|肌|卧推|深蹲|硬拉|引体|推举|划船|下拉|容量|强度|计划|周报|进步|平台期|停滞|恢复|疲劳|热身|增肌|减脂|拉伸|有氧|哑铃|杠铃|器械|减量周|deload|pr\b/iu;

export interface AssistantUnsupportedScopeInput {
  message: string;
  /**
   * True when this turn already resolved or shortlisted a dictionary exercise.
   * Such a message is training-related by construction, whatever its wording.
   */
  hasExerciseSignal?: boolean | undefined;
}

/**
 * Decide whether an unsupported turn is outside the product or merely unclear.
 *
 * @param input - The user message plus any exercise signal from this turn
 * @returns The refusal scope to compose copy for
 *
 * @remarks
 * Deterministic and zero-LLM, like the rest of ER: this runs on refusal paths
 * that make no provider call, and must not introduce one. The distinction is
 * user-visible — 生酮饮食 gets told the topic is outside FitMind, while a
 * garbled training question gets told it was not understood, plus examples that
 * actually work.
 */
export function classifyUnsupportedScope(
  input: AssistantUnsupportedScopeInput,
): AssistantUnsupportedScope {
  if (input.hasExerciseSignal === true) {
    return "unrecognized";
  }

  return TRAINING_DOMAIN_PATTERN.test(input.message)
    ? "unrecognized"
    : "out_of_scope";
}
