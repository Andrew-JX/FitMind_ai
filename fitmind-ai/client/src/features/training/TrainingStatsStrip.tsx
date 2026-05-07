import type { TrainingSummary } from "./training-summary-api";

import { Card } from "../../components/Card";
import { StatCell } from "../../components/StatCell";
import { useTheme } from "../../theme/ThemeContext";

export interface TrainingStatsStripProps {
  summary: TrainingSummary | null;
  summaryLoading: boolean;
}

export function TrainingStatsStrip(props: TrainingStatsStripProps) {
  const { theme } = useTheme();
  const workoutCount = props.summary?.totals.workout_count ?? 0;
  const totalVolume = props.summary?.totals.total_volume ?? 0;
  const setCount = props.summary?.totals.set_count ?? 0;

  return (
    <Card padding="14px">
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>训练概览</h2>
          <p style={copyStyle(theme)}>
            {props.summaryLoading ? "正在同步本月训练数据..." : "基于当前训练总结的快速统计"}
          </p>
        </div>
      </div>
      <div style={statsGridStyle}>
        <StatCell label="本月训练" tone="accent" unit="次" value={`${workoutCount}`} />
        <StatCell
          label="总容量"
          tone="info"
          unit="kg"
          value={totalVolume.toLocaleString()}
        />
        <StatCell label="总组数" tone="analysis" unit="组" value={`${setCount}`} />
      </div>
    </Card>
  );
}

const headerStyle: React.CSSProperties = {
  marginBottom: 12,
};

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  margin: 0,
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};

function copyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "6px 0 0",
  };
}
