import { useMemo, useState } from "react";

import { SegmentedControl } from "../../components/SegmentedControl";
import {
  ANALYSIS_RANGE_OPTIONS,
  createAnalysisRange,
  type AnalysisRangeKey,
} from "./analysis-range";
import { AnalysisOverviewCard } from "./AnalysisOverviewCard";
import { ExerciseProgressPanel } from "./ExerciseProgressPanel";
import {
  ExerciseProgressSheet,
  type ExerciseProgressSheetExercise,
} from "./ExerciseProgressSheet";
import { MuscleLoadPanel } from "./MuscleLoadPanel";
import { useMuscleLoad } from "./use-muscle-load";
import { useTrainingSummary } from "./use-training-summary";
import { WeeklyVolumeCard } from "./WeeklyVolumeCard";

export interface AnalysisViewProps {
  /** Reports the focused exercise so the assistant can answer about it. */
  onExerciseSelect: (exerciseId: string, exerciseName: string) => void;
  refreshSignal: number;
  selectedExerciseId: string | null;
  token: string | null;
}

/**
 * Analysis tab: one range control drives every card below it
 * (总览 / 肌群容量占比 / 动作进展), with a fixed trailing-4-week volume chart.
 *
 * @param props - Auth token, refresh signal, and exercise selection wiring
 * @returns Analysis tab element
 */
export function AnalysisView(props: AnalysisViewProps) {
  const { refreshSignal, selectedExerciseId, token } = props;
  const [rangeKey, setRangeKey] = useState<AnalysisRangeKey>("last30");
  const [sheetExercise, setSheetExercise] =
    useState<ExerciseProgressSheetExercise | null>(null);
  const range = useMemo(() => createAnalysisRange(rangeKey), [rangeKey]);
  const summaryState = useTrainingSummary(token, range, refreshSignal);
  const muscleLoadState = useMuscleLoad(token, range, refreshSignal);
  const exercises = summaryState.summary?.by_exercise ?? [];

  return (
    <section style={viewStyle}>
      <SegmentedControl
        label="分析范围"
        onChange={setRangeKey}
        options={ANALYSIS_RANGE_OPTIONS.map((option) => ({
          label: option.label,
          value: option.key,
        }))}
        value={rangeKey}
      />

      <AnalysisOverviewCard
        errorMessage={summaryState.errorMessage}
        isLoading={summaryState.isLoading}
        onSelectExercise={(exercise) => {
          setSheetExercise({
            exercise_id: exercise.exercise_id,
            exercise_name: exercise.exercise_name,
          });
          props.onExerciseSelect(exercise.exercise_id, exercise.exercise_name);
        }}
        rangeKey={rangeKey}
        requestedRange={range}
        summary={summaryState.summary}
      />

      <MuscleLoadPanel
        errorMessage={muscleLoadState.errorMessage}
        isLoading={muscleLoadState.isLoading}
        muscleLoad={muscleLoadState.muscleLoad}
      />

      <ExerciseProgressPanel
        exercises={exercises}
        onSelectExerciseId={(exerciseId) => {
          const exercise = exercises.find(
            (candidate) => candidate.exercise_id === exerciseId,
          );

          if (exercise) {
            props.onExerciseSelect(
              exercise.exercise_id,
              exercise.exercise_name,
            );
          }
        }}
        range={range}
        refreshSignal={refreshSignal}
        selectedExerciseId={selectedExerciseId}
        token={token}
      />

      <WeeklyVolumeCard refreshSignal={refreshSignal} token={token} />

      <ExerciseProgressSheet
        exercise={sheetExercise}
        onClose={() => setSheetExercise(null)}
        range={range}
        rangeKey={rangeKey}
        refreshSignal={refreshSignal}
        token={token}
      />
    </section>
  );
}

const viewStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};
