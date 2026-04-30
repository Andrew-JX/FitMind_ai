import { useEffect, useState } from "react";

import { AuthScreen } from "./features/auth/AuthScreen";
import { ExercisePicker } from "./features/training/ExercisePicker";
import { ExerciseProgressPanel } from "./features/training/ExerciseProgressPanel";
import { RecommendationContextPanel } from "./features/training/RecommendationContextPanel";
import { TrainingSummaryPanel } from "./features/training/TrainingSummaryPanel";
import { WorkoutForm } from "./features/training/WorkoutForm";
import { WorkoutsPanel } from "./features/training/WorkoutsPanel";
import {
  clearAuth,
  login,
  refreshAuth,
  register,
  setToken,
  useAuth,
} from "./features/auth/use-auth";
import { useExerciseSearch } from "./features/training/use-exercise-search";
import { useTrainingSummary } from "./features/training/use-training-summary";
import { useWorkouts } from "./features/training/use-workouts";

declare global {
  interface Window {
    fitmindAuthDebug?: {
      clearAuth: () => void;
      login: (email: string, password: string) => Promise<void>;
      refreshAuth: () => Promise<void>;
      register: (
        email: string,
        password: string,
        displayName?: string,
      ) => Promise<void>;
      setToken: (token: string) => Promise<void>;
    };
  }
}

export function App() {
  const auth = useAuth();
  const exerciseSearch = useExerciseSearch();
  const trainingSummary = useTrainingSummary(auth.token);
  const workouts = useWorkouts(auth.token);
  const [selectedProgressExerciseId, setSelectedProgressExerciseId] = useState<
    string | null
  >(null);
  const [selectedProgressExerciseName, setSelectedProgressExerciseName] = useState<
    string | null
  >(null);
  const [progressRefreshSignal, setProgressRefreshSignal] = useState(0);
  const [recommendationContextRefreshSignal, setRecommendationContextRefreshSignal] =
    useState(0);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    window.fitmindAuthDebug = {
      clearAuth,
      login: (email, password) => login({ email, password }),
      refreshAuth,
      register: (email, password, displayName) =>
        register({
          email,
          password,
          display_name: displayName,
        }),
      setToken,
    };

    return () => {
      delete window.fitmindAuthDebug;
    };
  }, []);

  return (
    <main>
      <h1>FitMind AI</h1>
      <p>Workout logging MVP for real training data entry.</p>
      <p>Auth status: {auth.status}</p>
      <p>
        Token storage: in-memory only. Refreshing the page clears the current session by
        design.
      </p>
      {auth.status === "authenticated" && auth.user ? (
        <section>
          <p>
            Active user: {auth.user.email}
            {auth.user.display_name ? ` (${auth.user.display_name})` : ""}
          </p>
          {auth.errorMessage ? <p>Error: {auth.errorMessage}</p> : null}
          <button type="button" onClick={auth.clearAuth}>
            Clear in-memory session
          </button>
          <p>
            Use the tools below to search exercises, save workouts, review your recent
            log, and inspect a deterministic 30-day training summary.
          </p>
          <RecommendationContextPanel
            refreshSignal={recommendationContextRefreshSignal}
            token={auth.token}
          />
          <TrainingSummaryPanel
            errorMessage={trainingSummary.errorMessage}
            isLoading={trainingSummary.isLoading}
            onExerciseSelect={handleExerciseSelect}
            onRefresh={trainingSummary.refresh}
            selectedExerciseId={selectedProgressExerciseId}
            summary={trainingSummary.summary}
          />
          <ExerciseProgressPanel
            refreshSignal={progressRefreshSignal}
            selectedExerciseId={selectedProgressExerciseId}
            selectedExerciseName={selectedProgressExerciseName}
            token={auth.token}
          />
          <ExercisePicker
            exercises={exerciseSearch.exercises}
            isLoadingExercises={exerciseSearch.isLoadingExercises}
            isLoadingMuscleGroups={exerciseSearch.isLoadingMuscleGroups}
            muscleGroups={exerciseSearch.muscleGroups}
            onSearch={exerciseSearch.searchExercises}
            searchError={exerciseSearch.searchError}
          />
          <WorkoutForm
            onCreated={async () => {
              await Promise.all([
                workouts.refreshWorkouts(),
                trainingSummary.refresh(),
              ]);
              setRecommendationContextRefreshSignal(
                (currentValue) => currentValue + 1,
              );

              if (selectedProgressExerciseId !== null) {
                setProgressRefreshSignal((currentValue) => currentValue + 1);
              }
            }}
            token={auth.token}
          />
          <WorkoutsPanel
            deleteError={workouts.deleteError}
            deletingWorkoutId={workouts.deletingWorkoutId}
            detailError={workouts.detailError}
            isLoadingDetail={workouts.isLoadingDetail}
            isLoadingList={workouts.isLoadingList}
            listError={workouts.listError}
            onDeleteWorkout={handleDeleteWorkout}
            onRefresh={workouts.refreshWorkouts}
            onSelectWorkout={workouts.selectWorkout}
            selectedWorkout={workouts.selectedWorkout}
            selectedWorkoutId={workouts.selectedWorkoutId}
            workouts={workouts.workouts}
          />
        </section>
      ) : (
        <AuthScreen
          errorMessage={auth.errorMessage}
          onLogin={auth.login}
          onRegister={auth.register}
          status={auth.status}
        />
      )}
      {import.meta.env.DEV ? (
        <p>
          Debug helpers remain available in the browser console as
          <code> window.fitmindAuthDebug </code>
          for local auth checks.
        </p>
      ) : null}
    </main>
  );

  async function handleDeleteWorkout(workoutId: string): Promise<boolean> {
    const wasDeleted = await workouts.deleteWorkoutById(workoutId);

    if (wasDeleted) {
      await trainingSummary.refresh();
      setRecommendationContextRefreshSignal((currentValue) => currentValue + 1);

      if (selectedProgressExerciseId !== null) {
        setProgressRefreshSignal((currentValue) => currentValue + 1);
      }
    }

    return wasDeleted;
  }

  function handleExerciseSelect(
    exerciseId: string,
    exerciseName: string,
  ): void {
    setSelectedProgressExerciseId(exerciseId);
    setSelectedProgressExerciseName(exerciseName);
  }
}
