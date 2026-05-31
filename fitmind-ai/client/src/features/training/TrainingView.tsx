import { useState } from "react";

import type { ExercisePickerProps } from "./ExercisePicker";
import type { WorkoutFormProps } from "./WorkoutForm";
import type { WorkoutsPanelProps } from "./WorkoutsPanel";
import type { TrainingSummary } from "./training-summary-api";
import type { TrainingSessionInitialDraft } from "./training-session-draft";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ExercisePicker } from "./ExercisePicker";
import { TrainingSessionComposer } from "./TrainingSessionComposer";
import { TrainingStatsStrip } from "./TrainingStatsStrip";
import { WorkoutIntakePanel } from "./WorkoutIntakePanel";
import { WorkoutsPanel } from "./WorkoutsPanel";
import { getWorkoutDetail } from "./workout-api";
import { mapWorkoutIntakeDraftToSessionInitialDraft } from "./workout-intake-to-session-draft";
import { mapWorkoutToSessionInitialDraft } from "./workout-to-session-draft";

export interface TrainingViewProps {
  exercisePickerProps: ExercisePickerProps;
  summary: TrainingSummary | null;
  summaryLoading: boolean;
  workoutFormProps: WorkoutFormProps;
  workoutsProps: Omit<WorkoutsPanelProps, "onEditWorkout">;
}

export function TrainingView(props: TrainingViewProps) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<
    "create_active" | "create_from_intake" | "edit_existing"
  >("create_active");
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [pendingInitialDraft, setPendingInitialDraft] =
    useState<TrainingSessionInitialDraft | null>(null);

  return (
    <section style={viewStyle}>
      <TrainingStatsStrip
        summary={props.summary}
        summaryLoading={props.summaryLoading}
      />

      {!isComposerOpen ? (
        <div style={recordActionsStyle}>
          <Button
            onClick={() => {
              setComposerMode("create_active");
              setPendingInitialDraft(null);
              setIsComposerOpen(true);
            }}
            style={{ flex: 1 }}
            type="button"
          >
            + 记录训练
          </Button>
          <WorkoutIntakePanel
            onDraftParsed={(draft) => {
              setPendingInitialDraft(
                mapWorkoutIntakeDraftToSessionInitialDraft(
                  draft,
                  props.exercisePickerProps.exercises,
                ),
              );
              setComposerMode("create_from_intake");
              setIsComposerOpen(true);
            }}
            token={props.workoutFormProps.token}
          />
        </div>
      ) : null}

      <WorkoutsPanel
        {...props.workoutsProps}
        onEditWorkout={(workoutId) => void handleEditWorkout(workoutId)}
      />

      <Card>
        <div style={dictionaryHeaderStyle}>
          <div>
            <h2 style={dictionaryTitleStyle}>动作词典</h2>
            <p style={dictionaryCopyStyle}>
              用于查询系统内置动作名称和肌群标签，不影响当前训练记录。
            </p>
          </div>
          <Button
            onClick={() => setIsDictionaryOpen((currentValue) => !currentValue)}
            type="button"
            variant="secondary"
          >
            {isDictionaryOpen ? "收起" : "展开"}
          </Button>
        </div>

        {isDictionaryOpen ? (
          <div style={{ marginTop: 12 }}>
            <ExercisePicker {...props.exercisePickerProps} />
          </div>
        ) : null}
      </Card>

      <TrainingSessionComposer
        exerciseLibraryProps={props.exercisePickerProps}
        initialDraft={pendingInitialDraft}
        isOpen={isComposerOpen}
        mode={composerMode}
        onCancel={() => {
          setIsComposerOpen(false);
          setEditingWorkoutId(null);
          setPendingInitialDraft(null);
          setComposerMode("create_active");
        }}
        onCreated={async () => {
          if (composerMode === "edit_existing" && editingWorkoutId) {
            await props.workoutsProps.onRefresh();
            await props.workoutsProps.onSelectWorkout(editingWorkoutId);
            await props.workoutFormProps.onCreated?.();
          } else {
            await props.workoutFormProps.onCreated?.();
          }
          setIsComposerOpen(false);
          setEditingWorkoutId(null);
          setPendingInitialDraft(null);
          setComposerMode("create_active");
        }}
        token={props.workoutFormProps.token}
      />
    </section>
  );

  async function handleEditWorkout(workoutId: string): Promise<void> {
    const token = props.workoutFormProps.token;

    if (!token) {
      return;
    }

    const detail =
      props.workoutsProps.selectedWorkoutId === workoutId &&
      props.workoutsProps.selectedWorkout
        ? props.workoutsProps.selectedWorkout
        : await getWorkoutDetail(token, workoutId);

    setPendingInitialDraft(
      mapWorkoutToSessionInitialDraft(detail, props.exercisePickerProps.exercises),
    );
    setEditingWorkoutId(workoutId);
    setComposerMode("edit_existing");
    setIsComposerOpen(true);
  }
}

const viewStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const recordActionsStyle: React.CSSProperties = {
  alignItems: "stretch",
  display: "flex",
  gap: 10,
};

const dictionaryHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const dictionaryTitleStyle: React.CSSProperties = {
  fontSize: 16,
  margin: 0,
};

const dictionaryCopyStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.6,
  margin: "6px 0 0",
  opacity: 0.82,
};
