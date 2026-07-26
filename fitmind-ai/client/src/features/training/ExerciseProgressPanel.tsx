import { Card } from "../../components/Card";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import type { AnalysisDateRange } from "./analysis-range";
import { ExerciseProgressChart } from "./ExerciseProgressChart";
import type { TrainingSummaryExercise } from "./training-summary-api";
import { useExerciseProgress } from "./use-exercise-progress";

export interface ExerciseProgressPanelProps {
  /** Volume-ranked exercises available in the current range. */
  exercises: TrainingSummaryExercise[];
  onSelectExerciseId: (exerciseId: string) => void;
  range: AnalysisDateRange;
  refreshSignal: number;
  selectedExerciseId: string | null;
  token: string | null;
}

/**
 * Analysis tab's 动作进展 card: pick an exercise in the header select and its
 * weight chart renders directly below, inside the same card.
 *
 * @param props - Selectable exercises, selection state, and the active range
 * @returns Exercise-progress card element
 */
export function ExerciseProgressPanel(props: ExerciseProgressPanelProps) {
  const { theme } = useTheme();
  const { exercises, range, refreshSignal, selectedExerciseId, token } = props;
  // Fall back to the highest-volume exercise so the card is never blank while
  // still letting a cross-page selection win.
  const activeExerciseId =
    exercises.find((exercise) => exercise.exercise_id === selectedExerciseId)
      ?.exercise_id ??
    exercises[0]?.exercise_id ??
    null;
  const progressState = useExerciseProgress(
    token,
    activeExerciseId,
    range,
    refreshSignal,
  );

  return (
    <Card>
      <div style={bodyStyle}>
        <div style={headerRowStyle}>
          <h3 style={titleStyle}>动作进展</h3>
          {exercises.length > 0 && activeExerciseId ? (
            <select
              aria-label="选择动作"
              onChange={(event) => props.onSelectExerciseId(event.target.value)}
              style={selectStyle(theme)}
              value={activeExerciseId}
            >
              {exercises.map((exercise) => (
                <option
                  key={exercise.exercise_id}
                  style={optionStyle(theme)}
                  value={exercise.exercise_id}
                >
                  {exercise.exercise_name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {exercises.length === 0 ? (
          <StateNotice
            description="当前范围内还没有动作记录，换个范围或记录一次训练后就会出现。"
            icon="target"
            title="暂无动作进展"
          />
        ) : (
          <ExerciseProgressChart
            errorMessage={progressState.errorMessage}
            isLoading={progressState.isLoading}
            progress={progressState.progress}
          />
        )}
      </div>
    </Card>
  );
}

const bodyStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const headerRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "-0.2px",
  margin: 0,
};

/**
 * Design's compact header select.
 *
 * @remarks
 * The background must stay opaque: the native dropdown paints its option list
 * with this color, so the design's translucent `--fm-div` would make the
 * options unreadable. Same reasoning as the exercise-library muscle filter.
 *
 * @param theme - Active theme tokens
 * @returns Select style
 */
function selectStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr2}`,
    borderRadius: 10,
    color: theme.colors.tx,
    font: "inherit",
    fontSize: 12,
    fontWeight: 600,
    maxWidth: "62%",
    padding: "7px 8px",
  };
}

function optionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    color: theme.colors.tx,
  };
}
