import {
  matchExercise,
  matchExerciseMentions,
  type ExerciseMatchCandidate,
  type ExerciseMatchingDictionaryItem,
} from "../training/exercise-matching-service.js";

export type AssistantExerciseEntityStatus =
  | "absent"
  | "matched"
  | "ambiguous"
  | "unresolved";

export interface AssistantExerciseEntityResolution {
  candidate_exercises: ExerciseMatchCandidate[];
  matched_exercise_id: string | null;
  matched_exercise_name: string | null;
  match_confidence: number;
  status: AssistantExerciseEntityStatus;
}

const ASSISTANT_EXERCISE_QUERY_FRAMING_PATTERN =
  /这个动作|该动作|帮我|请|看一下|看看|分析一下|分析|我的|最近|近期|这段时间|有没有|有没|是否|是不是|没进步|有进步|进步|平台期|平台|最大重量|表现|情况|数据|怎么诊断|诊断|怎么样|如何|了吗|今天|下次|练什么|适合练|总结|本周|训练|动作|什么|吗|呢|请问|[，。！？?,.!]/gu;

/**
 * Resolve one exercise entity from a complete assistant message.
 *
 * Known mentions are delegated to the training matcher. When no known mention
 * exists, assistant query framing is removed only to distinguish an absent
 * exercise from a remaining unknown phrase; that remaining phrase is still
 * evaluated by {@link matchExercise} and can never produce a guessed ID.
 *
 * @param message - Complete assistant user message.
 * @param dictionary - Canonical exercise dictionary used by the training matcher.
 * @returns Deterministic assistant exercise entity resolution.
 */
export function resolveAssistantExerciseEntity(
  message: string,
  dictionary: ExerciseMatchingDictionaryItem[],
): AssistantExerciseEntityResolution {
  const messageMatch = matchExerciseMentions(message, dictionary);

  if (messageMatch) {
    return {
      candidate_exercises: messageMatch.candidate_exercises,
      matched_exercise_id: messageMatch.matched_exercise_id,
      matched_exercise_name: messageMatch.matched_exercise_name,
      match_confidence: messageMatch.match_confidence,
      status: messageMatch.match_status,
    };
  }

  const unresolvedPhrase = extractPotentialUnknownExercise(message);

  if (unresolvedPhrase === null) {
    return buildEmptyResolution("absent");
  }

  const unresolvedMatch = matchExercise(unresolvedPhrase, dictionary);

  return {
    candidate_exercises: unresolvedMatch.candidate_exercises,
    matched_exercise_id: unresolvedMatch.matched_exercise_id,
    matched_exercise_name: unresolvedMatch.matched_exercise_name,
    match_confidence: unresolvedMatch.match_confidence,
    status: unresolvedMatch.match_status,
  };
}

function extractPotentialUnknownExercise(message: string): string | null {
  const candidate = message
    .normalize("NFKC")
    .replace(ASSISTANT_EXERCISE_QUERY_FRAMING_PATTERN, "")
    .replace(/\s+/gu, "")
    .trim();

  return candidate.length === 0 ? null : candidate;
}

function buildEmptyResolution(
  status: "absent" | "unresolved",
): AssistantExerciseEntityResolution {
  return {
    candidate_exercises: [],
    matched_exercise_id: null,
    matched_exercise_name: null,
    match_confidence: 0,
    status,
  };
}
