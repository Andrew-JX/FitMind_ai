import { requestJson } from "../../services/http-client";

export interface DictionaryMuscleGroup {
  id: string;
  code: string;
  name_en: string;
  name_zh: string;
  recovery_hours: number;
}

export interface DictionaryExerciseMuscle {
  code: string;
  contribution_weight: number;
  is_primary: boolean;
}

export interface DictionaryExercise {
  id: string;
  code: string;
  name_en: string;
  name_zh: string;
  movement_pattern: string | null;
  equipment: string | null;
  muscles: DictionaryExerciseMuscle[];
}

interface ListMuscleGroupsResponseData {
  items: DictionaryMuscleGroup[];
}

interface SearchExercisesResponseData {
  items: DictionaryExercise[];
}

export interface SearchExercisesFilters {
  muscle?: string | undefined;
  q?: string | undefined;
}

/**
 * Loads all available muscle groups from the dictionary API.
 *
 * @returns The supported muscle groups list
 */
export async function listMuscleGroups(): Promise<DictionaryMuscleGroup[]> {
  const response = await requestJson<ListMuscleGroupsResponseData>("/api/muscle-groups");

  return response.items;
}

/**
 * Searches exercises by keyword and optional muscle code.
 *
 * @param filters - Search keyword and optional muscle filter
 * @returns Matching exercise dictionary items
 */
export async function searchExercises(
  filters: SearchExercisesFilters,
): Promise<DictionaryExercise[]> {
  const query = new URLSearchParams();

  if (filters.q?.trim()) {
    query.set("q", filters.q.trim());
  }

  if (filters.muscle?.trim()) {
    query.set("muscle", filters.muscle.trim());
  }

  const path = query.size > 0 ? `/api/exercises?${query.toString()}` : "/api/exercises";
  const response = await requestJson<SearchExercisesResponseData>(path);

  return response.items;
}
