import { useState } from "react";

import type { ExercisePickerProps } from "./ExercisePicker";
import type { WorkoutFormProps } from "./WorkoutForm";
import type { WorkoutsPanelProps } from "./WorkoutsPanel";
import type { TrainingSummary } from "./training-summary-api";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ExercisePicker } from "./ExercisePicker";
import { TrainingSessionComposer } from "./TrainingSessionComposer";
import { TrainingStatsStrip } from "./TrainingStatsStrip";
import { WorkoutsPanel } from "./WorkoutsPanel";

export interface TrainingViewProps {
  exercisePickerProps: ExercisePickerProps;
  summary: TrainingSummary | null;
  summaryLoading: boolean;
  workoutFormProps: WorkoutFormProps;
  workoutsProps: WorkoutsPanelProps;
}

export function TrainingView(props: TrainingViewProps) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);

  return (
    <section style={viewStyle}>
      <TrainingStatsStrip
        summary={props.summary}
        summaryLoading={props.summaryLoading}
      />

      {!isComposerOpen ? (
        <Button
          onClick={() => setIsComposerOpen(true)}
          style={{ width: "100%" }}
          type="button"
        >
          + 记录训练
        </Button>
      ) : null}

      <WorkoutsPanel {...props.workoutsProps} />

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
        isOpen={isComposerOpen}
        onCancel={() => setIsComposerOpen(false)}
        onCreated={async () => {
          await props.workoutFormProps.onCreated?.();
          setIsComposerOpen(false);
        }}
        token={props.workoutFormProps.token}
      />
    </section>
  );
}

const viewStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
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
