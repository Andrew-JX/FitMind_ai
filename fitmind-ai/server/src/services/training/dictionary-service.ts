import { z } from "zod";

import {
  listMuscleGroups,
  searchExercises,
} from "../../db/repositories/index.js";

const muscleGroupRowSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  nameEn: z.string().min(1),
  nameZh: z.string().min(1),
  parentId: z.string().uuid().nullable(),
  recoveryHours: z.number().int().nonnegative(),
  createdAt: z.unknown(),
});

const exerciseMuscleRowSchema = z.object({
  code: z.string().min(1),
  contributionWeight: z.coerce.number().min(0).max(1),
  isPrimary: z.boolean(),
});

const exerciseRowSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  nameEn: z.string().min(1),
  nameZh: z.string().min(1),
  movementPattern: z.string().nullable(),
  equipment: z.string().nullable(),
  isCompound: z.boolean().optional(),
  defaultRestSeconds: z.number().int().positive().nullable().optional(),
  techniqueCuesZh: z.array(z.string()),
  commonMistakesZh: z.array(z.string()),
  equipmentNotesZh: z.string().nullable(),
  muscles: z.array(exerciseMuscleRowSchema),
});

export interface ListMuscleGroupsResult {
  items: Array<{
    id: string;
    code: string;
    name_en: string;
    name_zh: string;
    recovery_hours: number;
  }>;
}

export interface SearchExercisesInput {
  q?: string | undefined;
  muscle?: string | undefined;
}

export interface SearchExercisesResult {
  items: Array<{
    id: string;
    code: string;
    name_en: string;
    name_zh: string;
    movement_pattern: string | null;
    equipment: string | null;
    is_compound: boolean;
    default_rest_seconds: number;
    technique_cues_zh: string[];
    common_mistakes_zh: string[];
    equipment_notes_zh: string | null;
    muscles: Array<{
      code: string;
      contribution_weight: number;
      is_primary: boolean;
    }>;
  }>;
}

/**
 * List all muscle groups for dictionary lookup.
 *
 * @returns Dictionary response payload for muscle groups.
 */
export async function listDictionaryMuscleGroups(): Promise<ListMuscleGroupsResult> {
  const rows = z.array(muscleGroupRowSchema).parse(await listMuscleGroups());

  return {
    items: rows.map((parsedRow) => {
      return {
        id: parsedRow.id,
        code: parsedRow.code,
        name_en: parsedRow.nameEn,
        name_zh: parsedRow.nameZh,
        recovery_hours: parsedRow.recoveryHours,
      };
    }),
  };
}

/**
 * Search exercise dictionary items by keyword and optional muscle code.
 *
 * @param input - Search filters.
 * @returns Dictionary response payload for exercises.
 */
export async function searchDictionaryExercises(
  input: SearchExercisesInput,
): Promise<SearchExercisesResult> {
  const rows = z.array(exerciseRowSchema).parse(
    await searchExercises({
      q: input.q,
      muscleCode: input.muscle,
    }),
  );

  return {
    items: rows.map((parsedRow) => {
      return {
        id: parsedRow.id,
        code: parsedRow.code,
        name_en: parsedRow.nameEn,
        name_zh: parsedRow.nameZh,
        movement_pattern: parsedRow.movementPattern,
        equipment: parsedRow.equipment,
        is_compound: parsedRow.isCompound ?? false,
        default_rest_seconds: parsedRow.defaultRestSeconds ?? 90,
        technique_cues_zh: parsedRow.techniqueCuesZh,
        common_mistakes_zh: parsedRow.commonMistakesZh,
        equipment_notes_zh: parsedRow.equipmentNotesZh,
        muscles: parsedRow.muscles.map((muscle) => ({
          code: muscle.code,
          contribution_weight: muscle.contributionWeight,
          is_primary: muscle.isPrimary,
        })),
      };
    }),
  };
}
