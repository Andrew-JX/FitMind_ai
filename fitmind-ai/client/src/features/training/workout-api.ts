import type {
  AddWorkoutSetRequest,
  CreateWorkoutRequest,
  DeleteEntityResponseData,
  WorkoutDetailDto,
  WorkoutDetailResponseData,
  WorkoutListResponseData,
  WorkoutSetDto,
  WorkoutSummaryDto,
  WorkoutMutationResponseData,
  UpdateWorkoutRequest,
  UpdateWorkoutSetRequest,
} from "../../../../shared/src/training";

import { requestJson } from "../../services/http-client";

/**
 * Creates a workout with its initial sets.
 *
 * @param token - In-memory auth token
 * @param input - Workout payload to submit
 * @returns The created workout detail
 */
export async function createWorkout(
  token: string,
  input: CreateWorkoutRequest,
): Promise<WorkoutDetailDto> {
  const response = await requestJson<
    WorkoutMutationResponseData,
    CreateWorkoutRequest
  >("/api/workouts", {
    method: "POST",
    body: input,
    token,
  });

  return response.workout;
}

interface WorkoutSetMutationResponseData {
  set: WorkoutSetDto;
}

export interface ListWorkoutsQuery {
  /** Opaque cursor from a previous page's `next_cursor`. */
  cursor?: string | undefined;
  limit?: number | undefined;
}

export interface WorkoutPage {
  items: WorkoutSummaryDto[];
  nextCursor: string | null;
}

/**
 * Loads one page of the current user's workout summaries.
 *
 * @param token - In-memory auth token
 * @param query - Optional cursor and page size
 * @returns One page of workout summaries plus the cursor for the next one
 */
export async function listWorkouts(
  token: string,
  query: ListWorkoutsQuery = {},
): Promise<WorkoutPage> {
  const searchParams = new URLSearchParams();

  if (query.cursor) {
    searchParams.set("cursor", query.cursor);
  }

  if (query.limit !== undefined) {
    searchParams.set("limit", `${query.limit}`);
  }

  const queryString = searchParams.toString();
  const response = await requestJson<WorkoutListResponseData>(
    queryString ? `/api/workouts?${queryString}` : "/api/workouts",
    { token },
  );

  return { items: response.items, nextCursor: response.next_cursor };
}

/**
 * Loads a single workout detail by id.
 *
 * @param token - In-memory auth token
 * @param workoutId - Workout identifier
 * @returns Workout detail payload
 */
export async function getWorkoutDetail(
  token: string,
  workoutId: string,
): Promise<WorkoutDetailDto> {
  const response = await requestJson<WorkoutDetailResponseData>(
    `/api/workouts/${workoutId}`,
    {
      token,
    },
  );

  return response.workout;
}

/**
 * Deletes a single workout owned by the authenticated user.
 *
 * @param token - In-memory auth token
 * @param workoutId - Workout identifier
 * @returns The deleted entity response payload
 */
export async function deleteWorkout(
  token: string,
  workoutId: string,
): Promise<DeleteEntityResponseData> {
  return requestJson<DeleteEntityResponseData>(`/api/workouts/${workoutId}`, {
    method: "DELETE",
    token,
  });
}

export async function updateWorkout(
  token: string,
  workoutId: string,
  input: UpdateWorkoutRequest,
): Promise<WorkoutDetailDto> {
  const response = await requestJson<
    WorkoutMutationResponseData,
    UpdateWorkoutRequest
  >(`/api/workouts/${workoutId}`, {
    method: "PATCH",
    body: input,
    token,
  });

  return response.workout;
}

export async function addWorkoutSet(
  token: string,
  workoutId: string,
  input: AddWorkoutSetRequest,
): Promise<WorkoutDetailDto> {
  const response = await requestJson<
    WorkoutMutationResponseData,
    AddWorkoutSetRequest
  >(`/api/workouts/${workoutId}/sets`, {
    method: "POST",
    body: input,
    token,
  });

  return response.workout;
}

export async function updateWorkoutSet(
  token: string,
  setId: string,
  input: UpdateWorkoutSetRequest,
): Promise<WorkoutSetDto> {
  const response = await requestJson<
    WorkoutSetMutationResponseData,
    UpdateWorkoutSetRequest
  >(`/api/sets/${setId}`, {
    method: "PATCH",
    body: input,
    token,
  });

  return response.set;
}

export async function deleteWorkoutSet(
  token: string,
  setId: string,
): Promise<DeleteEntityResponseData> {
  return requestJson<DeleteEntityResponseData>(`/api/sets/${setId}`, {
    method: "DELETE",
    token,
  });
}
