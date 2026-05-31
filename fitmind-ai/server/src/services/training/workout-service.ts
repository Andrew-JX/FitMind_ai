import { z } from "zod";

import {
  addSetToWorkoutForUser,
  createWorkoutWithSets,
  deleteSetByIdForUser,
  deleteWorkoutByIdForUser,
  findWorkoutByIdForUser,
  hasSetById,
  hasWorkoutById,
  listWorkoutsByUser,
  updateSetByIdForUser,
  updateWorkoutByIdForUser,
} from "../../db/repositories/workouts-repository.js";
import { HttpError } from "../../utils/http-error.js";

const isoDateStringSchema = z.preprocess((value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}, z.string());

function normalizeNumericValue(value: unknown): unknown {
  if (typeof value === "string" && value.trim() !== "") {
    const parsedValue = Number(value);

    return Number.isNaN(parsedValue) ? value : parsedValue;
  }

  return value;
}

export interface WorkoutSetDto {
  id: string;
  exercise_id: string;
  set_index: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
  is_warmup: boolean;
  notes: string | null;
  created_at: string;
}

export interface WorkoutSummaryDto {
  id: string;
  performed_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  sets_count: number;
  muscle_groups: string[];
}

export interface WorkoutDetailDto {
  id: string;
  performed_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  sets: WorkoutSetDto[];
}

export interface CreateWorkoutRequest {
  performed_at: string;
  started_at?: string | null | undefined;
  ended_at?: string | null | undefined;
  duration_minutes?: number | undefined;
  notes?: string | undefined;
  sets: AddWorkoutSetRequest[];
}

export interface UpdateWorkoutRequest {
  performed_at?: string | undefined;
  started_at?: string | null | undefined;
  ended_at?: string | null | undefined;
  duration_minutes?: number | undefined;
  notes?: string | undefined;
}

export interface AddWorkoutSetRequest {
  exercise_id: string;
  set_index: number;
  reps: number;
  weight_kg: number;
  rpe?: number | undefined;
  is_warmup: boolean;
  notes?: string | undefined;
}

export interface UpdateWorkoutSetRequest {
  exercise_id?: string | undefined;
  set_index?: number | undefined;
  reps?: number | undefined;
  weight_kg?: number | undefined;
  rpe?: number | undefined;
  is_warmup?: boolean | undefined;
  notes?: string | undefined;
}

export interface DeleteEntityResponseData {
  deleted: true;
  id: string;
}

export interface WorkoutListResponseData {
  items: WorkoutSummaryDto[];
  next_cursor: string | null;
}

export interface WorkoutDetailResponseData {
  workout: WorkoutDetailDto;
}

export interface WorkoutMutationResponseData {
  workout: WorkoutDetailDto;
}

const workoutSetDtoSchema = z.object({
  id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  set_index: z.number().int().positive(),
  reps: z.number().int().nonnegative(),
  weight_kg: z.preprocess(normalizeNumericValue, z.number().nonnegative()),
  rpe: z
    .preprocess(normalizeNumericValue, z.number().min(1).max(10))
    .nullable(),
  is_warmup: z.boolean(),
  notes: z.string().nullable(),
  created_at: isoDateStringSchema,
});

const workoutSummaryDtoSchema = z.object({
  id: z.string().uuid(),
  performed_at: isoDateStringSchema,
  started_at: isoDateStringSchema.nullable(),
  ended_at: isoDateStringSchema.nullable(),
  duration_minutes: z.number().int().positive().nullable(),
  notes: z.string().nullable(),
  sets_count: z.number().int().nonnegative(),
  muscle_groups: z.array(z.string()),
});

const workoutDetailDtoSchema = z.object({
  id: z.string().uuid(),
  performed_at: isoDateStringSchema,
  started_at: isoDateStringSchema.nullable(),
  ended_at: isoDateStringSchema.nullable(),
  duration_minutes: z.number().int().positive().nullable(),
  notes: z.string().nullable(),
  sets: z.array(workoutSetDtoSchema),
});

export interface ListWorkoutsServiceInput {
  from?: string | undefined;
  to?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}

function mapWorkoutSetDto(row: unknown): WorkoutSetDto {
  return workoutSetDtoSchema.parse(row);
}

function mapWorkoutSummaryDto(row: unknown): WorkoutSummaryDto {
  return workoutSummaryDtoSchema.parse(row);
}

function mapWorkoutDetailDto(row: unknown): WorkoutDetailDto {
  const parsedRow = workoutDetailDtoSchema.parse(row);

  return {
    ...parsedRow,
    sets: parsedRow.sets.map((setRow) => mapWorkoutSetDto(setRow)),
  };
}

function isInvalidCursorError(error: unknown): boolean {
  return error instanceof Error && error.message === "Invalid workout cursor.";
}

async function resolveWorkoutAccess(
  workoutId: string,
  userId: string,
): Promise<WorkoutDetailDto> {
  const workout = await findWorkoutByIdForUser(workoutId, userId);

  if (workout !== null) {
    return mapWorkoutDetailDto(workout);
  }

  if (await hasWorkoutById(workoutId)) {
    throw new HttpError(403, "FORBIDDEN", "You cannot access this workout.");
  }

  throw new HttpError(404, "NOT_FOUND", "Workout was not found.");
}

async function resolveSetAccess(setId: string): Promise<never> {
  if (await hasSetById(setId)) {
    throw new HttpError(403, "FORBIDDEN", "You cannot access this set.");
  }

  throw new HttpError(404, "NOT_FOUND", "Set was not found.");
}

/**
 * List paginated workouts for the current user.
 *
 * @param userId - Authenticated user id.
 * @param input - Supported list filters.
 * @returns Workout list response data.
 */
export async function listUserWorkouts(
  userId: string,
  input: ListWorkoutsServiceInput,
): Promise<WorkoutListResponseData> {
  try {
    const result = await listWorkoutsByUser({
      userId,
      ...input,
    });

    return {
      items: result.items.map((item) => mapWorkoutSummaryDto(item)),
      next_cursor: result.nextCursor,
    };
  } catch (error) {
    if (isInvalidCursorError(error)) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid workout cursor.");
    }

    throw error;
  }
}

/**
 * Get one user-owned workout detail.
 *
 * @param workoutId - Workout id.
 * @param userId - Authenticated user id.
 * @returns Workout detail response data.
 */
export async function getUserWorkout(
  workoutId: string,
  userId: string,
): Promise<WorkoutDetailResponseData> {
  return {
    workout: await resolveWorkoutAccess(workoutId, userId),
  };
}

/**
 * Create one workout and all requested sets.
 *
 * @param userId - Authenticated user id.
 * @param input - Workout creation payload.
 * @returns Created workout detail response data.
 */
export async function createUserWorkout(
  userId: string,
  input: CreateWorkoutRequest,
): Promise<WorkoutMutationResponseData> {
  const workout = await createWorkoutWithSets(userId, input);

  return {
    workout: mapWorkoutDetailDto(workout),
  };
}

/**
 * Update workout metadata for a user-owned workout.
 *
 * @param workoutId - Workout id.
 * @param userId - Authenticated user id.
 * @param input - Workout patch payload.
 * @returns Updated workout detail response data.
 */
export async function updateUserWorkout(
  workoutId: string,
  userId: string,
  input: UpdateWorkoutRequest,
): Promise<WorkoutMutationResponseData> {
  const updatedWorkout = await updateWorkoutByIdForUser(
    workoutId,
    userId,
    input,
  );

  if (updatedWorkout === null) {
    await resolveWorkoutAccess(workoutId, userId);
  }

  return {
    workout: mapWorkoutDetailDto(updatedWorkout),
  };
}

/**
 * Delete a user-owned workout and return the unified delete payload.
 *
 * @param workoutId - Workout id.
 * @param userId - Authenticated user id.
 * @returns Unified delete response payload.
 */
export async function deleteUserWorkout(
  workoutId: string,
  userId: string,
): Promise<DeleteEntityResponseData> {
  const deletedWorkout = await deleteWorkoutByIdForUser(workoutId, userId);

  if (deletedWorkout === null) {
    await resolveWorkoutAccess(workoutId, userId);
  }

  return {
    deleted: true,
    id: workoutId,
  };
}

/**
 * Add a set to a user-owned workout.
 *
 * @param workoutId - Workout id.
 * @param userId - Authenticated user id.
 * @param input - Set creation payload.
 * @returns Updated workout detail response data.
 */
export async function addUserWorkoutSet(
  workoutId: string,
  userId: string,
  input: AddWorkoutSetRequest,
): Promise<WorkoutMutationResponseData> {
  const insertedSet = await addSetToWorkoutForUser(workoutId, userId, input);

  if (insertedSet === null) {
    await resolveWorkoutAccess(workoutId, userId);
  }

  return await getUserWorkoutMutationFromWorkoutId(workoutId, userId);
}

/**
 * Update a user-owned set.
 *
 * @param setId - Set id.
 * @param userId - Authenticated user id.
 * @param input - Set patch payload.
 * @returns Updated set DTO.
 */
export async function updateUserWorkoutSet(
  setId: string,
  userId: string,
  input: UpdateWorkoutSetRequest,
): Promise<WorkoutSetDto> {
  const updatedSet = await updateSetByIdForUser(setId, userId, input);

  if (updatedSet === null) {
    await resolveSetAccess(setId);
  }

  return mapWorkoutSetDto(updatedSet);
}

/**
 * Delete a user-owned set and return the unified delete payload.
 *
 * @param setId - Set id.
 * @param userId - Authenticated user id.
 * @returns Unified delete response payload.
 */
export async function deleteUserWorkoutSet(
  setId: string,
  userId: string,
): Promise<DeleteEntityResponseData> {
  const deletedSet = await deleteSetByIdForUser(setId, userId);

  if (deletedSet === null) {
    await resolveSetAccess(setId);
  }

  return {
    deleted: true,
    id: setId,
  };
}

async function getUserWorkoutMutationFromWorkoutId(
  workoutId: string,
  userId: string,
): Promise<WorkoutMutationResponseData> {
  return {
    workout: await resolveWorkoutAccess(workoutId, userId),
  };
}
