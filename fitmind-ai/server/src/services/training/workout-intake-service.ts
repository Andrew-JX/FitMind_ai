import type { WorkoutIntakeParseRequest } from "../../schemas/workout-intake-schemas.js";
import { searchDictionaryExercises } from "./dictionary-service.js";
import { parseHybridWorkoutIntakeDraft } from "./workout-intake-hybrid-parser.js";
import {
  type WorkoutIntakeExerciseDictionaryItem,
} from "./workout-intake-parser.js";

/**
 * Parse natural-language workout text into a draft for the authenticated user.
 *
 * @param userId - Authenticated user id; request body/query user ids are ignored.
 * @param input - Validated natural-language intake request.
 * @returns Structured workout draft without creating any workout records.
 */
export async function parseUserWorkoutIntakeDraft(
  userId: string,
  input: WorkoutIntakeParseRequest,
) {
  void userId;

  const exercises = await searchDictionaryExercises({});
  const dictionary: WorkoutIntakeExerciseDictionaryItem[] = exercises.items.map(
    (exercise) => ({
      id: exercise.id,
      code: exercise.code,
      name_en: exercise.name_en,
      name_zh: exercise.name_zh,
    }),
  );

  return parseHybridWorkoutIntakeDraft(input, dictionary);
}
