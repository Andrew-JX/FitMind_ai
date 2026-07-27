import { useEffect, useEffectEvent, useState } from "react";

import type {
  WorkoutDetailDto,
  WorkoutSummaryDto,
} from "../../../../shared/src/training";

import { HttpClientError } from "../../services/http-client";
import { deleteWorkout, getWorkoutDetail, listWorkouts } from "./workout-api";

export interface UseWorkoutsResult {
  deleteError: string | null;
  deleteWorkoutById: (workoutId: string) => Promise<boolean>;
  detailError: string | null;
  deletingWorkoutId: string | null;
  /** Whether the server reported another page after the loaded ones. */
  hasMoreWorkouts: boolean;
  isLoadingDetail: boolean;
  isLoadingList: boolean;
  isLoadingMoreWorkouts: boolean;
  listError: string | null;
  /** Appends the next cursor page to the loaded list. */
  loadMoreWorkouts: () => Promise<void>;
  refreshWorkouts: () => Promise<void>;
  selectedWorkout: WorkoutDetailDto | null;
  selectedWorkoutId: string | null;
  selectWorkout: (workoutId: string) => Promise<void>;
  workouts: WorkoutSummaryDto[];
}

/** Matches the server's default page size. */
const WORKOUT_PAGE_SIZE = 20;

/**
 * Loads workout list and detail state for the authenticated client.
 *
 * @param token - Current in-memory auth token
 * @returns Workout list state plus detail selection actions
 */
export function useWorkouts(token: string | null): UseWorkoutsResult {
  const [workouts, setWorkouts] = useState<WorkoutSummaryDto[]>([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(
    null,
  );
  const [selectedWorkout, setSelectedWorkout] =
    useState<WorkoutDetailDto | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(
    null,
  );
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMoreWorkouts, setIsLoadingMoreWorkouts] = useState(false);

  const refreshWorkoutsOnTokenChange = useEffectEvent(async () => {
    await refreshWorkouts();
  });

  useEffect(() => {
    if (!token) {
      setWorkouts([]);
      setSelectedWorkoutId(null);
      setSelectedWorkout(null);
      setListError(null);
      setDetailError(null);
      setDeleteError(null);
      setDeletingWorkoutId(null);
      setIsLoadingList(false);
      setIsLoadingDetail(false);
      setNextCursor(null);
      setIsLoadingMoreWorkouts(false);
      return;
    }

    void refreshWorkoutsOnTokenChange();
  }, [token]);

  async function refreshWorkouts(): Promise<void> {
    if (!token) {
      setListError("You must be signed in to view workouts.");
      return;
    }

    setIsLoadingList(true);
    setListError(null);
    setDeleteError(null);

    try {
      const page = await listWorkouts(token, { limit: WORKOUT_PAGE_SIZE });
      setWorkouts(page.items);
      setNextCursor(page.nextCursor);

      if (
        selectedWorkoutId &&
        page.items.some((item) => item.id === selectedWorkoutId)
      ) {
        return;
      }

      setSelectedWorkoutId(null);
      setSelectedWorkout(null);
    } catch (error) {
      setWorkouts([]);
      setNextCursor(null);
      setSelectedWorkoutId(null);
      setSelectedWorkout(null);
      setListError(
        getReadableErrorMessage(
          error,
          "Workout list is unavailable right now.",
        ),
      );
    } finally {
      setIsLoadingList(false);
    }
  }

  async function loadMoreWorkouts(): Promise<void> {
    if (!token || nextCursor === null || isLoadingMoreWorkouts) {
      return;
    }

    setIsLoadingMoreWorkouts(true);
    setListError(null);

    try {
      const page = await listWorkouts(token, {
        cursor: nextCursor,
        limit: WORKOUT_PAGE_SIZE,
      });

      // Guard against a duplicate id slipping in if a record was added between
      // pages; the cursor is stable but the underlying list is not frozen.
      setWorkouts((currentWorkouts) => {
        const knownIds = new Set(currentWorkouts.map((workout) => workout.id));

        return [
          ...currentWorkouts,
          ...page.items.filter((item) => !knownIds.has(item.id)),
        ];
      });
      setNextCursor(page.nextCursor);
    } catch (error) {
      setListError(
        getReadableErrorMessage(
          error,
          "Workout list is unavailable right now.",
        ),
      );
    } finally {
      setIsLoadingMoreWorkouts(false);
    }
  }

  async function selectWorkout(workoutId: string): Promise<void> {
    if (!token) {
      setDetailError("You must be signed in to view workout details.");
      return;
    }

    setSelectedWorkoutId(workoutId);
    setIsLoadingDetail(true);
    setDetailError(null);

    try {
      const detail = await getWorkoutDetail(token, workoutId);
      setSelectedWorkout(detail);
    } catch (error) {
      setSelectedWorkout(null);
      setDetailError(
        getReadableErrorMessage(
          error,
          "Workout detail is unavailable right now.",
        ),
      );
    } finally {
      setIsLoadingDetail(false);
    }
  }

  async function deleteWorkoutById(workoutId: string): Promise<boolean> {
    if (!token) {
      setDeleteError("You must be signed in to delete workouts.");
      return false;
    }

    setDeletingWorkoutId(workoutId);
    setDeleteError(null);

    try {
      await deleteWorkout(token, workoutId);
      setWorkouts((currentWorkouts) => {
        return currentWorkouts.filter((workout) => workout.id !== workoutId);
      });

      if (selectedWorkoutId === workoutId) {
        setSelectedWorkoutId(null);
        setSelectedWorkout(null);
        setDetailError(null);
      }

      return true;
    } catch (error) {
      setDeleteError(
        getReadableErrorMessage(
          error,
          "Workout deletion is unavailable right now.",
        ),
      );
      return false;
    } finally {
      setDeletingWorkoutId(null);
    }
  }

  return {
    deleteError,
    deleteWorkoutById,
    detailError,
    deletingWorkoutId,
    hasMoreWorkouts: nextCursor !== null,
    isLoadingDetail,
    isLoadingList,
    isLoadingMoreWorkouts,
    listError,
    loadMoreWorkouts,
    refreshWorkouts,
    selectedWorkout,
    selectedWorkoutId,
    selectWorkout,
    workouts,
  };
}

function getReadableErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  return fallbackMessage;
}
