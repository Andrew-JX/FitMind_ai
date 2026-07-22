import type { TrainingSummary } from "./training-summary-api";

import { useTheme } from "../../theme/ThemeContext";

export interface TrainingStatsStripProps {
  summary: TrainingSummary | null;
  summaryLoading: boolean;
}

interface StatEntry {
  label: string;
  unit: string;
  value: string;
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

  const stats: StatEntry[] = [
    { label: "近 30 天训练", unit: "次", value: `${workoutCount}` },
    { label: "总容量", unit: "公斤", value: totalVolume.toLocaleString() },
    { label: "总组数", unit: "组", value: `${setCount}` },
  ];

  return (
    <div style={outerStyle(theme)}>
      <div style={gridStyle(theme)}>
        {stats.map((stat, index) => (
          <div key={stat.label} style={cellStyle(theme, index === 0)}>
            <div style={valueRowStyle}>
              <strong style={valueStyle(theme)}>{stat.value}</strong>
              <span style={unitStyle(theme)}>{stat.unit}</span>
            </div>
            <span style={labelStyle(theme)}>{stat.label}</span>
          </div>
        ))}
      </div>
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

function gridStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.soft,
    borderRadius: 16,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    overflow: "hidden",
  };
}

function cellStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isFirst: boolean,
): React.CSSProperties {
  return {
    borderLeft: isFirst ? "none" : `1px solid ${theme.colors.divider}`,
    display: "grid",
    gap: 5,
    justifyItems: "center",
    padding: "14px 8px",
  };
}

const valueRowStyle: React.CSSProperties = {
  alignItems: "baseline",
  display: "flex",
  gap: 3,
  whiteSpace: "nowrap",
};

function valueStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 20,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 800,
    letterSpacing: "-0.3px",
  };
}

function unitStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    flex: "0 0 auto",
    fontSize: 10,
  };
}

function labelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 11,
    textAlign: "center",
  };
}
