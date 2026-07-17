import {
  BROAD_EXERCISE_ALIASES,
  SYSTEM_EXERCISE_ALIASES,
} from "./exercise-aliases.js";

export interface ExerciseMatchingDictionaryItem {
  id: string;
  code: string;
  name_en: string;
  name_zh: string;
}

export interface ExerciseMatchCandidate {
  exercise_id: string;
  exercise_name: string;
  confidence: number;
}

export interface ExerciseMatchResult {
  candidate_exercises: ExerciseMatchCandidate[];
  matched_exercise_id: string | null;
  matched_exercise_name: string | null;
  match_confidence: number;
  match_status: "matched" | "ambiguous" | "unresolved";
}

interface ExerciseMentionSpan {
  end: number;
  phrase: string;
  start: number;
}

interface CandidateCodeMatch {
  code: string;
  confidence: number;
}

const CHINESE_EXERCISE_DISPLAY_BY_CODE: Record<string, string> = {
  barbell_curl: "\u6760\u94c3\u5f2f\u4e3e",
  barbell_row: "\u6760\u94c3\u5212\u8239",
  bench_press_barbell: "\u6760\u94c3\u5367\u63a8",
  bench_press_dumbbell: "\u54d1\u94c3\u5367\u63a8",
  cable_crunch: "\u7ef3\u7d22\u5377\u8179",
  cable_fly: "\u7ef3\u7d22\u5939\u80f8",
  chest_fly_machine: "\u8774\u8776\u673a\u5939\u80f8",
  chin_up_bodyweight: "\u53cd\u624b\u5f15\u4f53",
  deadlift_barbell: "\u6760\u94c3\u786c\u62c9",
  dumbbell_curl: "\u54d1\u94c3\u5f2f\u4e3e",
  dumbbell_row: "\u54d1\u94c3\u5212\u8239",
  face_pull_cable: "\u7ef3\u7d22\u9762\u62c9",
  front_raise_dumbbell: "\u54d1\u94c3\u524d\u5e73\u4e3e",
  hammer_curl_dumbbell: "\u9524\u5f0f\u5f2f\u4e3e",
  hip_thrust_barbell: "\u6760\u94c3\u81c0\u63a8",
  incline_bench_press_barbell: "\u4e0a\u659c\u6760\u94c3\u5367\u63a8",
  incline_bench_press_dumbbell: "\u4e0a\u659c\u54d1\u94c3\u5367\u63a8",
  lateral_raise_dumbbell: "\u54d1\u94c3\u4fa7\u5e73\u4e3e",
  lat_pulldown_cable: "\u9ad8\u4f4d\u4e0b\u62c9",
  leg_curl_machine: "\u5668\u68b0\u817f\u5f2f\u4e3e",
  leg_extension_machine: "\u5668\u68b0\u817f\u5c48\u4f38",
  leg_press_machine: "\u817f\u4e3e",
  pull_up_bodyweight: "\u5f15\u4f53\u5411\u4e0a",
  rear_delt_fly_machine: "\u5668\u68b0\u53cd\u5411\u98de\u9e1f",
  romanian_deadlift_barbell: "\u6760\u94c3\u7f57\u9a6c\u5c3c\u4e9a\u786c\u62c9",
  seated_cable_row: "\u5750\u59ff\u5212\u8239",
  seated_dumbbell_shoulder_press: "\u5750\u59ff\u54d1\u94c3\u63a8\u80a9",
  shoulder_press_barbell: "\u6760\u94c3\u63a8\u80a9",
  shoulder_press_dumbbell: "\u54d1\u94c3\u63a8\u80a9",
  standing_calf_raise_machine: "\u7ad9\u59ff\u63d0\u8e35",
  straight_arm_pulldown_cable: "\u76f4\u81c2\u4e0b\u538b",
  triceps_pushdown_cable: "\u7ef3\u7d22\u4e0b\u538b",
};

const UNSAFE_CHINESE_FALLBACK_TERMS = new Set([
  "\u62c9",
  "\u63a8",
  "\u4e3e",
  "\u7ec3",
  "\u505a",
  "\u80cc",
  "\u80f8",
  "\u817f",
  "\u80a9",
]);

/**
 * Match a user-provided exercise phrase against dictionary names and aliases.
 *
 * @param inputName - Natural-language exercise name extracted by the parser.
 * @param dictionary - Exercise dictionary items available in the system.
 * @returns Conservative match result for draft assembly.
 */
export function matchExercise(
  inputName: string,
  dictionary: ExerciseMatchingDictionaryItem[],
): ExerciseMatchResult {
  const normalizedInput = normalizeForMatch(inputName);

  if (normalizedInput.length === 0) {
    return buildUnresolvedResult();
  }

  const exactStandardMatches = dictionary.filter((exercise) =>
    getStandardMatchKeys(exercise).some((key) => key === normalizedInput),
  );

  if (exactStandardMatches.length > 0) {
    return buildResultFromItems(exactStandardMatches, 1);
  }

  const aliasMatches = resolveAliasMatches(normalizedInput);

  if (aliasMatches.length > 0) {
    return buildResultFromCodes(aliasMatches, dictionary);
  }

  if (isUnsafeChineseFallbackInput(inputName, normalizedInput)) {
    return buildUnresolvedResult();
  }

  const containsMatches = dictionary.filter((exercise) =>
    getFallbackMatchKeys(exercise).some(
      (key) => key.includes(normalizedInput) || normalizedInput.includes(key),
    ),
  );

  if (containsMatches.length > 0) {
    return buildAmbiguousResultFromItems(containsMatches, 0.68);
  }

  return buildUnresolvedResult();
}

/**
 * Match exercise mentions embedded in a complete user message.
 *
 * Candidate phrases come only from the exercise dictionary and the existing
 * alias maps. Selected phrases are passed back through {@link matchExercise},
 * so alias-to-code and confidence decisions continue to have one source of
 * truth. Longest spans win before overlaps are removed.
 *
 * @param message - Complete natural-language user message.
 * @param dictionary - Exercise dictionary items available in the system.
 * @returns Aggregated conservative match, or `null` when no known mention exists.
 */
export function matchExerciseMentions(
  message: string,
  dictionary: ExerciseMatchingDictionaryItem[],
): ExerciseMatchResult | null {
  const normalizedMessage = normalizeForMatch(message);

  if (normalizedMessage.length === 0) {
    return null;
  }

  const selectedMentions = selectLongestNonOverlappingMentions(
    normalizedMessage,
    buildMentionPhrases(dictionary),
  );

  if (selectedMentions.length === 0) {
    return null;
  }

  return aggregateMentionMatches(
    selectedMentions.map((mention) =>
      matchExercise(mention.phrase, dictionary),
    ),
  );
}

function buildMentionPhrases(
  dictionary: ExerciseMatchingDictionaryItem[],
): string[] {
  const phrases = new Set<string>();

  for (const exercise of dictionary) {
    for (const key of getFallbackMatchKeys(exercise)) {
      if (key.length >= 2) {
        phrases.add(key);
      }
    }
  }

  for (const aliases of Object.values(SYSTEM_EXERCISE_ALIASES)) {
    for (const alias of aliases) {
      const normalizedAlias = normalizeForMatch(alias);
      if (normalizedAlias.length >= 2) {
        phrases.add(normalizedAlias);
      }
    }
  }

  for (const alias of Object.keys(BROAD_EXERCISE_ALIASES)) {
    const normalizedAlias = normalizeForMatch(alias);
    if (normalizedAlias.length >= 2) {
      phrases.add(normalizedAlias);
    }
  }

  return [...phrases];
}

function selectLongestNonOverlappingMentions(
  normalizedMessage: string,
  phrases: string[],
): ExerciseMentionSpan[] {
  const possibleMentions: ExerciseMentionSpan[] = [];

  for (const phrase of phrases) {
    let start = normalizedMessage.indexOf(phrase);

    while (start !== -1) {
      possibleMentions.push({
        end: start + phrase.length,
        phrase,
        start,
      });
      start = normalizedMessage.indexOf(phrase, start + 1);
    }
  }

  possibleMentions.sort(
    (left, right) =>
      right.phrase.length - left.phrase.length || left.start - right.start,
  );

  const selected: ExerciseMentionSpan[] = [];

  for (const mention of possibleMentions) {
    const overlaps = selected.some(
      (existing) =>
        mention.start < existing.end && mention.end > existing.start,
    );

    if (!overlaps) {
      selected.push(mention);
    }
  }

  return selected.sort((left, right) => left.start - right.start);
}

function aggregateMentionMatches(
  matches: ExerciseMatchResult[],
): ExerciseMatchResult {
  const candidates: ExerciseMatchCandidate[] = [];
  const seenExerciseIds = new Set<string>();

  for (const match of matches) {
    for (const candidate of match.candidate_exercises) {
      if (seenExerciseIds.has(candidate.exercise_id)) {
        continue;
      }

      seenExerciseIds.add(candidate.exercise_id);
      candidates.push(candidate);
    }
  }

  const limitedCandidates = candidates.slice(0, 5);

  if (limitedCandidates.length === 0) {
    return buildUnresolvedResult();
  }

  const onlyCandidate = limitedCandidates[0];
  const allMentionsMatched = matches.every(
    (match) => match.match_status === "matched",
  );

  if (limitedCandidates.length === 1 && onlyCandidate && allMentionsMatched) {
    return {
      candidate_exercises: limitedCandidates,
      matched_exercise_id: onlyCandidate.exercise_id,
      matched_exercise_name: onlyCandidate.exercise_name,
      match_confidence: onlyCandidate.confidence,
      match_status: "matched",
    };
  }

  return {
    candidate_exercises: limitedCandidates,
    matched_exercise_id: null,
    matched_exercise_name: null,
    match_confidence: limitedCandidates[0]?.confidence ?? 0,
    match_status: "ambiguous",
  };
}

function resolveAliasMatches(normalizedInput: string): CandidateCodeMatch[] {
  const exactSystemAliasMatches = Object.entries(SYSTEM_EXERCISE_ALIASES)
    .filter(([, aliases]) =>
      aliases.some((alias) => normalizeForMatch(alias) === normalizedInput),
    )
    .map(([code]) => ({
      code,
      confidence: 0.96,
    }));

  if (exactSystemAliasMatches.length > 0) {
    return exactSystemAliasMatches;
  }

  const broadAliases = Object.entries(BROAD_EXERCISE_ALIASES).find(
    ([alias]) => normalizeForMatch(alias) === normalizedInput,
  );

  if (broadAliases) {
    return broadAliases[1].map((code) => ({
      code,
      confidence: 0.82,
    }));
  }

  return [];
}

function buildResultFromCodes(
  matches: CandidateCodeMatch[],
  dictionary: ExerciseMatchingDictionaryItem[],
): ExerciseMatchResult {
  const rankedItems = matches
    .map((match) => {
      const exercise = dictionary.find((item) => item.code === match.code);

      return exercise ? { exercise, confidence: match.confidence } : null;
    })
    .filter(
      (
        value,
      ): value is {
        exercise: ExerciseMatchingDictionaryItem;
        confidence: number;
      } => value !== null,
    );

  return buildResultFromRankedItems(rankedItems);
}

function buildResultFromItems(
  matches: ExerciseMatchingDictionaryItem[],
  confidence: number,
): ExerciseMatchResult {
  return buildResultFromRankedItems(
    matches.map((exercise) => ({
      exercise,
      confidence,
    })),
  );
}

function buildResultFromRankedItems(
  matches: Array<{
    exercise: ExerciseMatchingDictionaryItem;
    confidence: number;
  }>,
): ExerciseMatchResult {
  const uniqueMatches = dedupeMatches(matches).slice(0, 5);

  if (uniqueMatches.length === 0) {
    return buildUnresolvedResult();
  }

  const candidates = uniqueMatches.map(({ exercise, confidence }) => ({
    exercise_id: exercise.id,
    exercise_name: getExerciseDisplayName(exercise),
    confidence,
  }));
  const firstMatch = uniqueMatches[0];

  if (uniqueMatches.length === 1 && firstMatch) {
    return {
      candidate_exercises: candidates,
      matched_exercise_id: firstMatch.exercise.id,
      matched_exercise_name: getExerciseDisplayName(firstMatch.exercise),
      match_confidence: firstMatch.confidence,
      match_status: "matched",
    };
  }

  return {
    candidate_exercises: candidates,
    matched_exercise_id: null,
    matched_exercise_name: null,
    match_confidence: candidates[0]?.confidence ?? 0,
    match_status: "ambiguous",
  };
}

function buildAmbiguousResultFromItems(
  matches: ExerciseMatchingDictionaryItem[],
  confidence: number,
): ExerciseMatchResult {
  const uniqueMatches = dedupeMatches(
    matches.map((exercise) => ({
      exercise,
      confidence,
    })),
  ).slice(0, 5);

  if (uniqueMatches.length === 0) {
    return buildUnresolvedResult();
  }

  return {
    candidate_exercises: uniqueMatches.map(({ exercise }) => ({
      confidence,
      exercise_id: exercise.id,
      exercise_name: getExerciseDisplayName(exercise),
    })),
    matched_exercise_id: null,
    matched_exercise_name: null,
    match_confidence: confidence,
    match_status: "ambiguous",
  };
}

function dedupeMatches(
  matches: Array<{
    exercise: ExerciseMatchingDictionaryItem;
    confidence: number;
  }>,
): Array<{
  exercise: ExerciseMatchingDictionaryItem;
  confidence: number;
}> {
  const seenCodes = new Set<string>();
  const deduped: Array<{
    exercise: ExerciseMatchingDictionaryItem;
    confidence: number;
  }> = [];

  for (const match of matches) {
    if (seenCodes.has(match.exercise.code)) {
      continue;
    }

    seenCodes.add(match.exercise.code);
    deduped.push(match);
  }

  return deduped;
}

function getStandardMatchKeys(
  exercise: ExerciseMatchingDictionaryItem,
): string[] {
  return [exercise.code, exercise.name_en, exercise.name_zh]
    .map((value) => normalizeForMatch(value))
    .filter((value) => value.length > 0);
}

function getFallbackMatchKeys(
  exercise: ExerciseMatchingDictionaryItem,
): string[] {
  return [
    ...getStandardMatchKeys(exercise),
    exercise.name_en.replace(/\b(barbell|dumbbell|cable|machine)\b/giu, ""),
    exercise.name_zh.replace(
      /\u6760\u94c3|\u54d1\u94c3|\u7ef3\u7d22|\u5668\u68b0/gu,
      "",
    ),
  ]
    .map((value) => normalizeForMatch(value))
    .filter((value) => value.length > 0);
}

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[_\-\s]/gu, "")
    .trim();
}

function isUnsafeChineseFallbackInput(
  inputName: string,
  normalizedInput: string,
): boolean {
  const hasChinese = /[\u4e00-\u9fff]/u.test(inputName);

  if (!hasChinese) {
    return false;
  }

  return (
    normalizedInput.length < 2 ||
    UNSAFE_CHINESE_FALLBACK_TERMS.has(normalizedInput)
  );
}

function getExerciseDisplayName(
  exercise: ExerciseMatchingDictionaryItem,
): string {
  const mappedChineseName = CHINESE_EXERCISE_DISPLAY_BY_CODE[exercise.code];

  if (mappedChineseName) {
    return mappedChineseName;
  }

  const trimmedChineseName = exercise.name_zh.trim();
  if (trimmedChineseName && /[\u4e00-\u9fff]/u.test(trimmedChineseName)) {
    return trimmedChineseName;
  }

  return exercise.name_en;
}

function buildUnresolvedResult(): ExerciseMatchResult {
  return {
    candidate_exercises: [],
    matched_exercise_id: null,
    matched_exercise_name: null,
    match_confidence: 0,
    match_status: "unresolved",
  };
}
