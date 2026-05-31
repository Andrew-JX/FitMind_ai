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
            <h2 style={titleStyle}>确定性分析</h2>
            <p style={copyStyle(theme)}>
              基于你的训练日志进行规则计算，所有结论都可以追溯到原始 workout 和
              set。
            </p>
          </div>
          <Badge tone="info">Deterministic</Badge>
        </div>
        <p style={subtleStyle(theme)}>
          这里展示的是后端 calculation layer 的结构化结果，不是 AI
          生成建议，后续会被助手通过 Tool Calling 读取。
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
