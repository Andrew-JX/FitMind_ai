import { useEffect, useEffectEvent, useState } from "react";

import type { WorkoutDetailDto, WorkoutSummaryDto } from "../../../../shared/src/training";

import { HttpClientError } from "../../services/http-client";
import { getWorkoutDetail, listWorkouts } from "./workout-api";

export interface UseWorkoutsResult {
  detailError: string | null;
  isLoadingDetail: boolean;
  isLoadingList: boolean;
  listError: string | null;
  refreshWorkouts: () => Promise<void>;
  selectedWorkout: WorkoutDetailDto | null;
  selectedWorkoutId: string | null;
  selectWorkout: (workoutId: string) => Promise<void>;
  workouts: WorkoutSummaryDto[];
}

/**
 * Loads workout list and detail state for the authenticated client.
 *
 * @param token - Current in-memory auth token
 * @returns Workout list state plus detail selection actions
 */
export function useWorkouts(token: string | null): UseWorkoutsResult {
  const [workouts, setWorkouts] = useState<WorkoutSummaryDto[]>([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutDetailDto | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

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
      setIsLoadingList(false);
      setIsLoadingDetail(false);
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

    try {
      const items = await listWorkouts(token);
      setWorkouts(items);

      if (selectedWorkoutId && items.some((item) => item.id === selectedWorkoutId)) {
        return;
      }

      setSelectedWorkoutId(null);
      setSelectedWorkout(null);
    } catch (error) {
      setWorkouts([]);
      setSelectedWorkoutId(null);
      setSelectedWorkout(null);
      setListError(getReadableErrorMessage(error, "Workout list is unavailable right now."));
    } finally {
      setIsLoadingList(false);
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
      setDetailError(getReadableErrorMessage(error, "Workout detail is unavailable right now."));
    } finally {
      setIsLoadingDetail(false);
    }
  }

  return {
    detailError,
    isLoadingDetail,
    isLoadingList,
    listError,
    refreshWorkouts,
    selectedWorkout,
    selectedWorkoutId,
    selectWorkout,
    workouts,
  };
}

function getReadableErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  return fallbackMessage;
}
