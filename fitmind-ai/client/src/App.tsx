import { useEffect, useMemo, useRef, useState } from "react";

import {
  getFeedbackSourceRoute,
  type AppTabKey,
  type HistoryViewMode,
} from "./app-navigation";
import { AppShell } from "./components/AppShell";
import { AssistantWorkspace } from "./features/assistant/AssistantWorkspace";
import { AuthScreen } from "./features/auth/AuthScreen";
import { ConsentCatchupScreen } from "./features/auth/ConsentCatchupScreen";
import { clearPendingConsent } from "./features/auth/use-auth";
import { withdrawAllHealthData } from "./features/profile/personal-tools-api";
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
import { HistoryView } from "./features/training/HistoryView";
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
  const [historyMode, setHistoryMode] = useState<HistoryViewMode>("history");
  const [selectedProgressExerciseId, setSelectedProgressExerciseId] = useState<
    string | null
  >(null);
  const [selectedProgressExerciseName, setSelectedProgressExerciseName] =
    useState<string | null>(null);
  const [analysisRefreshSignal, setAnalysisRefreshSignal] = useState(0);
  const [assistantRefreshSignal, setAssistantRefreshSignal] = useState(0);
  // Set only by an interactive login, so a cookie-restored session on boot
  // still lands straight on the app with no dwell.
  const isInteractiveLoginRef = useRef(false);
  const [isHoldingAuthScreen, setIsHoldingAuthScreen] = useState(false);
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

  // Design: after a successful login the submit button draws a checkmark before
  // the app appears, so hold the auth screen for that beat.
  useEffect(() => {
    if (auth.status !== "authenticated" || !isInteractiveLoginRef.current) {
      return;
    }

    isInteractiveLoginRef.current = false;
    setIsHoldingAuthScreen(true);

    const timerId = window.setTimeout(() => {
      setIsHoldingAuthScreen(false);
    }, LOGIN_SUCCESS_DWELL_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [auth.status]);

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

  if (!(auth.status === "authenticated" && auth.user) || isHoldingAuthScreen) {
    return (
      <AuthScreen
        errorMessage={auth.errorMessage}
        isAuthenticated={auth.status === "authenticated"}
        onLogin={auth.login}
        onRegister={auth.register}
        onSubmitStart={() => {
          isInteractiveLoginRef.current = true;
        }}
        status={auth.status}
      />
    );
  }

  // Blocks the app for accounts that predate the consent seam. Placed after the
  // auth gate and before everything else on purpose: these users are correctly
  // signed in, and the missing thing is permission, not authentication.
  if (auth.pendingConsents.length > 0) {
    return (
      <ConsentCatchupScreen
        onAccept={auth.acceptPendingConsent}
        onDecline={auth.logout}
        onDeleteAccount={auth.deleteAccount}
        onWithdrawHealthData={async () => {
          // Only the deletion is awaited, so only the deletion can report a
          // failure. Following it with `refreshAuth()` used to mean a momentary
          // `/me` hiccup logged the user out with an authentication error
          // straight after they exercised a privacy right — the server had done
          // exactly what was asked, and the app punished them for it.
          await withdrawAllHealthData();

          // The debt is gone because all of its subjects are gone: injury,
          // menstrual, and body-measurement data are deleted together.
          clearPendingConsent("sensitive_health_data");
        }}
        pendingConsents={auth.pendingConsents}
      />
    );
  }

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      secondaryAction={
        <FeedbackButton
          sourceRoute={getFeedbackSourceRoute(activeTab, historyMode)}
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
        />
      </section>

      <section style={tabSectionStyle(activeTab === "history")}>
        <HistoryView
          analysisProps={{
            onExerciseSelect: handleExerciseSelect,
            refreshSignal: analysisRefreshSignal,
            selectedExerciseId: selectedProgressExerciseId,
            token: auth.token,
          }}
          exercisePickerProps={{
            exercises: exerciseSearch.exercises,
            isLoadingExercises: exerciseSearch.isLoadingExercises,
            isLoadingMuscleGroups: exerciseSearch.isLoadingMuscleGroups,
            muscleGroups: exerciseSearch.muscleGroups,
            onSearch: exerciseSearch.searchExercises,
            searchError: exerciseSearch.searchError,
          }}
          onModeChange={setHistoryMode}
          token={auth.token}
          workoutsProps={{
            deleteError: workouts.deleteError,
            deletingWorkoutId: workouts.deletingWorkoutId,
            detailError: workouts.detailError,
            hasMoreWorkouts: workouts.hasMoreWorkouts,
            isLoadingDetail: workouts.isLoadingDetail,
            isLoadingList: workouts.isLoadingList,
            isLoadingMoreWorkouts: workouts.isLoadingMoreWorkouts,
            listError: workouts.listError,
            onDeleteWorkout: handleDeleteWorkout,
            onWorkoutEdited: handleWorkoutCreated,
            onLoadMoreWorkouts: workouts.loadMoreWorkouts,
            onRefresh: workouts.refreshWorkouts,
            onSelectWorkout: workouts.selectWorkout,
            selectedWorkout: workouts.selectedWorkout,
            selectedWorkoutId: workouts.selectedWorkoutId,
            token: auth.token,
            workouts: workouts.workouts,
          }}
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

function tabSectionStyle(isActive: boolean): React.CSSProperties {
  return {
    display: isActive ? "grid" : "none",
    gap: 16,
    paddingBottom: 16,
  };
}

/**
 * How long the auth screen stays up after the session goes live.
 *
 * The checkmark finishes drawing 600ms in (0.1s delay + 0.5s draw), so this
 * matches the design prototype's ~950ms hold and leaves the completed check on
 * screen rather than cutting away mid-stroke.
 */
const LOGIN_SUCCESS_DWELL_MS = 950;

const bootstrapScreenStyle: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  minHeight: "100vh",
  padding: 24,
  color: "#94a3b8",
  fontSize: 14,
};
