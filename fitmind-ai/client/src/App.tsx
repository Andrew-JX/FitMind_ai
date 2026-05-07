import { useEffect, useState } from "react";

import { AppShell, type AppTabKey } from "./components/AppShell";
import { Badge } from "./components/Badge";
import { Card } from "./components/Card";
import { StatCell } from "./components/StatCell";
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
import { ExercisePicker } from "./features/training/ExercisePicker";
import { ExerciseProgressPanel } from "./features/training/ExerciseProgressPanel";
import { RecommendationContextPanel } from "./features/training/RecommendationContextPanel";
import { TrainingSummaryPanel } from "./features/training/TrainingSummaryPanel";
import { WorkoutForm } from "./features/training/WorkoutForm";
import { WorkoutsPanel } from "./features/training/WorkoutsPanel";
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
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
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
          <Card>
            <div style={sectionHeadingRowStyle}>
              <div>
                <h2 style={{ margin: 0 }}>训练记录</h2>
                <p style={sectionCopyStyle(theme)}>
                  记录真实训练日志，作为后续确定性分析和 AI 助手回答的事实基础。
                </p>
              </div>
              <Badge tone="accent">Training</Badge>
            </div>
            <div style={statsGridStyle}>
              <StatCell
                label="近 30 天训练次数"
                tone="accent"
                value={`${trainingSummary.summary?.totals.workout_count ?? 0}`}
              />
              <StatCell
                label="近 30 天总组数"
                tone="info"
                value={`${trainingSummary.summary?.totals.set_count ?? 0}`}
              />
              <StatCell
                label="近 30 天总容量"
                tone="success"
                unit="kg"
                value={`${
                  trainingSummary.summary?.totals.total_volume.toLocaleString() ?? "0"
                }`}
              />
            </div>
          </Card>

          <WorkoutForm
            onCreated={async () => {
              await Promise.all([
                workouts.refreshWorkouts(),
                trainingSummary.refresh(),
              ]);
              setRecommendationContextRefreshSignal((currentValue) => currentValue + 1);

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

          <Card>
            <button
              onClick={() => setIsDictionaryOpen((currentValue) => !currentValue)}
              style={collapseButtonStyle(theme)}
              type="button"
            >
              <span>动作词典</span>
              <span>{isDictionaryOpen ? "收起" : "展开"}</span>
            </button>
            {isDictionaryOpen ? (
              <div style={{ marginTop: 16 }}>
                <ExercisePicker
                  exercises={exerciseSearch.exercises}
                  isLoadingExercises={exerciseSearch.isLoadingExercises}
                  isLoadingMuscleGroups={exerciseSearch.isLoadingMuscleGroups}
                  muscleGroups={exerciseSearch.muscleGroups}
                  onSearch={exerciseSearch.searchExercises}
                  searchError={exerciseSearch.searchError}
                />
              </div>
            ) : (
              <p style={collapsedCopyStyle(theme)}>
                用于查询动作中英文名、肌群和基础词典信息。默认收起，避免打断训练记录主流程。
              </p>
            )}
          </Card>
        </section>
      ) : null}

      {activeTab === "analysis" ? (
        <section style={tabSectionStyle}>
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
          <RecommendationContextPanel
            refreshSignal={recommendationContextRefreshSignal}
            token={auth.token}
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

const sectionHeadingRowStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
  marginBottom: 16,
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(3, 1fr)",
};

function sectionCopyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 13,
    lineHeight: 1.6,
    marginBottom: 0,
    marginTop: 6,
  };
}

function collapseButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: "transparent",
    border: "none",
    color: theme.colors.tx,
    cursor: "pointer",
    display: "flex",
    fontSize: 15,
    fontWeight: 700,
    justifyContent: "space-between",
    padding: 0,
    width: "100%",
  };
}

function collapsedCopyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    marginBottom: 0,
    marginTop: 12,
  };
}

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
