export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

export declare function findUserByEmail(email: string): Promise<UserRow | null>;
export declare function findUserById(userId: string): Promise<UserRow | null>;
export declare function createUser(input: {
  email: string;
  passwordHash: string;
  displayName?: string | null | undefined;
}): Promise<UserRow>;

export interface MuscleGroupRow {
  id: string;
  code: string;
  nameEn: string;
  nameZh: string;
  parentId: string | null;
  recoveryHours: number;
  createdAt: unknown;
}

export interface ExerciseMuscleRow {
  code: string;
  contributionWeight: number;
  isPrimary: boolean;
}

export interface ExerciseRow {
  id: string;
  code: string;
  nameEn: string;
  nameZh: string;
  movementPattern: string | null;
  equipment: string | null;
  muscles: ExerciseMuscleRow[];
}

export declare function listMuscleGroups(): Promise<MuscleGroupRow[]>;
export declare function searchExercises(filters?: {
  q?: string | undefined;
  muscleCode?: string | undefined;
}): Promise<ExerciseRow[]>;
export {
  addSetToWorkoutForUser,
  createWorkoutWithSets,
  decodeWorkoutCursor,
  deleteSetByIdForUser,
  deleteWorkoutByIdForUser,
  encodeWorkoutCursor,
  findWorkoutByIdForUser,
  listWorkoutsByUser,
  updateSetByIdForUser,
  updateWorkoutByIdForUser,
} from "./workouts-repository.js";
