import type { TrainingSummary } from "./training-summary-api";
import type { ExerciseProgressPanelProps } from "./ExerciseProgressPanel";
import type { MuscleLoadPanelProps } from "./MuscleLoadPanel";
import type { RecommendationContextPanelProps } from "./RecommendationContextPanel";
import type { TrainingSummaryPanelProps } from "./TrainingSummaryPanel";

import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { useTheme } from "../../theme/ThemeContext";
import { ExerciseProgressPanel } from "./ExerciseProgressPanel";
import { MuscleLoadPanel } from "./MuscleLoadPanel";
import { RecommendationContextPanel } from "./RecommendationContextPanel";
import { TrainingSummaryPanel } from "./TrainingSummaryPanel";

export interface AnalysisViewProps {
  muscleLoadProps: MuscleLoadPanelProps;
  progressProps: ExerciseProgressPanelProps;
  recommendationProps: RecommendationContextPanelProps;
  summary: TrainingSummary | null;
  summaryProps: TrainingSummaryPanelProps;
}

export function AnalysisView(props: AnalysisViewProps) {
  const { theme } = useTheme();

  return (
    <section style={viewStyle}>
      <Card>
        <div style={headerRowStyle}>
          <div>
            <h2 style={titleStyle}>训练分析</h2>
            <p style={copyStyle(theme)}>
              基于你的训练记录计算近期训练量、动作进展和肌群负荷。
            </p>
          </div>
          <Badge tone="info">数据分析</Badge>
        </div>
        <p style={subtleStyle(theme)}>
          这里展示的是训练数据分析结果，智能助手回答时也会参考这些记录。
        </p>
      </Card>

      <TrainingSummaryPanel {...props.summaryProps} summary={props.summary} />
      <MuscleLoadPanel {...props.muscleLoadProps} />
      <ExerciseProgressPanel {...props.progressProps} />
      <RecommendationContextPanel {...props.recommendationProps} />
    </section>
  );
}

const viewStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const headerRowStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  margin: 0,
};

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 13,
    lineHeight: 1.6,
    margin: "6px 0 0",
  };
}

function subtleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    lineHeight: 1.6,
    margin: "10px 0 0",
  };
}
