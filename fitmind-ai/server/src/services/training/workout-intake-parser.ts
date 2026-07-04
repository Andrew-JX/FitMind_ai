import {
  workoutIntakeParseResponseSchema,
  type WorkoutIntakeParseRequest,
  type WorkoutIntakeParseResponse,
} from "../../schemas/workout-intake-schemas.js";
import {
  BROAD_EXERCISE_ALIASES,
  SYSTEM_EXERCISE_ALIASES,
} from "./exercise-aliases.js";
import {
  matchExercise,
  type ExerciseMatchingDictionaryItem,
  type ExerciseMatchResult,
} from "./exercise-matching-service.js";
import { parseWorkoutDateHint } from "./workout-intake-date-parser.js";

export type WorkoutIntakeExerciseDictionaryItem =
  ExerciseMatchingDictionaryItem;

interface ParsedSetDraft {
  weight_kg: number;
  reps: number;
  rpe: null;
  intensity_label: null;
}

interface ParsedIncompleteSetDraft {
  group_count: number | null;
  weight_kg: number | null;
  reps: number | null;
  missing_fields: Array<"weight_kg" | "reps">;
  message: string;
}

interface ParsedSegmentSets {
  incomplete_sets: ParsedIncompleteSetDraft[];
  sets: ParsedSetDraft[];
}

type UnresolvedItem = WorkoutIntakeParseResponse["unresolved_items"][number];

const PARSER_VERSION = "natural-language-intake-v1";

const PARSER_RULES = [
  "This endpoint only generates a workout draft and does not write workout records.",
  "Exercise names are matched against the existing exercise dictionary and system aliases.",
  "Ambiguous exercise matches must be confirmed by the user.",
] as const;

const CHINESE_NUMERALS = new Map<string, number>([
  ["\u96f6", 0],
  ["\u4e00", 1],
  ["\u4e8c", 2],
  ["\u4e24", 2],
  ["\u4e09", 3],
  ["\u56db", 4],
  ["\u4e94", 5],
  ["\u516d", 6],
  ["\u4e03", 7],
  ["\u516b", 8],
  ["\u4e5d", 9],
  ["\u5341", 10],
]);

const SET_PAIR_PATTERN =
  /(\d+(?:\.\d+)?)\s*(?:(?:kg\s*x)|x|(?:kg\s*(?:\u505a\s*)?))\s*(\d+)\s*(?:reps?)?/giu;
const REPEAT_COUNT_PATTERN = /(\d+)\s*\u7ec4/u;
const WEIGHT_PATTERN = /(\d+(?:\.\d+)?)\s*kg/iu;
const REPS_PATTERN = /(?:\u505a\s*)?(\d+)\s*reps/iu;
const CONTEXT_ONLY_PATTERN =
  /^(?:\u6211|\u4eca\u5929|\u6628\u5929|\u8bad\u7ec3|\u7ec3\u4e86|\u8fd8|\u80cc\u90e8|\u80f8\u90e8|\u817f\u90e8|\u80a9\u90e8|\u624b\u81c2|\u6838\u5fc3|\u6bcf\u7ec4|\u7136\u540e|\u7684\u8bdd|\u662f\u7528|\u7528|\u505a\u4e86|\u505a|\u7684|\s)+$/u;
const CONTEXT_WORDS_PATTERN =
  /\u8bad\u7ec3\u4e86?|\u7ec3\u4e86?|\u505a\u4e86?|\u6bcf\u7ec4|\u7136\u540e|\u7684\u8bdd|\u662f\u7528|\u7528|\u80cc\u90e8|\u80f8\u90e8|\u817f\u90e8|\u80a9\u90e8|\u624b\u81c2|\u6838\u5fc3|\u4eca\u5929|\u6628\u5929|\u6211|\u8fd8/gu;

/**
 * Parse a natural-language workout description into a deterministic draft.
 *
 * @param input - Validated natural-language intake request.
 * @param exerciseDictionary - Exercise dictionary rows used for matching.
 * @param now - Clock source for default performed_at.
 * @returns A Zod-validated workout draft response.
 */
export function parseWorkoutIntakeDraft(
  input: WorkoutIntakeParseRequest,
  exerciseDictionary: WorkoutIntakeExerciseDictionaryItem[],
  now = new Date(),
): WorkoutIntakeParseResponse {
  const normalizedText = normalizeIntakeText(input.text);
  const dateResult = parseWorkoutDateHint(
    input.text,
    input.performed_at ?? now,
    input.performed_at ? "request_performed_at" : "server_default",
  );
  const segments = splitExerciseSegments(normalizedText, exerciseDictionary);
  const parsedExercises = segments
    .map((segment) => {
      const inputName = extractExerciseName(segment, exerciseDictionary);
      const match = matchExercise(inputName, exerciseDictionary);
      const parsedSets = parseSets(
        segment,
        isBodyweightMatch(match, exerciseDictionary),
      );

      return {
        input_name: inputName,
        ...match,
        incomplete_sets: parsedSets.incomplete_sets,
        sets: parsedSets.sets,
      };
    })
    .filter((exercise) => exercise.input_name.length > 0);
  const exercises = mergeIntakeExercises(parsedExercises);
  const unresolvedItems: UnresolvedItem[] = [];

  for (const exercise of exercises) {
    if (exercise.match_status === "unresolved") {
      unresolvedItems.push({
        text: exercise.input_name,
        reason: "no_candidates",
      });
      continue;
    }

    if (exercise.match_status === "ambiguous") {
      unresolvedItems.push({
        text: exercise.input_name,
        reason: "multiple_candidates",
      });
      continue;
    }

    if (exercise.incomplete_sets.length > 0) {
      unresolvedItems.push({
        text: exercise.input_name,
        reason: "incomplete_sets",
      });
      continue;
    }

    if (exercise.sets.length === 0) {
      unresolvedItems.push({
        text: exercise.input_name,
        reason: "no_sets",
      });
    }
  }

  const response = {
    draft: {
      date_label: dateResult.date_label,
      date_source: dateResult.date_source,
      performed_at: dateResult.performed_at,
      duration_min: input.duration_min ?? null,
      note: input.note ?? null,
      exercises,
    },
    unresolved_items: unresolvedItems,
    warnings: buildWarnings(unresolvedItems),
    evidence: {
      fallback_warnings: [],
      parser_version: PARSER_VERSION,
      rules: [...PARSER_RULES],
      source: "rule_parser" as const,
    },
  };

  return workoutIntakeParseResponseSchema.parse(response);
}

function normalizeIntakeText(value: string): string {
  const decimalPlaceholder = "__FITMIND_DECIMAL__";

  return (
    value
      .normalize("NFKC")
      .replace(/(\d)\.(\d)/gu, `$1${decimalPlaceholder}$2`)
      .replace(
        /[\u96f6\u4e00\u4e8c\u4e24\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+(?=\s*(?:\u7ec4|\u4e2a|\u6b21|\u516c\u65a4|\u5343\u514b))/gu,
        (match) => String(parseChineseNumber(match)),
      )
      .replace(/\u516c\u65a4|\u5343\u514b/giu, "kg")
      .replace(/\u4e2a|\u6b21/giu, "reps")
      .replace(/[\u00d7\uff0a*]/gu, "x")
      .replace(/\u7136\u540e|\u63a5\u7740/giu, ";")
      // List connectors join multiple exercises; treat them as segment breaks.
      .replace(/\u8fd8\u6709|\u4ee5\u53ca|\u548c/gu, ";")
      .replace(/[.\u3002;\uff1b\n\r]/gu, ";")
      .replaceAll(decimalPlaceholder, ".")
      // Convert pounds to kilograms (drafts store weight_kg).
      .replace(
        /(\d+(?:\.\d+)?)\s*(?:\u78c5|lbs?)/giu,
        (_match, pounds: string) =>
          `${(Number(pounds) * 0.45359237).toFixed(1)}kg`,
      )
      // Commas / pause marks separate exercises, so treat them as segment breaks.
      // A name-only segment followed by its sets is re-merged in splitExerciseSegments.
      .replace(/[,，、]/gu, ";")
      .replace(/\s+/gu, " ")
      .trim()
  );
}

function parseChineseNumber(value: string): number {
  if (value === "\u5341") {
    return 10;
  }

  const tenIndex = value.indexOf("\u5341");

  if (tenIndex >= 0) {
    const beforeTen = value.slice(0, tenIndex);
    const afterTen = value.slice(tenIndex + 1);
    const tens = beforeTen === "" ? 1 : (CHINESE_NUMERALS.get(beforeTen) ?? 0);
    const ones = afterTen === "" ? 0 : (CHINESE_NUMERALS.get(afterTen) ?? 0);

    return tens * 10 + ones;
  }

  return CHINESE_NUMERALS.get(value) ?? 0;
}

/**
 * Whether a segment is only set details (weight/reps/group) with no exercise
 * name left after stripping set tokens and oral filler words.
 *
 * @param segment - A normalized segment.
 * @returns True when nothing name-like remains (so it belongs to the prior exercise).
 */
function isSetOnlyFragment(segment: string): boolean {
  const remainder = segment
    .replace(/\d+(?:\.\d+)?\s*kg/giu, " ")
    .replace(/\d+\s*reps?/giu, " ")
    .replace(/\d+\s*组/gu, " ")
    .replace(/\d+/gu, " ")
    .replace(CONTEXT_WORDS_PATTERN, " ")
    .replace(/[x是的了各\s,，、:：]/giu, "")
    .trim();

  return remainder.length === 0;
}

function splitExerciseSegments(
  value: string,
  exerciseDictionary: WorkoutIntakeExerciseDictionaryItem[],
): string[] {
  const rawSegments = value
    .split(";")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .flatMap((segment) =>
      splitRunOnExerciseSegment(segment, exerciseDictionary),
    );
  const segments: string[] = [];

  for (const segment of rawSegments) {
    if (isContextOnlySegment(segment)) {
      continue;
    }

    const hasKnownExercise =
      findKnownExercisePhrase(segment, exerciseDictionary) !== null;
    // A "set-only" fragment (e.g. "60kg8reps" or "每组70公斤" after a comma)
    // carries no exercise name, so it belongs to the previous exercise. But a
    // delimited segment that DOES have a name — even an unrecognized one like
    // "深蹲100kg5reps" — is its own exercise and must not be absorbed.
    if (
      !hasKnownExercise &&
      isSetOnlyFragment(segment) &&
      segments.length > 0 &&
      containsSetContext(segment)
    ) {
      segments[segments.length - 1] =
        `${segments[segments.length - 1]} ${segment}`;
      continue;
    }

    segments.push(segment);
  }

  return segments;
}

type ParsedIntakeExercise = ExerciseMatchResult & {
  input_name: string;
  incomplete_sets: ParsedSegmentSets["incomplete_sets"];
  sets: ParsedSegmentSets["sets"];
};

/**
 * Merge exercises that refer to the same movement into a single entry.
 *
 * @param exercises - Parsed exercises in document order.
 * @returns Deduplicated exercises with their sets combined.
 *
 * @remarks
 * Natural speech often names exercises up front ("I did A and B") and then
 * describes each one's sets later. Those produce a name-only entry plus a
 * detailed entry for the same movement; merging by matched id (or normalized
 * input name) collapses them and concatenates sets. A concrete match is kept
 * over an earlier ambiguous/unresolved mention.
 */
function mergeIntakeExercises(
  exercises: ParsedIntakeExercise[],
): ParsedIntakeExercise[] {
  const byKey = new Map<string, ParsedIntakeExercise>();
  const merged: ParsedIntakeExercise[] = [];

  for (const exercise of exercises) {
    const key =
      exercise.matched_exercise_id ??
      normalizeExercisePhrase(exercise.input_name);
    const existing = byKey.get(key);

    if (existing === undefined) {
      const copy: ParsedIntakeExercise = {
        ...exercise,
        sets: [...exercise.sets],
        incomplete_sets: [...exercise.incomplete_sets],
      };
      byKey.set(key, copy);
      merged.push(copy);
      continue;
    }

    existing.sets.push(...exercise.sets);
    existing.incomplete_sets.push(...exercise.incomplete_sets);

    if (
      existing.match_status !== "matched" &&
      exercise.match_status === "matched"
    ) {
      existing.match_status = exercise.match_status;
      existing.matched_exercise_id = exercise.matched_exercise_id;
      existing.matched_exercise_name = exercise.matched_exercise_name;
      existing.candidate_exercises = exercise.candidate_exercises;
      existing.input_name = exercise.input_name;
    }
  }

  return merged;
}

/**
 * Split a delimiter-free run-on segment that lists multiple exercises.
 *
 * @param segment - A single normalized segment (no `;` delimiters).
 * @param exerciseDictionary - Exercise dictionary used to locate known phrases.
 * @returns One or more sub-segments, each beginning at an exercise phrase.
 *
 * @remarks
 * Handles continuous speech like "卧推50kg8reps深蹲100kg5reps" that arrives
 * without punctuation. To avoid splitting a single multi-word exercise name, a
 * cut is only made before a later exercise phrase when set context (weight /
 * reps / 组) appeared since the previous cut.
 */
function splitRunOnExerciseSegment(
  segment: string,
  exerciseDictionary: WorkoutIntakeExerciseDictionaryItem[],
): string[] {
  const candidates = buildExercisePhraseCandidates(exerciseDictionary);
  const lowerSegment = segment.toLowerCase();
  const phraseStarts: number[] = [];

  for (let index = 0; index < segment.length; ) {
    const matched = candidates.find(
      (candidate) =>
        candidate.length > 0 &&
        lowerSegment.startsWith(candidate.toLowerCase(), index),
    );

    if (matched) {
      phraseStarts.push(index);
      index += matched.length;
      continue;
    }

    index += 1;
  }

  if (phraseStarts.length <= 1) {
    return [segment];
  }

  const cutPoints = [0];

  for (let position = 1; position < phraseStarts.length; position += 1) {
    const previousCut = cutPoints[cutPoints.length - 1] ?? 0;
    const between = segment.slice(previousCut, phraseStarts[position]);

    if (containsSetContext(between)) {
      cutPoints.push(phraseStarts[position] ?? 0);
    }
  }

  if (cutPoints.length <= 1) {
    return [segment];
  }

  const pieces: string[] = [];

  for (let index = 0; index < cutPoints.length; index += 1) {
    const start = cutPoints[index] ?? 0;
    const end = cutPoints[index + 1] ?? segment.length;
    const piece = segment.slice(start, end).trim();

    if (piece.length > 0) {
      pieces.push(piece);
    }
  }

  return pieces;
}

function parseSets(
  segment: string,
  isBodyweightExercise: boolean,
): ParsedSegmentSets {
  const repeatCount = parseRepeatCount(segment);
  const pairMatches = [...segment.matchAll(SET_PAIR_PATTERN)]
    .map((match) => {
      const weight = Number(match[1] ?? "");
      const reps = Number(match[2] ?? "");

      return Number.isFinite(weight) &&
        weight > 0 &&
        Number.isInteger(reps) &&
        reps > 0
        ? {
            weight_kg: weight,
            reps,
            rpe: null,
            intensity_label: null,
          }
        : null;
    })
    .filter((set): set is ParsedSetDraft => set !== null);
  const singleSet = pairMatches[0];

  if (repeatCount !== null && pairMatches.length === 1 && singleSet) {
    return {
      incomplete_sets: [],
      sets: Array.from({ length: repeatCount }, () => ({ ...singleSet })),
    };
  }

  if (pairMatches.length > 0) {
    return {
      incomplete_sets: [],
      sets: pairMatches,
    };
  }

  const aggregateSet = parseAggregateRepeatedSet(
    segment,
    repeatCount,
    isBodyweightExercise,
  );
  if (aggregateSet) {
    return {
      incomplete_sets: [],
      sets: Array.from({ length: aggregateSet.group_count }, () => ({
        intensity_label: null,
        reps: aggregateSet.reps,
        rpe: null,
        weight_kg: aggregateSet.weight_kg,
      })),
    };
  }

  const incompleteSet = parseIncompleteSet(segment, repeatCount);

  return {
    incomplete_sets: incompleteSet ? [incompleteSet] : [],
    sets: [],
  };
}

function parseAggregateRepeatedSet(
  segment: string,
  repeatCount: number | null,
  isBodyweightExercise: boolean,
): { group_count: number; weight_kg: number; reps: number } | null {
  if (repeatCount === null) {
    return null;
  }

  const weight = parseFirstPositiveNumber(segment, WEIGHT_PATTERN);
  const reps = parseFirstPositiveInteger(segment, REPS_PATTERN);

  if ((weight === null && !isBodyweightExercise) || reps === null) {
    return null;
  }

  return {
    group_count: repeatCount,
    reps,
    weight_kg: weight ?? 0,
  };
}

function parseRepeatCount(segment: string): number | null {
  const match = REPEAT_COUNT_PATTERN.exec(segment);
  const value = Number(match?.[1] ?? "");

  return Number.isInteger(value) && value > 0 ? value : null;
}

function parseIncompleteSet(
  segment: string,
  repeatCount: number | null,
): ParsedIncompleteSetDraft | null {
  const weight = parseFirstPositiveNumber(segment, WEIGHT_PATTERN);
  const reps = parseFirstPositiveInteger(segment, REPS_PATTERN);
  const missingFields: Array<"weight_kg" | "reps"> = [];

  if (weight === null) {
    missingFields.push("weight_kg");
  }

  if (reps === null) {
    missingFields.push("reps");
  }

  if (
    missingFields.length === 0 ||
    (repeatCount === null && weight === null && reps === null)
  ) {
    return null;
  }

  return {
    group_count: repeatCount,
    weight_kg: weight,
    reps,
    missing_fields: missingFields,
    message: buildIncompleteSetMessage(
      repeatCount,
      weight,
      reps,
      missingFields,
    ),
  };
}

function parseFirstPositiveNumber(
  value: string,
  pattern: RegExp,
): number | null {
  const match = pattern.exec(value);
  pattern.lastIndex = 0;
  const parsed = Number(match?.[1] ?? "");

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseFirstPositiveInteger(
  value: string,
  pattern: RegExp,
): number | null {
  const parsed = parseFirstPositiveNumber(value, pattern);

  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function extractExerciseName(
  segment: string,
  exerciseDictionary: WorkoutIntakeExerciseDictionaryItem[],
): string {
  const knownPhrase = findKnownExercisePhrase(segment, exerciseDictionary);

  if (knownPhrase) {
    return knownPhrase;
  }

  const firstSetMatch = SET_PAIR_PATTERN.exec(segment);
  SET_PAIR_PATTERN.lastIndex = 0;
  const beforeSets =
    firstSetMatch?.index === undefined
      ? segment
      : segment.slice(0, firstSetMatch.index);

  return beforeSets
    .replace(CONTEXT_WORDS_PATTERN, " ")
    .replace(/\d+\s*\u7ec4/gu, "")
    .replace(/[:：]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function buildWarnings(
  unresolvedItems: WorkoutIntakeParseResponse["unresolved_items"],
): string[] {
  const warnings: string[] = [];

  if (unresolvedItems.some((item) => item.reason === "multiple_candidates")) {
    warnings.push(
      "\u90e8\u5206\u52a8\u4f5c\u6709\u591a\u4e2a\u5019\u9009\uff0c\u9700\u8981\u4f60\u786e\u8ba4\u540e\u518d\u4fdd\u5b58\u3002",
    );
  }

  if (unresolvedItems.some((item) => item.reason === "no_candidates")) {
    warnings.push(
      "\u6709\u52a8\u4f5c\u6ca1\u6709\u8bc6\u522b\u5230\u6807\u51c6\u52a8\u4f5c\uff0c\u8bf7\u9009\u62e9\u6807\u51c6\u52a8\u4f5c\u6216\u5220\u9664\u8be5\u884c\u3002",
    );
  }

  if (unresolvedItems.some((item) => item.reason === "no_sets")) {
    warnings.push(
      "\u6709\u52a8\u4f5c\u6ca1\u6709\u89e3\u6790\u51fa\u6709\u6548\u7ec4\uff0c\u8bf7\u8865\u5145\u91cd\u91cf\u548c\u6b21\u6570\u540e\u518d\u4fdd\u5b58\u3002",
    );
  }

  if (unresolvedItems.some((item) => item.reason === "incomplete_sets")) {
    warnings.push(
      "\u6709\u7ec4\u6570\u4fe1\u606f\u4e0d\u5b8c\u6574\uff0c\u8bf7\u8865\u5145\u91cd\u91cf\u6216\u6b21\u6570\u540e\u518d\u4fdd\u5b58\u3002",
    );
  }

  return warnings;
}

function isBodyweightMatch(
  match: ReturnType<typeof matchExercise>,
  exerciseDictionary: WorkoutIntakeExerciseDictionaryItem[],
): boolean {
  if (match.match_status !== "matched" || !match.matched_exercise_id) {
    return false;
  }

  const exercise = exerciseDictionary.find(
    (item) => item.id === match.matched_exercise_id,
  );

  return exercise ? isBodyweightCode(exercise.code) : false;
}

function isBodyweightCode(code: string): boolean {
  return (
    code.endsWith("_bodyweight") ||
    [
      "pull_up",
      "chin_up",
      "push_up",
      "dip",
      "crunch",
      "hanging_leg_raise",
      "russian_twist",
    ].some((bodyweightCode) => code.includes(bodyweightCode))
  );
}

function buildIncompleteSetMessage(
  groupCount: number | null,
  weightKg: number | null,
  reps: number | null,
  missingFields: Array<"weight_kg" | "reps">,
): string {
  const recognizedParts: string[] = [];

  if (groupCount !== null) {
    recognizedParts.push(`${groupCount} \u7ec4`);
  }

  if (weightKg !== null) {
    recognizedParts.push(`\u6bcf\u7ec4 ${weightKg}kg`);
  }

  if (reps !== null) {
    recognizedParts.push(`\u6bcf\u7ec4 ${reps} \u6b21`);
  }

  const missingCopy = missingFields
    .map((field) =>
      field === "reps" ? "\u6bcf\u7ec4\u6b21\u6570" : "\u91cd\u91cf",
    )
    .join("\u548c");
  const recognizedCopy =
    recognizedParts.length > 0
      ? recognizedParts.join("\uff0c")
      : "\u90e8\u5206\u7ec4\u6570\u4fe1\u606f";

  return `\u5df2\u8bc6\u522b ${recognizedCopy}\uff0c\u4f46\u7f3a\u5c11${missingCopy}\uff0c\u8bf7\u8865\u5145\u540e\u91cd\u65b0\u89e3\u6790\u3002`;
}

function containsSetContext(segment: string): boolean {
  return (
    REPEAT_COUNT_PATTERN.test(segment) ||
    WEIGHT_PATTERN.test(segment) ||
    REPS_PATTERN.test(segment)
  );
}

function isContextOnlySegment(segment: string): boolean {
  return CONTEXT_ONLY_PATTERN.test(segment.trim());
}

function findKnownExercisePhrase(
  segment: string,
  exerciseDictionary: WorkoutIntakeExerciseDictionaryItem[],
): string | null {
  const candidates = buildExercisePhraseCandidates(exerciseDictionary);
  const normalizedSegment = normalizeExercisePhrase(segment);

  return (
    candidates.find((candidate) =>
      normalizedSegment.includes(normalizeExercisePhrase(candidate)),
    ) ?? null
  );
}

function buildExercisePhraseCandidates(
  exerciseDictionary: WorkoutIntakeExerciseDictionaryItem[],
): string[] {
  const phrases = new Set<string>();

  for (const aliases of Object.values(SYSTEM_EXERCISE_ALIASES)) {
    for (const alias of aliases) {
      phrases.add(alias);
    }
  }

  for (const alias of Object.keys(BROAD_EXERCISE_ALIASES)) {
    phrases.add(alias);
  }

  for (const exercise of exerciseDictionary) {
    phrases.add(exercise.name_en);
    phrases.add(exercise.name_zh);
    phrases.add(exercise.code);
  }

  return [...phrases]
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 0)
    .sort((left, right) => right.length - left.length);
}

function normalizeExercisePhrase(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[_\-\s]/gu, "")
    .trim();
}
