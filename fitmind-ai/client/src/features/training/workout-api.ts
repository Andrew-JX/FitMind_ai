import type {
  CreateWorkoutRequest,
  WorkoutDetailDto,
  WorkoutDetailResponseData,
  WorkoutListResponseData,
  WorkoutSummaryDto,
  WorkoutMutationResponseData,
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

/**
 * Loads the current user's workout summaries.
 *
 * @param token - In-memory auth token
 * @returns Workout list summaries
 */
export async function listWorkouts(token: string): Promise<WorkoutSummaryDto[]> {
  const response = await requestJson<WorkoutListResponseData>("/api/workouts", {
    token,
  });

  return response.items;
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
