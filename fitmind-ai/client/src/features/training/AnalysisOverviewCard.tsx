import { Card } from "../../components/Card";
import { StateNotice } from "../../components/StateNotice";
import { StatTrio, type StatTrioEntry } from "../../components/StatTrio";
import { useTheme } from "../../theme/ThemeContext";
import {
  formatDisplayDate,
  type AnalysisDateRange,
  type AnalysisRangeKey,
} from "./analysis-range";
import type {
  TrainingSummary,
  TrainingSummaryExercise,
} from "./training-summary-api";

export interface AnalysisOverviewCardProps {
  errorMessage: string | null;
  isLoading: boolean;
  onSelectExercise: (exercise: TrainingSummaryExercise) => void;
  rangeKey: AnalysisRangeKey;
  requestedRange: AnalysisDateRange;
  summary: TrainingSummary | null;
}

/** How many exercises the scannable list shows before 查看更多 is needed. */
const EXERCISE_PREVIEW_COUNT = 5;

/**
 * Analysis tab's 总览 card: the design's 3-stat grid plus a factual range note,
 * followed by the volume-ranked exercise list that opens the progress drawer.
 *
 * @param props - Summary payload, its state, and the exercise tap handler
 * @returns Overview card element
 */
export function AnalysisOverviewCard(props: AnalysisOverviewCardProps) {
  const { theme } = useTheme();
  const { errorMessage, isLoading, rangeKey, requestedRange, summary } = props;
  const isEmpty =
    summary !== null &&
    summary.totals.workout_count === 0 &&
    summary.by_exercise.length === 0;
  const topExercises =
    summary?.by_exercise.slice(0, EXERCISE_PREVIEW_COUNT) ?? [];

  const stats: StatTrioEntry[] = [
    {
      label: "训练次数",
      unit: "次",
      value: `${summary?.totals.workout_count ?? 0}`,
    },
    {
      label: "总容量",
      unit: "公斤",
      value: Math.round(summary?.totals.total_volume ?? 0).toLocaleString(),
    },
    { label: "总组数", unit: "组", value: `${summary?.totals.set_count ?? 0}` },
  ];

  return (
    <Card>
      <div style={bodyStyle}>
        <div style={headerRowStyle}>
          <h3 style={titleStyle}>总览</h3>
          <span style={eyebrowStyle(theme)}>确定性统计</span>
        </div>

        {errorMessage ? (
          <StateNotice
            description="请确认登录状态有效，或切换范围重试。"
            icon="chart"
            title="分析数据加载失败"
            tone="error"
          />
        ) : (
          <>
            <StatTrio stats={stats} />
            <p style={noteStyle(theme)}>
              {buildRangeNote(rangeKey, summary?.range ?? requestedRange)}
            </p>
          </>
        )}

        {isLoading && !summary ? (
          <p style={noteStyle(theme)}>正在加载分析数据...</p>
        ) : null}

        {isEmpty ? (
          <StateNotice
            description="完成训练记录后，这里会展示训练次数、总容量和动作排行。"
            icon="chart"
            title="暂无分析数据"
          />
        ) : null}

        {topExercises.length > 0 ? (
          <div style={listStyle(theme)}>
            {topExercises.map((exercise) => (
              <button
                key={exercise.exercise_id}
                onClick={() => props.onSelectExercise(exercise)}
                style={rowStyle(theme)}
                type="button"
              >
                <span style={rowNameStyle(theme)}>
                  {exercise.exercise_name}
                </span>
                <span style={rowMetaStyle(theme)}>
                  {Math.round(exercise.total_volume).toLocaleString()} 公斤 ·{" "}
                  {exercise.set_count} 组
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * Builds the note under the stats.
 *
 * The 近 7 天 / 近 30 天 wording echoes the range the server actually used, so
 * the sentence can never label a window it did not measure. 全部 asks from a
 * floor date, so it says 累计 rather than printing that placeholder date.
 *
 * @param rangeKey - Selected range key
 * @param range - Range echoed by the server, or the requested one before load
 * @returns Note sentence
 */
function buildRangeNote(
  rangeKey: AnalysisRangeKey,
  range: AnalysisDateRange,
): string {
  if (rangeKey === "all") {
    return "累计数据 · 从首次记录开始统计。";
  }

  return `统计范围 ${formatDisplayDate(range.start_date)} 至 ${formatDisplayDate(range.end_date)} · 来自训练日志的确定性计算。`;
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

function noteStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 12, lineHeight: 1.6, margin: 0 };
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

/** Design's soft list row, made tappable so it can open the progress drawer. */
function rowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${theme.colors.divider}`,
    color: theme.colors.tx,
    cursor: "pointer",
    display: "flex",
    gap: 8,
    justifyContent: "space-between",
    minHeight: 44,
    padding: "11px 14px",
    textAlign: "left",
    width: "100%",
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
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function rowMetaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    flex: "0 0 auto",
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
  };
}
