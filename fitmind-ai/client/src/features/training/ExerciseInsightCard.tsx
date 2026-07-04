import type { TrainingSummaryExercise } from "./training-summary-api";

import { Button } from "../../components/Button";
import { Pill } from "../../components/Pill";
import { useTheme } from "../../theme/ThemeContext";

export interface ExerciseInsightCardProps {
  exercise: TrainingSummaryExercise;
  isSelected: boolean;
  onSelect: () => void;
}

export function ExerciseInsightCard(props: ExerciseInsightCardProps) {
  const { theme } = useTheme();

  return (
    <article style={cardStyle(theme, props.isSelected)}>
      <div style={topRowStyle}>
        <div>
          <strong style={titleStyle(theme)}>
            {props.exercise.exercise_name}
          </strong>
          <p style={metaStyle(theme)}>
            总容量 {props.exercise.total_volume.toLocaleString()} 公斤
          </p>
        </div>
        {props.isSelected ? <Pill tone="accent">当前查看</Pill> : null}
      </div>

      <p style={subMetaStyle(theme)}>
        {props.exercise.set_count.toLocaleString()} 组 ·{" "}
        {props.exercise.total_reps.toLocaleString()} 次
      </p>

      <Button
        onClick={props.onSelect}
        style={{ marginTop: 10, width: "100%" }}
        type="button"
        variant="secondary"
      >
        {props.isSelected ? "继续查看动作进展" : "查看动作进展"}
      </Button>
    </article>
  );
}

const topRowStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 10,
  justifyContent: "space-between",
};

function cardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isSelected: boolean,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${isSelected ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    padding: 12,
  };
}

function titleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    display: "block",
    fontSize: 14,
    marginBottom: 4,
  };
}

function metaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.5,
    margin: 0,
  };
}

function subMetaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    lineHeight: 1.5,
    margin: "8px 0 0",
  };
}
