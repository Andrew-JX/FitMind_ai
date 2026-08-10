import { useState } from "react";

import type { HistoryViewMode } from "../../app-navigation";
import type { ExercisePickerProps } from "./ExercisePicker";
import type { AnalysisViewProps } from "./AnalysisView";
import type { TrainingSessionInitialDraft } from "./training-session-draft";
import type { WorkoutsPanelProps } from "./WorkoutsPanel";

import { SegmentedControl } from "../../components/SegmentedControl";
import { AnalysisView } from "./AnalysisView";
import { TrainingSessionComposer } from "./TrainingSessionComposer";
import { WorkoutsPanel } from "./WorkoutsPanel";
import { getWorkoutDetail } from "./workout-api";
import { mapWorkoutToSessionInitialDraft } from "./workout-to-session-draft";

export interface HistoryViewProps {
  analysisProps: AnalysisViewProps;
  exercisePickerProps: ExercisePickerProps;
  onModeChange?: ((mode: HistoryViewMode) => void) | undefined;
  token: string | null;
  workoutsProps: Omit<WorkoutsPanelProps, "onEditWorkout">;
}

/**
 * Shared history destination. Training records remain the default view, while
 * the former standalone analysis page is one deliberate switch away.
 */
export function HistoryView(props: HistoryViewProps) {
  const [mode, setMode] = useState<HistoryViewMode>("history");
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [initialDraft, setInitialDraft] =
    useState<TrainingSessionInitialDraft | null>(null);

  return (
    <section style={viewStyle}>
      <div style={modeControlStyle}>
        <SegmentedControl
          label="历史页面视图"
          onChange={handleModeChange}
          options={[
            { label: "历史", value: "history" },
            { label: "分析", value: "analysis" },
          ]}
          value={mode}
        />
      </div>

      <section
        aria-hidden={mode !== "history"}
        style={contentStyle(mode === "history")}
      >
        <WorkoutsPanel
          {...props.workoutsProps}
          onEditWorkout={(workoutId) => void handleEditWorkout(workoutId)}
        />
      </section>

      <section
        aria-hidden={mode !== "analysis"}
        style={contentStyle(mode === "analysis")}
      >
        <AnalysisView {...props.analysisProps} />
      </section>

      <TrainingSessionComposer
        exerciseLibraryProps={props.exercisePickerProps}
        initialDraft={initialDraft}
        isOpen={editingWorkoutId !== null}
        mode="edit_existing"
        onCancel={closeEditor}
        onCreated={handleWorkoutEdited}
        token={props.token}
      />
    </section>
  );

  function handleModeChange(nextMode: HistoryViewMode): void {
    setMode(nextMode);
    props.onModeChange?.(nextMode);
  }

  async function handleEditWorkout(workoutId: string): Promise<void> {
    if (!props.token) {
      return;
    }

    const detail =
      props.workoutsProps.selectedWorkoutId === workoutId &&
      props.workoutsProps.selectedWorkout
        ? props.workoutsProps.selectedWorkout
        : await getWorkoutDetail(props.token, workoutId);

    setInitialDraft(
      mapWorkoutToSessionInitialDraft(
        detail,
        props.exercisePickerProps.exercises,
      ),
    );
    setEditingWorkoutId(workoutId);
  }

  async function handleWorkoutEdited(): Promise<void> {
    if (!editingWorkoutId) {
      closeEditor();
      return;
    }

    if (props.workoutsProps.onWorkoutEdited) {
      await props.workoutsProps.onWorkoutEdited();
    } else {
      await props.workoutsProps.onRefresh();
    }
    await props.workoutsProps.onSelectWorkout(editingWorkoutId);
    closeEditor();
  }

  function closeEditor(): void {
    setEditingWorkoutId(null);
    setInitialDraft(null);
  }
}

const viewStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const modeControlStyle: React.CSSProperties = {
  margin: "2px auto 0",
  maxWidth: 240,
  width: "68%",
};

function contentStyle(isActive: boolean): React.CSSProperties {
  return {
    display: isActive ? "grid" : "none",
    gap: 16,
  };
}
