import { useEffect, useState } from "react";

import type { WorkoutDetailDto, WorkoutSummaryDto } from "../../../../shared/src/training";

import { HttpClientError } from "../../services/http-client";
import { searchExercises } from "./dictionary-api";

export interface WorkoutsPanelProps {
  deleteError: string | null;
  deletingWorkoutId: string | null;
  detailError: string | null;
  isLoadingDetail: boolean;
  isLoadingList: boolean;
  listError: string | null;
  onDeleteWorkout: (workoutId: string) => Promise<boolean>;
  onRefresh: () => Promise<void>;
  onSelectWorkout: (workoutId: string) => Promise<void>;
  selectedWorkout: WorkoutDetailDto | null;
  selectedWorkoutId: string | null;
  workouts: WorkoutSummaryDto[];
}

/**
 * Renders the minimal workout list and detail panel for Phase 1.3.
 *
 * @param props - Workout list/detail state and actions
 * @returns The workout browsing section
 */
export function WorkoutsPanel(props: WorkoutsPanelProps) {
  const {
    deleteError,
    deletingWorkoutId,
    detailError,
    isLoadingDetail,
    isLoadingList,
    listError,
    onDeleteWorkout,
    onRefresh,
    onSelectWorkout,
    selectedWorkout,
    selectedWorkoutId,
    workouts,
  } = props;
  const exerciseNames = useExerciseNames();

  return (
    <section>
      <h2>Workout Log</h2>
      <p>Review saved sessions, inspect the detail, and remove workouts you no longer need.</p>
      <button disabled={isLoadingList} onClick={() => void onRefresh()} type="button">
        {isLoadingList ? "Refreshing..." : "Refresh workouts"}
      </button>
      {listError ? <p>Error: {listError}</p> : null}
      {deleteError ? <p>Error: {deleteError}</p> : null}
      {isLoadingList ? <p>Loading workout list...</p> : null}
      {!isLoadingList && workouts.length === 0 ? (
        <p>No workouts yet. Save your first workout above and it will appear here.</p>
      ) : null}
      {workouts.length > 0 ? (
        <ul>
          {workouts.map((workout) => {
            const isDeleting = deletingWorkoutId === workout.id;

            return (
              <li key={workout.id}>
                <button onClick={() => void onSelectWorkout(workout.id)} type="button">
                  {selectedWorkoutId === workout.id ? "Viewing" : "View"}
                </button>
                <button
                  disabled={isDeleting}
                  onClick={() => void handleDeleteWorkout(workout.id)}
                  type="button"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
                <div>{formatDateTime(workout.performed_at)}</div>
                <div>Duration: {formatDuration(workout.duration_minutes)}</div>
                <div>Sets: {workout.sets_count}</div>
                <div>Muscles: {workout.muscle_groups.join(", ") || "Unknown"}</div>
                <div>Notes: {workout.notes?.trim() || "No notes"}</div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {detailError ? <p>Error: {detailError}</p> : null}
      {isLoadingDetail ? <p>Loading workout detail...</p> : null}
      {!isLoadingDetail && !selectedWorkout && workouts.length > 0 ? (
        <p>Select a workout to inspect the saved sets and notes.</p>
      ) : null}
      {selectedWorkout ? (
        <section>
          <h3>Workout Detail</h3>
          <p>Performed at: {formatDateTime(selectedWorkout.performed_at)}</p>
          <p>Duration: {formatDuration(selectedWorkout.duration_minutes)}</p>
          <p>Notes: {selectedWorkout.notes?.trim() || "No notes"}</p>
          <ul>
            {selectedWorkout.sets.map((setItem) => {
              const exerciseName =
                exerciseNames.get(setItem.exercise_id) ?? `Exercise ${setItem.exercise_id}`;

              return (
                <li key={setItem.id}>
                  <strong>{exerciseName}</strong>
                  <div>Set #{setItem.set_index} for this exercise</div>
                  <div>
                    {setItem.reps} reps x {setItem.weight_kg} kg
                  </div>
                  <div>RPE: {setItem.rpe ?? "Not recorded"}</div>
                  <div>{setItem.is_warmup ? "Warm-up set" : "Working set"}</div>
                  <div>Notes: {setItem.notes?.trim() || "No set notes"}</div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </section>
  );

  async function handleDeleteWorkout(workoutId: string): Promise<void> {
    if (!window.confirm("Delete this workout and all of its sets?")) {
      return;
    }

    await onDeleteWorkout(workoutId);
  }
}

function useExerciseNames(): Map<string, string> {
  const [exerciseNames, setExerciseNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let isActive = true;

    async function loadExerciseNames(): Promise<void> {
      try {
        const exercises = await searchExercises({});

        if (!isActive) {
          return;
        }

        setExerciseNames(
          new Map(
            exercises.map((exercise) => {
              return [exercise.id, exercise.name_en] as const;
            }),
          ),
        );
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (!(error instanceof HttpClientError)) {
          return;
        }

        setExerciseNames(new Map());
      }
    }

    void loadExerciseNames();

    return () => {
      isActive = false;
    };
  }, []);

  return exerciseNames;
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatDuration(durationMinutes: number | null): string {
  if (durationMinutes === null) {
    return "Duration not recorded";
  }

  return `${durationMinutes} minutes`;
}
