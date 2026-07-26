import { Card } from "../../components/Card";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import type { MuscleLoadGroup, MuscleLoadResponse } from "./muscle-load-api";

export interface MuscleLoadPanelProps {
  errorMessage: string | null;
  isLoading: boolean;
  muscleLoad: MuscleLoadResponse | null;
}

/**
 * Analysis tab's 肌群容量占比 card.
 *
 * Bar width is the group's share of total weighted volume (not a share of the
 * largest group), so the bars read as a distribution the way the design's
 * percentages do.
 *
 * @param props - Muscle-load payload plus its loading and error state
 * @returns Muscle-share card element
 */
export function MuscleLoadPanel(props: MuscleLoadPanelProps) {
  const { theme } = useTheme();
  const { errorMessage, isLoading, muscleLoad } = props;
  const groups = muscleLoad?.by_muscle_group ?? [];
  const hasNoWorkouts =
    muscleLoad !== null &&
    muscleLoad.totals.workout_count === 0 &&
    groups.length === 0;
  const hasThinEvidence =
    muscleLoad !== null &&
    muscleLoad.totals.workout_count > 0 &&
    (muscleLoad.totals.total_weighted_volume === 0 || groups.length === 0);

  return (
    <Card>
      <div style={bodyStyle}>
        <div style={headerRowStyle}>
          <h3 style={titleStyle}>肌群容量占比</h3>
          <span style={eyebrowStyle(theme)}>加权容量口径</span>
        </div>

        {errorMessage ? (
          <StateNotice
            description="请确认登录状态有效，或切换范围重试。"
            icon="chart"
            title="肌群负荷加载失败"
            tone="error"
          />
        ) : null}

        {isLoading && !muscleLoad ? (
          <p style={copyStyle(theme)}>正在加载肌群负荷分析...</p>
        ) : null}

        {hasNoWorkouts ? (
          <StateNotice
            description="完成 1-2 次带重量和次数的训练后，这里会按动作-肌群贡献权重展示训练分布。"
            icon="chart"
            title="暂无肌群负荷数据"
          />
        ) : null}

        {hasThinEvidence ? (
          <StateNotice
            description="当前范围内已有训练记录，但还缺少可计算的有效组数或动作-肌群映射。"
            icon="chart"
            title="肌群证据还不够完整"
            tone="warning"
          />
        ) : null}

        {groups.length > 0 ? (
          <>
            <div style={listStyle(theme)}>
              {groups.map((group, index) => (
                <MuscleShareRow
                  color={getGroupColor(theme, index)}
                  group={group}
                  key={group.muscle_group_id}
                />
              ))}
            </div>

            {muscleLoad ? (
              <details style={detailsStyle(theme)}>
                <summary style={summaryStyle(theme)}>
                  查看计算规则与证据（{muscleLoad.evidence.workout_ids.length}{" "}
                  条训练 · {muscleLoad.evidence.set_ids.length} 条组数）
                </summary>
                <ul style={rulesListStyle(theme)}>
                  {muscleLoad.evidence.calculation_rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}

interface MuscleShareRowProps {
  color: string;
  group: MuscleLoadGroup;
}

function MuscleShareRow(props: MuscleShareRowProps) {
  const { theme } = useTheme();
  const { color, group } = props;
  const sharePercent = clampPercent(group.contribution_ratio * 100);

  return (
    <div style={rowStyle(theme)}>
      <div style={rowHeaderStyle}>
        <span style={rowLabelStyle}>
          <span style={dotStyle(color)} />
          <span style={rowNameStyle(theme)}>{group.muscle_group_name}</span>
        </span>
        <span style={rowValueStyle(theme)}>{formatPercent(sharePercent)}</span>
      </div>
      <div style={trackStyle(theme)}>
        <div style={fillStyle(color, sharePercent)} />
      </div>
    </div>
  );
}

/** Rank-ordered dot colors, mirroring the design's neon → blue → amber → red. */
function getGroupColor(
  theme: ReturnType<typeof useTheme>["theme"],
  index: number,
): string {
  const palette = [
    theme.colors.ac,
    theme.colors.blue,
    theme.colors.orange,
    theme.colors.red,
    theme.colors.purple,
    theme.colors.green,
    theme.colors.pink,
  ];

  return palette[index % palette.length] ?? theme.colors.ac;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

const bodyStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const headerRowStyle: React.CSSProperties = {
  alignItems: "baseline",
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

function eyebrowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx3, fontSize: 11 };
}

function listStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.soft,
    borderRadius: 14,
    display: "grid",
    overflow: "hidden",
  };
}

function rowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    borderBottom: `1px solid ${theme.colors.divider}`,
    display: "grid",
    gap: 7,
    padding: "12px 14px",
  };
}

const rowHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
};

const rowLabelStyle: React.CSSProperties = {
  alignItems: "center",
  display: "inline-flex",
  gap: 8,
  minWidth: 0,
};

function dotStyle(color: string): React.CSSProperties {
  return {
    background: color,
    borderRadius: 999,
    flex: "0 0 auto",
    height: 8,
    width: 8,
  };
}

function rowNameStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "-0.1px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function rowValueStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    flex: "0 0 auto",
    fontSize: 13,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
  };
}

function trackStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.bdr,
    borderRadius: 999,
    height: 5,
    overflow: "hidden",
  };
}

function fillStyle(color: string, percent: number): React.CSSProperties {
  return {
    background: color,
    borderRadius: 999,
    height: 5,
    transition: "width 0.6s cubic-bezier(0.65, 0, 0.35, 1)",
    width: `${percent}%`,
  };
}

function detailsStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.soft,
    borderRadius: 14,
    padding: "11px 14px",
  };
}

function summaryStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
  };
}

function rulesListStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    display: "grid",
    fontSize: 11,
    gap: 6,
    lineHeight: 1.6,
    margin: "10px 0 0",
    paddingLeft: "1rem",
  };
}

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 12, lineHeight: 1.6, margin: 0 };
}
