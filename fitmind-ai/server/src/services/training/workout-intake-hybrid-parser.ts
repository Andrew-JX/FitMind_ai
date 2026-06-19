import {
  workoutIntakeParseResponseSchema,
  type WorkoutIntakeParseRequest,
  type WorkoutIntakeParseResponse,
} from "../../schemas/workout-intake-schemas.js";
import { matchExercise } from "./exercise-matching-service.js";
import {
  createWorkoutIntakeLlmParser,
  getConfiguredWorkoutIntakeLlmProvider,
  llmWorkoutIntakeOutputSchema,
  type LlmWorkoutIntakeOutput,
  type WorkoutIntakeLlmProviderMode,
  type WorkoutIntakeLlmRawParser,
} from "./workout-intake-llm-parser.js";
import {
  parseWorkoutIntakeDraft,
  type WorkoutIntakeExerciseDictionaryItem,
} from "./workout-intake-parser.js";

interface ParseHybridOptions {
  llmParser?: WorkoutIntakeLlmRawParser | undefined;
  now?: Date | undefined;
  provider?: WorkoutIntakeLlmProviderMode | undefined;
}

const FALLBACK_FAILURE_WARNING =
  "\u667a\u80fd\u89e3\u6790\u7ed3\u679c\u672a\u901a\u8fc7\u6821\u9a8c\uff0c\u5df2\u8fd4\u56de\u4fdd\u5b88\u89c4\u5219\u89e3\u6790\u8349\u7a3f\u3002";

/** \u6587\u672c\u91cc\u51fa\u73b0\u81f3\u5c11\u8fd9\u4e48\u591a\u4e2a\u4e92\u4e0d\u76f8\u540c\u7684\u91cd\u91cf\uff0c\u624d\u68c0\u67e5"\u662f\u5426\u88ab\u89c4\u5219\u89e3\u6790\u538b\u6241\u6210\u66f4\u5c11\u7ec4"\u3002 */
const MIN_DISTINCT_WEIGHTS_FOR_VARIED_SET_CHECK = 2;

/** \u5e26\u5355\u4f4d\u7684\u91cd\u91cf\u63d0\u53ca\uff0c\u5982 60\u516c\u65a4 / 27.5kg / 135\u78c5\u3002 */
const WEIGHT_MENTION_PATTERN = /(\d+(?:\.\d+)?)\s*(?:kg|\u516c\u65a4|\u5343\u514b|\u78c5|lbs?)/giu;
/** "\u91cd\u91cf x \u6b21\u6570"\u6210\u5bf9\u5199\u6cd5\u91cc\u5de6\u4fa7\u7684\u91cd\u91cf\uff0c\u5982 60x10 / 65\u00d78\u3002 */
const WEIGHT_BEFORE_REPS_PAIR_PATTERN = /(\d+(?:\.\d+)?)\s*[x\u00d7*]\s*\d/giu;

export async function parseHybridWorkoutIntakeDraft(
  input: WorkoutIntakeParseRequest,
  exerciseDictionary: WorkoutIntakeExerciseDictionaryItem[],
  options: ParseHybridOptions = {},
): Promise<WorkoutIntakeParseResponse> {
  const ruleResult = parseWorkoutIntakeDraft(
    input,
    exerciseDictionary,
    options.now,
  );

  if (!shouldUseLlmFallback(ruleResult, input.text)) {
    return ruleResult;
  }

  const provider = options.provider ?? getConfiguredWorkoutIntakeLlmProvider();
  const llmParser =
    options.llmParser ?? createWorkoutIntakeLlmParser(provider);

  if (!llmParser) {
    return markFallbackUnavailable(ruleResult, [
      "\u667a\u80fd\u89e3\u6790\u5df2\u5173\u95ed\uff0c\u5df2\u8fd4\u56de\u4fdd\u5b88\u89c4\u5219\u89e3\u6790\u8349\u7a3f\u3002",
    ]);
  }

  try {
    const rawOutput = await llmParser({ text: input.text });
    const parsedJson = JSON.parse(rawOutput) as unknown;
    const llmOutput = llmWorkoutIntakeOutputSchema.parse(parsedJson);

    if (
      llmOutput.exercises.length === 0 &&
      ruleResult.draft.exercises.length > 0
    ) {
      return markFallbackUnavailable(ruleResult, [FALLBACK_FAILURE_WARNING]);
    }

    return buildResponseFromLlmOutput(input, ruleResult, exerciseDictionary, llmOutput);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return markFallbackUnavailable(ruleResult, [
      `${FALLBACK_FAILURE_WARNING}（${reason}）`,
    ]);
  }
}

function shouldUseLlmFallback(
  result: WorkoutIntakeParseResponse,
  text: string,
): boolean {
  const validSetCount = result.draft.exercises.reduce(
    (total, exercise) => total + exercise.sets.length,
    0,
  );
  const hasIncompleteSets = result.draft.exercises.some(
    (exercise) => exercise.incomplete_sets.length > 0,
  );
  const hasAnyExerciseWithoutValidSets = result.draft.exercises.some(
    (exercise) => exercise.sets.length === 0,
  );
  const hasNoCandidateItems = result.unresolved_items.some(
    (item) => item.reason === "no_candidates" || item.reason === "no_sets",
  );
  const hasMissingSetWarning = result.warnings.some((warning) =>
    /missing|parsable sets|\u6ca1\u6709\u89e3\u6790\u51fa\u6709\u6548\u7ec4|\u7ec4\u6570\u4fe1\u606f\u4e0d\u5b8c\u6574/iu.test(
      warning,
    ),
  );

  return (
    validSetCount === 0 ||
    hasIncompleteSets ||
    hasAnyExerciseWithoutValidSets ||
    hasNoCandidateItems ||
    hasMissingSetWarning ||
    likelyFlattenedVariedSets(result, text)
  );
}

/**
 * \u542f\u53d1\u5f0f\uff1a\u7528\u6237\u6587\u672c\u91cc\u63d0\u5230\u4e86\u591a\u4e2a\u4e92\u4e0d\u76f8\u540c\u7684\u91cd\u91cf\uff08\u5982"\u7b2c\u4e00\u7ec460\u516c\u65a4\u2026\u7b2c\u4e8c\u7ec470\u516c\u65a4\u2026"\uff09\uff0c
 * \u4f46\u89c4\u5219\u89e3\u6790\u6355\u83b7\u5230\u7684\u4e0d\u540c\u91cd\u91cf\u66f4\u5c11\u2014\u2014\u5f80\u5f80\u662f\u53e3\u8bed filler\uff08"\u505a\u4e86 / \u52a0\u5230 / \u4e86"\uff09\u8ba9\u6210\u5bf9\u5199\u6cd5
 * \u6f0f\u5339\u914d\u3001\u628a"\u6bcf\u7ec4\u4e0d\u540c\u91cd\u91cf"\u538b\u6241\u6210\u66f4\u5c11\u751a\u81f3\u5355\u7ec4\u3002\u6b64\u65f6\u5347\u7ea7\u5230 LLM \u515c\u5e95\u91cd\u89e3\u3002
 *
 * \u6bd4\u8f83\u7684\u662f"\u4e0d\u540c\u91cd\u91cf\u7684\u4e2a\u6570"\u800c\u975e\u5177\u4f53\u6570\u503c\uff0c\u56e0\u6b64\u5bf9\u78c5\u2194\u516c\u65a4\u6362\u7b97\uff08\u89c4\u5219\u89e3\u6790\u4f1a\u6362\u7b97\u3001\u539f\u6587\u4e0d\u4f1a\uff09\u5b89\u5168\u3002
 *
 * @param result - \u89c4\u5219\u89e3\u6790\u7ed3\u679c
 * @param text - \u7528\u6237\u539f\u59cb\u8f93\u5165\u6587\u672c
 * @returns \u662f\u5426\u7591\u4f3c\u628a\u53d8\u7ec4\u538b\u6241\u3001\u9700\u8981 LLM \u515c\u5e95
 */
function likelyFlattenedVariedSets(
  result: WorkoutIntakeParseResponse,
  text: string,
): boolean {
  const mentionedDistinctWeights = countDistinctMentionedWeights(text);
  const parsedDistinctWeights = countDistinctParsedWeights(result);

  return (
    mentionedDistinctWeights >= MIN_DISTINCT_WEIGHTS_FOR_VARIED_SET_CHECK &&
    mentionedDistinctWeights > parsedDistinctWeights
  );
}

function countDistinctMentionedWeights(text: string): number {
  const weights = new Set<string>();

  for (const match of text.matchAll(WEIGHT_MENTION_PATTERN)) {
    if (match[1] !== undefined) {
      weights.add(match[1]);
    }
  }

  for (const match of text.matchAll(WEIGHT_BEFORE_REPS_PAIR_PATTERN)) {
    if (match[1] !== undefined) {
      weights.add(match[1]);
    }
  }

  return weights.size;
}

function countDistinctParsedWeights(
  result: WorkoutIntakeParseResponse,
): number {
  const weights = new Set<number>();

  for (const exercise of result.draft.exercises) {
    for (const set of exercise.sets) {
      if (set.weight_kg > 0) {
        weights.add(set.weight_kg);
      }
    }
  }

  return weights.size;
}

function buildResponseFromLlmOutput(
  input: WorkoutIntakeParseRequest,
  ruleResult: WorkoutIntakeParseResponse,
  exerciseDictionary: WorkoutIntakeExerciseDictionaryItem[],
  llmOutput: LlmWorkoutIntakeOutput,
): WorkoutIntakeParseResponse {
  const exercises = llmOutput.exercises.map((exercise) => {
    const match = matchExercise(exercise.spoken_name, exerciseDictionary);

    return {
      input_name: exercise.spoken_name,
      ...match,
      incomplete_sets: exercise.incomplete_sets.map((incompleteSet) => ({
        ...incompleteSet,
        message: buildIncompleteSetMessage(incompleteSet),
      })),
      sets: exercise.sets.map((set) => ({
        intensity_label: null,
        reps: set.reps,
        rpe: null,
        weight_kg: set.weight_kg,
      })),
    };
  });
  const unresolvedItems: WorkoutIntakeParseResponse["unresolved_items"] = [];

  for (const exercise of exercises) {
    if (exercise.match_status === "unresolved") {
      unresolvedItems.push({ reason: "no_candidates", text: exercise.input_name });
      continue;
    }

    if (exercise.match_status === "ambiguous") {
      unresolvedItems.push({
        reason: "multiple_candidates",
        text: exercise.input_name,
      });
      continue;
    }

    if (exercise.incomplete_sets.length > 0) {
      unresolvedItems.push({
        reason: "incomplete_sets",
        text: exercise.input_name,
      });
      continue;
    }

    if (exercise.sets.length === 0) {
      unresolvedItems.push({ reason: "no_sets", text: exercise.input_name });
    }
  }
  const response = {
    draft: {
      date_label: ruleResult.draft.date_label,
      date_source: ruleResult.draft.date_source,
      duration_min: input.duration_min ?? ruleResult.draft.duration_min,
      exercises,
      note: input.note ?? ruleResult.draft.note,
      performed_at: ruleResult.draft.performed_at,
    },
    evidence: {
      fallback_warnings: [],
      parser_version: "natural-language-intake-v1" as const,
      rules: ruleResult.evidence.rules,
      source: "llm_structured_fallback" as const,
    },
    unresolved_items: unresolvedItems,
    warnings: [...llmOutput.warnings, ...buildWarnings(unresolvedItems)],
  };

  return workoutIntakeParseResponseSchema.parse(response);
}

function markFallbackUnavailable(
  result: WorkoutIntakeParseResponse,
  fallbackWarnings: string[],
): WorkoutIntakeParseResponse {
  return workoutIntakeParseResponseSchema.parse({
    ...result,
    evidence: {
      ...result.evidence,
      fallback_warnings: fallbackWarnings,
      source: "rule_parser_llm_unavailable",
    },
    warnings: [...result.warnings, ...fallbackWarnings],
  });
}

function buildWarnings(
  unresolvedItems: WorkoutIntakeParseResponse["unresolved_items"],
): string[] {
  const warnings: string[] = [];

  if (unresolvedItems.some((item) => item.reason === "multiple_candidates")) {
    warnings.push("\u90e8\u5206\u52a8\u4f5c\u6709\u591a\u4e2a\u5019\u9009\uff0c\u9700\u8981\u4f60\u786e\u8ba4\u540e\u518d\u4fdd\u5b58\u3002");
  }

  if (unresolvedItems.some((item) => item.reason === "no_candidates")) {
    warnings.push("\u6709\u52a8\u4f5c\u6ca1\u6709\u8bc6\u522b\u5230\u6807\u51c6\u52a8\u4f5c\uff0c\u8bf7\u9009\u62e9\u6807\u51c6\u52a8\u4f5c\u6216\u5220\u9664\u8be5\u884c\u3002");
  }

  if (unresolvedItems.some((item) => item.reason === "no_sets")) {
    warnings.push("\u6709\u52a8\u4f5c\u6ca1\u6709\u89e3\u6790\u51fa\u6709\u6548\u7ec4\uff0c\u8bf7\u8865\u5145\u91cd\u91cf\u548c\u6b21\u6570\u540e\u518d\u4fdd\u5b58\u3002");
  }

  if (unresolvedItems.some((item) => item.reason === "incomplete_sets")) {
    warnings.push(
      "\u6709\u7ec4\u6570\u4fe1\u606f\u4e0d\u5b8c\u6574\uff0c\u8bf7\u8865\u5145\u91cd\u91cf\u6216\u6b21\u6570\u540e\u518d\u4fdd\u5b58\u3002",
    );
  }

  return warnings;
}

function buildIncompleteSetMessage(input: {
  group_count: number | null;
  weight_kg: number | null;
  reps: number | null;
  missing_fields: Array<"weight_kg" | "reps">;
}): string {
  const recognizedParts: string[] = [];

  if (input.group_count !== null) {
    recognizedParts.push(`${input.group_count} \u7ec4`);
  }

  if (input.weight_kg !== null) {
    recognizedParts.push(`\u6bcf\u7ec4 ${input.weight_kg}kg`);
  }

  if (input.reps !== null) {
    recognizedParts.push(`\u6bcf\u7ec4 ${input.reps} \u6b21`);
  }

  const missingCopy = input.missing_fields
    .map((field) => (field === "reps" ? "\u6bcf\u7ec4\u6b21\u6570" : "\u91cd\u91cf"))
    .join("\u548c");
  const recognizedCopy =
    recognizedParts.length > 0
      ? recognizedParts.join("\uff0c")
      : "\u90e8\u5206\u7ec4\u6570\u4fe1\u606f";

  return `\u5df2\u8bc6\u522b ${recognizedCopy}\uff0c\u4f46\u7f3a\u5c11${missingCopy}\uff0c\u8bf7\u8865\u5145\u540e\u91cd\u65b0\u89e3\u6790\u3002`;
}
