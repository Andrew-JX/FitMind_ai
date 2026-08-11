export interface WorkoutCursor {
  performed_at: string;
  id: string;
}

export interface DbQueryResult {
  rows: unknown[];
  rowCount?: number | null;
}

export interface DbClientLike {
  query: (sql: string, params?: readonly unknown[]) => Promise<DbQueryResult>;
  release: () => void;
}

export interface DbPoolLike {
  query: DbClientLike["query"];
  connect?: () => Promise<DbClientLike>;
  end?: () => Promise<void>;
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
  total_volume: number;
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
  pool?: DbPoolLike,
): Promise<{
  items: WorkoutSummaryRow[];
  nextCursor: string | null;
}>;
export declare function findWorkoutByIdForUser(
  workoutId: string,
  userId: string,
  pool?: DbPoolLike,
): Promise<WorkoutDetailRow | null>;
export declare function hasWorkoutById(
  workoutId: string,
  pool?: DbPoolLike,
): Promise<boolean>;
export declare function createWorkoutWithSets(
  userId: string,
  input: CreateWorkoutInput,
  pool?: DbPoolLike,
): Promise<WorkoutDetailRow>;
export declare function updateWorkoutByIdForUser(
  workoutId: string,
  userId: string,
  input: UpdateWorkoutInput,
  pool?: DbPoolLike,
): Promise<WorkoutDetailRow | null>;
export declare function deleteWorkoutByIdForUser(
  workoutId: string,
  userId: string,
  pool?: DbPoolLike,
): Promise<{ id: string } | null>;
export declare function addSetToWorkoutForUser(
  workoutId: string,
  userId: string,
  input: SetInput,
  pool?: DbPoolLike,
): Promise<WorkoutSetRow | null>;
export declare function updateSetByIdForUser(
  setId: string,
  userId: string,
  input: UpdateSetInput,
  pool?: DbPoolLike,
): Promise<WorkoutSetRow | null>;
export declare function deleteSetByIdForUser(
  setId: string,
  userId: string,
  pool?: DbPoolLike,
): Promise<{ id: string; workout_id: string } | null>;
export declare function hasSetById(
  setId: string,
  pool?: DbPoolLike,
): Promise<boolean>;
