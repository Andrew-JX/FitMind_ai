export interface WorkoutCursor {
  performed_at: string;
  id: string;
}

export interface WorkoutSetRow {
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

export interface WorkoutSummaryRow {
  id: string;
  performed_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  sets_count: number;
  muscle_groups: string[];
}

export interface WorkoutDetailRow {
  id: string;
  performed_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  sets: WorkoutSetRow[];
}

export interface ListWorkoutsFilters {
  userId: string;
  from?: string | undefined;
  to?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}

export interface CreateWorkoutInput {
  performed_at: string;
  started_at?: string | null | undefined;
  ended_at?: string | null | undefined;
  duration_minutes?: number | undefined;
  notes?: string | undefined;
  sets: Array<{
    exercise_id: string;
    set_index: number;
    reps: number;
    weight_kg: number;
    rpe?: number | undefined;
    is_warmup: boolean;
    notes?: string | undefined;
  }>;
}

export interface UpdateWorkoutInput {
  performed_at?: string | undefined;
  started_at?: string | null | undefined;
  ended_at?: string | null | undefined;
  duration_minutes?: number | undefined;
  notes?: string | undefined;
}

export interface SetInput {
  exercise_id: string;
  set_index: number;
  reps: number;
  weight_kg: number;
  rpe?: number | undefined;
  is_warmup: boolean;
  notes?: string | undefined;
}

export interface UpdateSetInput {
  exercise_id?: string | undefined;
  set_index?: number | undefined;
  reps?: number | undefined;
  weight_kg?: number | undefined;
  rpe?: number | undefined;
  is_warmup?: boolean | undefined;
  notes?: string | undefined;
}

export declare function encodeWorkoutCursor(cursor: WorkoutCursor): string;
export declare function decodeWorkoutCursor(cursor: string): WorkoutCursor;
export declare function listWorkoutsByUser(
  filters: ListWorkoutsFilters,
): Promise<{
  items: WorkoutSummaryRow[];
  nextCursor: string | null;
}>;
export declare function findWorkoutByIdForUser(
  workoutId: string,
  userId: string,
): Promise<WorkoutDetailRow | null>;
export declare function hasWorkoutById(workoutId: string): Promise<boolean>;
export declare function createWorkoutWithSets(
  userId: string,
  input: CreateWorkoutInput,
): Promise<WorkoutDetailRow>;
export declare function updateWorkoutByIdForUser(
  workoutId: string,
  userId: string,
  input: UpdateWorkoutInput,
): Promise<WorkoutDetailRow | null>;
export declare function deleteWorkoutByIdForUser(
  workoutId: string,
  userId: string,
): Promise<{ id: string } | null>;
export declare function addSetToWorkoutForUser(
  workoutId: string,
  userId: string,
  input: SetInput,
): Promise<WorkoutSetRow | null>;
export declare function updateSetByIdForUser(
  setId: string,
  userId: string,
  input: UpdateSetInput,
): Promise<WorkoutSetRow | null>;
export declare function deleteSetByIdForUser(
  setId: string,
  userId: string,
): Promise<{ id: string; workout_id: string } | null>;
export declare function hasSetById(setId: string): Promise<boolean>;
