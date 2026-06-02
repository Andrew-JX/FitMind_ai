import type { TrainingSummaryTotals } from "./training-summary-api";

import { StatCell } from "../../components/StatCell";

export interface AnalysisStatsGridProps {
  totals: TrainingSummaryTotals;
}

export function AnalysisStatsGrid(props: AnalysisStatsGridProps) {
  const { totals } = props;

  return (
    <div style={gridStyle}>
      <StatCell label="训练次数" tone="accent" unit="次" value={`${totals.workout_count}`} />
      <StatCell
        label="总容量"
        tone="info"
        unit="公斤"
        value={totals.total_volume.toLocaleString()}
      />
      <StatCell label="总组数" tone="analysis" unit="组" value={`${totals.set_count}`} />
      <StatCell label="总次数" tone="warning" unit="次" value={`${totals.total_reps}`} />
    </div>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};
