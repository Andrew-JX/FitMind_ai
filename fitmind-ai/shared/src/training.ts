export interface WorkoutSetDto {
  id: string;
  exercise_id: string;
  /**
   * Sequence number for the same exercise inside the same workout.
   * This is not a workout-global set order.
   */
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
  duration_minutes: number | null;
  notes: string | null;
  sets_count: number;
  muscle_groups: string[];
}

export interface WorkoutDetailDto {
  id: string;
  performed_at: string;
  duration_minutes: number | null;
  notes: string | null;
  sets: WorkoutSetDto[];
}

export interface WorkoutSetInput {
  exercise_id: string;
  /**
   * Sequence number for the same exercise inside the same workout.
   * This is not a workout-global set order.
   */
  set_index: number;
  reps: number;
  weight_kg: number;
  rpe?: number | undefined;
  is_warmup: boolean;
  notes?: string | undefined;
}

export interface CreateWorkoutRequest {
  performed_at: string;
  duration_minutes?: number | undefined;
  notes?: string | undefined;
  sets: WorkoutSetInput[];
}

export interface UpdateWorkoutRequest {
  performed_at?: string | undefined;
  duration_minutes?: number | undefined;
  notes?: string | undefined;
}

export type AddWorkoutSetRequest = WorkoutSetInput;

export interface UpdateWorkoutSetRequest {
  exercise_id?: string | undefined;
  /**
   * Sequence number for the same exercise inside the same workout.
   * This is not a workout-global set order.
   */
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
  /**
   * Encoded as base64(JSON.stringify({ performed_at, id })) for
   * performed_at DESC, id DESC pagination.
   */
  next_cursor: string | null;
}

export interface WorkoutDetailResponseData {
  workout: WorkoutDetailDto;
}

export interface WorkoutMutationResponseData {
  workout: WorkoutDetailDto;
}
