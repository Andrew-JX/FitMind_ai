import { ActionSheet } from "../../components/ActionSheet";
import { useTheme } from "../../theme/ThemeContext";
import {
  formatDisplayDate,
  formatMonthDay,
  type AnalysisDateRange,
  type AnalysisRangeKey,
} from "./analysis-range";
import { ExerciseProgressChart } from "./ExerciseProgressChart";
import { useExerciseProgress } from "./use-exercise-progress";

export interface ExerciseProgressSheetExercise {
  exercise_id: string;
  exercise_name: string;
}

export interface ExerciseProgressSheetProps {
  exercise: ExerciseProgressSheetExercise | null;
  onClose: () => void;
  range: AnalysisDateRange;
  rangeKey: AnalysisRangeKey;
  refreshSignal: number;
  token: string | null;
}

/** Recent sessions listed under the chart. */
const RECENT_SESSION_COUNT = 5;

/**
 * Bottom drawer that shows one exercise's history without leaving the analysis
 * tab: the same chart as the 动作进展 card plus the recent sessions behind it.
 *
 * @param props - Tapped exercise, active range, and close handler
 * @returns Progress drawer, or null when nothing is selected
 */
export function ExerciseProgressSheet(props: ExerciseProgressSheetProps) {
  const { theme } = useTheme();
  const { exercise, range, rangeKey, refreshSignal, token } = props;
  const progressState = useExerciseProgress(
    token,
    exercise?.exercise_id ?? null,
    range,
    refreshSignal,
  );

  if (!exercise) {
    return null;
  }

  const progress =
    progressState.progress?.exercise.exercise_id === exercise.exercise_id
      ? progressState.progress
      : null;
  const recentSessions = progress?.sessions.slice(-RECENT_SESSION_COUNT) ?? [];

  return (
    <ActionSheet
      description={buildRangeDescription(rangeKey, range)}
      onClose={props.onClose}
      open
      title={exercise.exercise_name}
    >
      <ExerciseProgressChart
        errorMessage={progressState.errorMessage}
        isLoading={progressState.isLoading}
        progress={progress}
      />

      {progress ? (
        <section style={sectionStyle}>
          <h3 style={sectionTitleStyle(theme)}>
            {progress.totals.estimated_1rm_kg === null
              ? "范围内汇总"
              : `范围内汇总 · 估算最大重量 ${formatWeight(progress.totals.estimated_1rm_kg)} 公斤`}
          </h3>
          <p style={copyStyle(theme)}>
            {progress.totals.workout_count} 次训练 · {progress.totals.set_count}{" "}
            组 · {progress.totals.total_reps} 次 · 总容量{" "}
            {Math.round(progress.totals.total_volume).toLocaleString()} 公斤
          </p>
        </section>
      ) : null}

      {recentSessions.length > 0 ? (
        <section style={sectionStyle}>
          <h3 style={sectionTitleStyle(theme)}>最近记录</h3>
          <div style={listStyle(theme)}>
            {recentSessions
              .slice()
              .reverse()
              .map((session) => (
                <div key={session.workout_id} style={rowStyle(theme)}>
                  <span style={rowDateStyle(theme)}>
                    {formatMonthDay(session.performed_at)}
                  </span>
                  <span style={rowMetaStyle(theme)}>
                    {session.set_count} 组 · {session.total_reps} 次 · 最高{" "}
                    {session.max_weight_kg === null
                      ? "—"
                      : `${formatWeight(session.max_weight_kg)} 公斤`}
                  </span>
                </div>
              ))}
          </div>
        </section>
      ) : null}

      {progress ? (
        <details style={detailsStyle(theme)}>
          <summary style={summaryStyle(theme)}>
            查看计算规则与证据（{progress.evidence.workout_ids.length} 条训练 ·{" "}
            {progress.evidence.set_ids.length} 条组数）
          </summary>
          <ul style={rulesListStyle(theme)}>
            {progress.evidence.calculation_rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </ActionSheet>
  );
}

function buildRangeDescription(
  rangeKey: AnalysisRangeKey,
  range: AnalysisDateRange,
): string {
  if (rangeKey === "all") {
    return "累计数据 · 从首次记录开始统计。";
  }

  return `统计范围 ${formatDisplayDate(range.start_date)} 至 ${formatDisplayDate(range.end_date)}。`;
}

function formatWeight(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(1))}`;
}

const sectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

function sectionTitleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "-0.1px",
    margin: 0,
  };
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
    alignItems: "center",
    borderBottom: `1px solid ${theme.colors.divider}`,
    display: "flex",
    gap: 8,
    justifyContent: "space-between",
    padding: "11px 14px",
  };
}

function rowDateStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 13,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
  };
}

function rowMetaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
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
