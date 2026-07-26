import { useTheme } from "../theme/ThemeContext";

export interface StatTrioEntry {
  label: string;
  unit: string;
  value: string;
}

export interface StatTrioProps {
  /** Inner corner radius: 16 on the training tab, 14 inside a padded card. */
  radius?: number | undefined;
  stats: StatTrioEntry[];
}

/**
 * Design's soft 3-cell statistic grid: label above a tabular-number value,
 * left aligned, split by hairline dividers.
 *
 * Shared by the training tab's overview strip and the analysis tab's 总览 card,
 * which are the same element in the design.
 *
 * @param props - Stat entries and the inner corner radius
 * @returns Statistic grid element
 */
export function StatTrio(props: StatTrioProps) {
  const { theme } = useTheme();

  return (
    <div style={gridStyle(theme, props.radius ?? 14, props.stats.length)}>
      {props.stats.map((stat, index) => (
        <div
          key={stat.label}
          style={cellStyle(theme, index < props.stats.length - 1)}
        >
          <span style={labelStyle(theme)}>{stat.label}</span>
          <div style={valueRowStyle}>
            <strong style={valueStyle(theme)}>{stat.value}</strong>
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
  hasDivider: boolean,
): React.CSSProperties {
  return {
    borderRight: hasDivider ? `1px solid ${theme.colors.divider}` : "none",
    display: "grid",
    gap: 4,
    padding: "12px 14px",
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
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
  };
}

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
