import { useEffect, useState } from "react";

import { AppShell, type AppTabKey } from "./components/AppShell";
import { Card } from "./components/Card";
import { AssistantWorkspace } from "./features/assistant/AssistantWorkspace";
import { AuthScreen } from "./features/auth/AuthScreen";
import {
  clearAuth,
  login,
  refreshAuth,
  register,
  setToken,
  useAuth,
} from "./features/auth/use-auth";
import { AnalysisView } from "./features/training/AnalysisView";
import { TrainingView } from "./features/training/TrainingView";
import { useExerciseSearch } from "./features/training/use-exercise-search";
import { useTrainingSummary } from "./features/training/use-training-summary";
import { useWorkouts } from "./features/training/use-workouts";
import { useTheme } from "./theme/ThemeContext";

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
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<AppTabKey>("training");
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
      onClearAuth={auth.clearAuth}
      onSelectTab={setActiveTab}
      subtitle="基于真实训练日志的可追溯 AI 训练分析助手"
      userLabel={auth.user.display_name ?? auth.user.email}
    >
      {auth.errorMessage ? (
        <p style={{ color: theme.colors.orange, marginTop: 0 }}>
          错误：{auth.errorMessage}
        </p>
      ) : null}

      {activeTab === "training" ? (
        <section style={tabSectionStyle}>
          <TrainingView
            exercisePickerProps={{
              exercises: exerciseSearch.exercises,
              isLoadingExercises: exerciseSearch.isLoadingExercises,
              isLoadingMuscleGroups: exerciseSearch.isLoadingMuscleGroups,
              muscleGroups: exerciseSearch.muscleGroups,
              onSearch: exerciseSearch.searchExercises,
              searchError: exerciseSearch.searchError,
            }}
            summary={trainingSummary.summary}
            summaryLoading={trainingSummary.isLoading}
            workoutsProps={{
              deleteError: workouts.deleteError,
              deletingWorkoutId: workouts.deletingWorkoutId,
              detailError: workouts.detailError,
              isLoadingDetail: workouts.isLoadingDetail,
              isLoadingList: workouts.isLoadingList,
              listError: workouts.listError,
              onDeleteWorkout: handleDeleteWorkout,
              onRefresh: workouts.refreshWorkouts,
              onSelectWorkout: workouts.selectWorkout,
              selectedWorkout: workouts.selectedWorkout,
              selectedWorkoutId: workouts.selectedWorkoutId,
              workouts: workouts.workouts,
            }}
            workoutFormProps={{
              onCreated: handleWorkoutCreated,
              token: auth.token,
            }}
          />
        </section>
      ) : null}

      {activeTab === "analysis" ? (
        <section style={tabSectionStyle}>
          <AnalysisView
            progressProps={{
              refreshSignal: progressRefreshSignal,
              selectedExerciseId: selectedProgressExerciseId,
              selectedExerciseName: selectedProgressExerciseName,
              token: auth.token,
            }}
            recommendationProps={{
              refreshSignal: recommendationContextRefreshSignal,
              token: auth.token,
            }}
            summary={trainingSummary.summary}
            summaryProps={{
              errorMessage: trainingSummary.errorMessage,
              isLoading: trainingSummary.isLoading,
              onExerciseSelect: handleExerciseSelect,
              onRefresh: trainingSummary.refresh,
              selectedExerciseId: selectedProgressExerciseId,
              summary: trainingSummary.summary,
            }}
          />
        </section>
      ) : null}

      {activeTab === "assistant" ? (
        <section style={tabSectionStyle}>
          <AssistantWorkspace
            selectedExerciseId={selectedProgressExerciseId}
            selectedExerciseName={selectedProgressExerciseName}
            token={auth.token}
          />
        </section>
      ) : null}

      {import.meta.env.DEV ? (
        <Card padding="12px 16px">
          <p style={devCopyStyle(theme)}>
            开发调试：浏览器控制台仍可使用
            <code style={devCodeStyle(theme)}> window.fitmindAuthDebug </code>
            进行本地认证检查。
          </p>
        </Card>
      ) : null}
    </AppShell>
  );

  async function handleWorkoutCreated(): Promise<void> {
    await Promise.all([workouts.refreshWorkouts(), trainingSummary.refresh()]);
    setRecommendationContextRefreshSignal((currentValue) => currentValue + 1);

    if (selectedProgressExerciseId !== null) {
      setProgressRefreshSignal((currentValue) => currentValue + 1);
    }
  }

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

  function handleExerciseSelect(exerciseId: string, exerciseName: string): void {
    setSelectedProgressExerciseId(exerciseId);
    setSelectedProgressExerciseName(exerciseName);
    setActiveTab("analysis");
  }
}

const tabSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  paddingBottom: 16,
};

function devCopyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    margin: 0,
  };
}

function devCodeStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    fontFamily: theme.fonts.mono,
  };
}
