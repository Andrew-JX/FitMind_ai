import { useEffect, useMemo, useState } from "react";

import { AppShell, type AppTabKey } from "./components/AppShell";
import { AssistantWorkspace } from "./features/assistant/AssistantWorkspace";
import { AuthScreen } from "./features/auth/AuthScreen";
import {
  bootstrap,
  clearAuth,
  login,
  refreshAuth,
  register,
  setToken,
  useAuth,
} from "./features/auth/use-auth";
import { useCurrentPlan } from "./features/assistant/use-current-plan";
import { FeedbackButton } from "./features/feedback/FeedbackButton";
import { ProfileView } from "./features/profile/ProfileView";
import { createAnalysisRange } from "./features/training/analysis-range";
import { AnalysisView } from "./features/training/AnalysisView";
import { TrainingView } from "./features/training/TrainingView";
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
  // The training tab's overview strip is labelled 近 30 天, so it keeps its own
  // fixed range; the analysis tab owns a switchable one.
  const trainingRange = useMemo(() => createAnalysisRange("last30"), []);
  const trainingSummary = useTrainingSummary(auth.token, trainingRange);
  const workouts = useWorkouts(auth.token);
  const currentPlan = useCurrentPlan(auth.token);
  const [activeTab, setActiveTab] = useState<AppTabKey>("training");
  const [selectedProgressExerciseId, setSelectedProgressExerciseId] = useState<
    string | null
  >(null);
  const [selectedProgressExerciseName, setSelectedProgressExerciseName] =
    useState<string | null>(null);
  const [analysisRefreshSignal, setAnalysisRefreshSignal] = useState(0);
  const [assistantRefreshSignal, setAssistantRefreshSignal] = useState(0);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let isActive = true;

    void bootstrap().finally(() => {
      if (isActive) {
        setIsBootstrapping(false);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

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

  if (isBootstrapping && auth.status !== "authenticated") {
    return (
      <div style={bootstrapScreenStyle} role="status" aria-live="polite">
        正在恢复登录状态…
      </div>
    );
  }

  if (!(auth.status === "authenticated" && auth.user)) {
    return (
      <AuthScreen
        errorMessage={auth.errorMessage}
        onLogin={auth.login}
        onRegister={auth.register}
        status={auth.status}
      />
    );
  }

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      secondaryAction={
        <FeedbackButton
          sourceRoute={getSourceRoute(activeTab)}
          token={auth.token ?? ""}
        />
      }
      subtitle="基于真实训练日志的可追溯 AI 训练分析助手"
    >
      <section style={tabSectionStyle(activeTab === "training")}>
        <TrainingView
          exercisePickerProps={{
            exercises: exerciseSearch.exercises,
            isLoadingExercises: exerciseSearch.isLoadingExercises,
            isLoadingMuscleGroups: exerciseSearch.isLoadingMuscleGroups,
            muscleGroups: exerciseSearch.muscleGroups,
            onSearch: exerciseSearch.searchExercises,
            searchError: exerciseSearch.searchError,
          }}
          currentPlan={currentPlan}
          onOpenAssistant={() => setActiveTab("assistant")}
          summary={trainingSummary.summary}
          summaryLoading={trainingSummary.isLoading}
          workoutFormProps={{
            onCreated: handleWorkoutCreated,
            token: auth.token,
          }}
          workoutsProps={{
            deleteError: workouts.deleteError,
            deletingWorkoutId: workouts.deletingWorkoutId,
            detailError: workouts.detailError,
            isLoadingDetail: workouts.isLoadingDetail,
            isLoadingList: workouts.isLoadingList,
            listError: workouts.listError,
            onDeleteWorkout: handleDeleteWorkout,
            onWorkoutEdited: handleWorkoutCreated,
            onRefresh: workouts.refreshWorkouts,
            onSelectWorkout: workouts.selectWorkout,
            selectedWorkout: workouts.selectedWorkout,
            selectedWorkoutId: workouts.selectedWorkoutId,
            token: auth.token,
            workouts: workouts.workouts,
          }}
        />
      </section>

      <section style={tabSectionStyle(activeTab === "analysis")}>
        <AnalysisView
          onExerciseSelect={handleExerciseSelect}
          refreshSignal={analysisRefreshSignal}
          selectedExerciseId={selectedProgressExerciseId}
          token={auth.token}
        />
      </section>

      <section style={tabSectionStyle(activeTab === "assistant")}>
        <AssistantWorkspace
          currentPlan={currentPlan}
          refreshSignal={assistantRefreshSignal}
          selectedExerciseId={selectedProgressExerciseId}
          selectedExerciseName={selectedProgressExerciseName}
          token={auth.token}
        />
      </section>

      <section style={tabSectionStyle(activeTab === "profile")}>
        <ProfileView
          displayName={auth.user.display_name}
          email={auth.user.email}
          onLogout={auth.logout}
          token={auth.token}
        />
      </section>
    </AppShell>
  );

  async function handleWorkoutCreated(): Promise<void> {
    await Promise.all([
      workouts.refreshWorkouts(),
      trainingSummary.refresh(),
      currentPlan.refresh(),
    ]);
    setAnalysisRefreshSignal((currentValue) => currentValue + 1);
    setAssistantRefreshSignal((currentValue) => currentValue + 1);
  }

  async function handleDeleteWorkout(workoutId: string): Promise<boolean> {
    const wasDeleted = await workouts.deleteWorkoutById(workoutId);

    if (wasDeleted) {
      await trainingSummary.refresh();
      setAnalysisRefreshSignal((currentValue) => currentValue + 1);
      setAssistantRefreshSignal((currentValue) => currentValue + 1);
    }

    return wasDeleted;
  }

  /**
   * Records which exercise the analysis tab is focused on.
   *
   * The analysis tab renders that focus itself; this state exists so the
   * assistant's exercise-scoped shortcuts know what to ask about.
   */
  function handleExerciseSelect(
    exerciseId: string,
    exerciseName: string,
  ): void {
    setSelectedProgressExerciseId(exerciseId);
    setSelectedProgressExerciseName(exerciseName);
  }
}

function getSourceRoute(activeTab: AppTabKey): string {
  if (activeTab === "analysis") {
    return "/analysis";
  }

  if (activeTab === "assistant") {
    return "/assistant";
  }

  if (activeTab === "profile") {
    return "/profile";
  }

  return "/training";
}

function tabSectionStyle(isActive: boolean): React.CSSProperties {
  return {
    display: isActive ? "grid" : "none",
    gap: 16,
    paddingBottom: 16,
  };
}

const bootstrapScreenStyle: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  minHeight: "100vh",
  padding: 24,
  color: "#94a3b8",
  fontSize: 14,
};
