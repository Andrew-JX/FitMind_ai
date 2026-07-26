import type { TrainingSummary } from "./training-summary-api";

import { StatTrio, type StatTrioEntry } from "../../components/StatTrio";
import { useTheme } from "../../theme/ThemeContext";

export interface TrainingStatsStripProps {
  summary: TrainingSummary | null;
  summaryLoading: boolean;
}

/**
 * Training-tab overview: the design's glossy card wrapping a soft 3-cell grid
 * of tabular-number stats (次数 / 总容量 / 总组数).
 *
 * @param props - Latest training summary and its loading flag
 * @returns The 3-stat overview card
 */
export function TrainingStatsStrip(props: TrainingStatsStripProps) {
  const { theme } = useTheme();
  const workoutCount = props.summary?.totals.workout_count ?? 0;
  const totalVolume = props.summary?.totals.total_volume ?? 0;
  const setCount = props.summary?.totals.set_count ?? 0;

  const stats: StatTrioEntry[] = [
    { label: "近 30 天训练", unit: "次", value: `${workoutCount}` },
    { label: "总容量", unit: "公斤", value: totalVolume.toLocaleString() },
    { label: "总组数", unit: "组", value: `${setCount}` },
  ];

  return (
    <div style={outerStyle(theme)}>
      <StatTrio radius={16} stats={stats} />
    </div>
  );
}

function outerStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: `${theme.gradients.card}, ${theme.colors.surf}`,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    boxShadow: theme.shadows.card,
    padding: 5,
  };
}
