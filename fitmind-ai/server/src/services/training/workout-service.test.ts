import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db/repositories/workouts-repository.js", () => ({
  addSetToWorkoutForUser: vi.fn(),
  createWorkoutWithSets: vi.fn(),
  decodeWorkoutCursor: vi.fn(),
  deleteSetByIdForUser: vi.fn(),
  deleteWorkoutByIdForUser: vi.fn(),
  findWorkoutByIdForUser: vi.fn(),
  hasSetById: vi.fn(),
  hasWorkoutById: vi.fn(),
  listWorkoutsByUser: vi.fn(),
  updateSetByIdForUser: vi.fn(),
  updateWorkoutByIdForUser: vi.fn(),
}));

import {
  addSetToWorkoutForUser,
  createWorkoutWithSets,
  decodeWorkoutCursor,
  deleteSetByIdForUser,
  deleteWorkoutByIdForUser,
  findWorkoutByIdForUser,
  hasSetById,
  hasWorkoutById,
  listWorkoutsByUser,
  updateSetByIdForUser,
  updateWorkoutByIdForUser,
} from "../../db/repositories/workouts-repository.js";
import {
  addUserWorkoutSet,
  createUserWorkout,
  deleteUserWorkout,
  deleteUserWorkoutSet,
  getUserWorkout,
  listUserWorkouts,
  updateUserWorkout,
  updateUserWorkoutSet,
} from "./workout-service.js";

const mockedAddSetToWorkoutForUser = vi.mocked(addSetToWorkoutForUser);
const mockedCreateWorkoutWithSets = vi.mocked(createWorkoutWithSets);
const mockedDecodeWorkoutCursor = vi.mocked(decodeWorkoutCursor);
const mockedDeleteSetByIdForUser = vi.mocked(deleteSetByIdForUser);
const mockedDeleteWorkoutByIdForUser = vi.mocked(deleteWorkoutByIdForUser);
const mockedFindWorkoutByIdForUser = vi.mocked(findWorkoutByIdForUser);
const mockedHasSetById = vi.mocked(hasSetById);
const mockedHasWorkoutById = vi.mocked(hasWorkoutById);
const mockedListWorkoutsByUser = vi.mocked(listWorkoutsByUser);
const mockedUpdateSetByIdForUser = vi.mocked(updateSetByIdForUser);
const mockedUpdateWorkoutByIdForUser = vi.mocked(updateWorkoutByIdForUser);

const workoutId = "11111111-1111-4111-8111-111111111111";
const setId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const workoutSetRow = {
  id: setId,
  exercise_id: "44444444-4444-4444-8444-444444444444",
  set_index: 1,
  reps: 5,
  weight_kg: 100,
  rpe: 8,
  is_warmup: false,
  notes: null,
  created_at: "2026-05-01T10:05:00.000Z",
};

const workoutDetailRow = {
  id: workoutId,
  performed_at: "2026-05-01T10:00:00.000Z",
  started_at: "2026-05-01T10:00:00.000Z",
  ended_at: "2026-05-01T11:15:00.000Z",
  duration_minutes: 75,
  notes: "leg day",
  sets: [workoutSetRow],
};

describe("workout-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps list results and preserves the next cursor", async () => {
    mockedListWorkoutsByUser.mockResolvedValueOnce({
      items: [
        {
          id: workoutId,
          performed_at: "2026-05-01T10:00:00.000Z",
          started_at: "2026-05-01T10:00:00.000Z",
          ended_at: "2026-05-01T11:15:00.000Z",
          duration_minutes: 75,
          notes: "leg day",
          sets_count: 3,
          total_volume: 1500,
          muscle_groups: ["legs", "glutes"],
        },
      ],
      nextCursor: "encoded-cursor",
    });

    const result = await listUserWorkouts(userId, { limit: 20 });

    expect(result).toEqual({
      items: [
        {
          id: workoutId,
          performed_at: "2026-05-01T10:00:00.000Z",
          started_at: "2026-05-01T10:00:00.000Z",
          ended_at: "2026-05-01T11:15:00.000Z",
          duration_minutes: 75,
          notes: "leg day",
          sets_count: 3,
          total_volume: 1500,
          muscle_groups: ["legs", "glutes"],
        },
      ],
      next_cursor: "encoded-cursor",
    });
  });

  it("rejects invalid cursors before querying workouts", async () => {
    mockedDecodeWorkoutCursor.mockImplementationOnce(() => {
      throw new Error("Invalid workout cursor.");
    });

    await expect(
      listUserWorkouts(userId, { cursor: "bad-cursor" }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
    expect(mockedDecodeWorkoutCursor).toHaveBeenCalledWith("bad-cursor");
    expect(mockedListWorkoutsByUser).not.toHaveBeenCalled();
  });

  it("rejects cursors that fail JSON parsing before querying workouts", async () => {
    mockedDecodeWorkoutCursor.mockImplementationOnce(() => {
      throw new SyntaxError("Unexpected token");
    });

    await expect(
      listUserWorkouts(userId, { cursor: "bad-cursor" }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
    expect(mockedDecodeWorkoutCursor).toHaveBeenCalledWith("bad-cursor");
    expect(mockedListWorkoutsByUser).not.toHaveBeenCalled();
  });

  it("returns one user-owned workout detail", async () => {
    mockedFindWorkoutByIdForUser.mockResolvedValueOnce(workoutDetailRow);

    const result = await getUserWorkout(workoutId, userId);

    expect(result).toEqual({
      workout: workoutDetailRow,
    });
  });

  it("rejects cross-user workout access as forbidden", async () => {
    mockedFindWorkoutByIdForUser.mockResolvedValueOnce(null);
    mockedHasWorkoutById.mockResolvedValueOnce(true);

    await expect(getUserWorkout(workoutId, userId)).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });

  it("creates a workout and returns the mapped detail payload", async () => {
    mockedCreateWorkoutWithSets.mockResolvedValueOnce(workoutDetailRow);

    const result = await createUserWorkout(userId, {
      performed_at: "2026-05-01T10:00:00.000Z",
      duration_minutes: 75,
      notes: "leg day",
      sets: [
        {
          exercise_id: "44444444-4444-4444-8444-444444444444",
          set_index: 1,
          reps: 5,
          weight_kg: 100,
          rpe: 8,
          is_warmup: false,
        },
      ],
    });

    expect(result).toEqual({
      workout: workoutDetailRow,
    });
  });

  it("rejects workout metadata updates for a foreign workout", async () => {
    mockedUpdateWorkoutByIdForUser.mockResolvedValueOnce(null);
    mockedFindWorkoutByIdForUser.mockResolvedValueOnce(null);
    mockedHasWorkoutById.mockResolvedValueOnce(true);

    await expect(
      updateUserWorkout(workoutId, userId, { notes: "new note" }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });

  it("returns the unified delete payload for workouts", async () => {
    mockedDeleteWorkoutByIdForUser.mockResolvedValueOnce({ id: workoutId });

    const result = await deleteUserWorkout(workoutId, userId);

    expect(result).toEqual({
      deleted: true,
      id: workoutId,
    });
  });

  it("reloads workout detail after adding a set", async () => {
    mockedAddSetToWorkoutForUser.mockResolvedValueOnce(workoutSetRow);
    mockedFindWorkoutByIdForUser.mockResolvedValueOnce(workoutDetailRow);

    const result = await addUserWorkoutSet(workoutId, userId, {
      exercise_id: "44444444-4444-4444-8444-444444444444",
      set_index: 2,
      reps: 8,
      weight_kg: 80,
      rpe: 7,
      is_warmup: false,
    });

    expect(result).toEqual({
      workout: workoutDetailRow,
    });
  });

  it("rejects cross-user set updates as forbidden", async () => {
    mockedUpdateSetByIdForUser.mockResolvedValueOnce(null);
    mockedHasSetById.mockResolvedValueOnce(true);

    await expect(
      updateUserWorkoutSet(setId, userId, { reps: 6 }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });

  it("returns the unified delete payload for sets", async () => {
    mockedDeleteSetByIdForUser.mockResolvedValueOnce({
      id: setId,
      workout_id: workoutId,
    });

    const result = await deleteUserWorkoutSet(setId, userId);

    expect(result).toEqual({
      deleted: true,
      id: setId,
    });
  });
});
