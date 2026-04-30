import { useEffect, useState } from "react";

import type { WorkoutDetailDto, WorkoutSummaryDto } from "../../../../shared/src/training";

import { HttpClientError } from "../../services/http-client";
import { searchExercises } from "./dictionary-api";

export interface WorkoutsPanelProps {
  detailError: string | null;
  isLoadingDetail: boolean;
  isLoadingList: boolean;
  listError: string | null;
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
    detailError,
    isLoadingDetail,
    isLoadingList,
    listError,
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
      <p>Browse saved workouts and inspect their sets.</p>
      <button disabled={isLoadingList} onClick={() => void onRefresh()} type="button">
        {isLoadingList ? "Refreshing..." : "Refresh workouts"}
      </button>
      {listError ? <p>Error: {listError}</p> : null}
      {!isLoadingList && workouts.length === 0 ? (
        <p>No workouts loaded yet. Create one above, then refresh this list.</p>
      ) : null}
      {workouts.length > 0 ? (
        <ul>
          {workouts.map((workout) => {
            return (
              <li key={workout.id}>
                <button
                  onClick={() => void onSelectWorkout(workout.id)}
                  type="button"
                >
                  {selectedWorkoutId === workout.id ? "Viewing" : "View"}
                </button>
                <div>{formatDateTime(workout.performed_at)}</div>
                <div>Sets: {workout.sets_count}</div>
                <div>Muscles: {workout.muscle_groups.join(", ") || "Unknown"}</div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {detailError ? <p>Error: {detailError}</p> : null}
      {isLoadingDetail ? <p>Loading workout detail...</p> : null}
      {selectedWorkout ? (
        <section>
          <h3>Workout Detail</h3>
          <p>ID: {selectedWorkout.id}</p>
          <p>Performed at: {formatDateTime(selectedWorkout.performed_at)}</p>
          <p>Duration: {selectedWorkout.duration_minutes ?? "Unknown"} minutes</p>
          <p>Notes: {selectedWorkout.notes || "None"}</p>
          <ul>
            {selectedWorkout.sets.map((setItem) => {
              return (
                <li key={setItem.id}>
                  <strong>Exercise:</strong>{" "}
                  {exerciseNames.get(setItem.exercise_id) ?? setItem.exercise_id}
                  <div>set_index: {setItem.set_index}</div>
                  <div>
                    reps {setItem.reps} x {setItem.weight_kg} kg
                  </div>
                  <div>RPE: {setItem.rpe ?? "N/A"}</div>
                  <div>Warm-up: {setItem.is_warmup ? "Yes" : "No"}</div>
                  <div>Notes: {setItem.notes || "None"}</div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </section>
  );
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
