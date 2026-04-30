import { useEffect } from "react";

import { AuthScreen } from "./features/auth/AuthScreen";
import { ExercisePicker } from "./features/training/ExercisePicker";
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
  const workouts = useWorkouts(auth.token);

  useEffect(() => {
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
      <p>Phase 1.3 auth entry MVP is in progress.</p>
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
          <button type="button" onClick={auth.clearAuth}>
            Clear in-memory session
          </button>
          <p>Workout form and list/detail UI will be added in later batches.</p>
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
              await workouts.refreshWorkouts();
            }}
            token={auth.token}
          />
          <WorkoutsPanel
            detailError={workouts.detailError}
            isLoadingDetail={workouts.isLoadingDetail}
            isLoadingList={workouts.isLoadingList}
            listError={workouts.listError}
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
      <p>
        Debug helpers are available in the browser console as
        <code> window.fitmindAuthDebug </code>
        for manual auth checks.
      </p>
    </main>
  );
}
