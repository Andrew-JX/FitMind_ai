import { useTheme } from "../theme/ThemeContext";

export interface StatTrioEntry {
  label: string;
  unit: string;
  value: string;
}

/**
 * Design uses two sizes of the same grid: the roomier one on the training and
 * analysis tabs, and a tighter one inside the assistant's insight card.
 */
export type StatTrioSize = "md" | "sm";

export interface StatTrioProps {
  /** Inner corner radius: 16 on the training tab, 14 inside a padded card. */
  radius?: number | undefined;
  size?: StatTrioSize | undefined;
  stats: StatTrioEntry[];
}

interface StatTrioMetrics {
  cellPadding: string;
  labelSize: number;
  valueLetterSpacing: string | undefined;
  valueSize: number;
}

const METRICS: Record<StatTrioSize, StatTrioMetrics> = {
  md: {
    cellPadding: "12px 14px",
    labelSize: 11,
    valueLetterSpacing: "-0.3px",
    valueSize: 20,
  },
  sm: {
    cellPadding: "11px 12px",
    labelSize: 10,
    valueLetterSpacing: undefined,
    valueSize: 18,
  },
};

/**
 * Design's soft 3-cell statistic grid: label above a tabular-number value,
 * left aligned, split by hairline dividers.
 *
 * Shared by the training tab's overview strip, the analysis tab's 总览 card and
 * the assistant's insight overview, which are the same element in the design.
 *
 * @param props - Stat entries, corner radius, and size variant
 * @returns Statistic grid element
 */
export function StatTrio(props: StatTrioProps) {
  const { theme } = useTheme();
  const metrics = METRICS[props.size ?? "md"];

  return (
    <div style={gridStyle(theme, props.radius ?? 14, props.stats.length)}>
      {props.stats.map((stat, index) => (
        <div
          key={stat.label}
          style={cellStyle(theme, metrics, index < props.stats.length - 1)}
        >
          <span style={labelStyle(theme, metrics)}>{stat.label}</span>
          <div style={valueRowStyle}>
            <strong style={valueStyle(theme, metrics)}>{stat.value}</strong>
            <span style={unitStyle(theme)}>{stat.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function gridStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  radius: number,
  cellCount: number,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.soft,
    borderRadius: radius,
    display: "grid",
    gridTemplateColumns: `repeat(${cellCount}, minmax(0, 1fr))`,
    overflow: "hidden",
  };
}

function cellStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  metrics: StatTrioMetrics,
  hasDivider: boolean,
): React.CSSProperties {
  return {
    borderRight: hasDivider ? `1px solid ${theme.colors.divider}` : "none",
    display: "grid",
    gap: 4,
    padding: metrics.cellPadding,
  };
}

const valueRowStyle: React.CSSProperties = {
  alignItems: "baseline",
  display: "flex",
  gap: 3,
  whiteSpace: "nowrap",
};

function labelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  metrics: StatTrioMetrics,
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: metrics.labelSize,
  };
}

function valueStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  metrics: StatTrioMetrics,
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: metrics.valueSize,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 800,
    ...(metrics.valueLetterSpacing
      ? { letterSpacing: metrics.valueLetterSpacing }
      : {}),
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
