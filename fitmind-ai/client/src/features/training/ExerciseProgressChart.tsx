import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import { formatMonthDay } from "./analysis-range";
import type {
  ExerciseProgress,
  ExerciseProgressSession,
} from "./exercise-progress-api";

export interface ExerciseProgressChartProps {
  errorMessage: string | null;
  isLoading: boolean;
  progress: ExerciseProgress | null;
}

/** Design draws 3 bars; cap the real chart so bars keep their 36px width. */
const MAX_BARS = 8;
/** Keep a non-zero weight visible even when it is far below the peak. */
const MIN_BAR_HEIGHT_PERCENT = 6;

interface ChartBar {
  dateLabel: string;
  heightPercent: number;
  isLatest: boolean;
  weightKg: number;
}

/**
 * Design's exercise-progress chart: a bar per session with the weight above it,
 * the latest bar in neon green, and a deterministic one-line summary below.
 *
 * Only sessions that recorded a weight can appear — bodyweight-only logs have
 * no weight axis, so they get an explicit notice instead of a fabricated bar.
 *
 * @param props - Progress payload plus its loading and error state
 * @returns Chart element
 */
export function ExerciseProgressChart(props: ExerciseProgressChartProps) {
  const { theme } = useTheme();
  const { errorMessage, isLoading, progress } = props;

  if (errorMessage) {
    return (
      <StateNotice
        description="请确认登录状态有效，或切换范围重试。"
        icon="target"
        title="动作进展加载失败"
        tone="error"
      />
    );
  }

  if (isLoading && !progress) {
    return <p style={copyStyle(theme)}>正在加载动作进展...</p>;
  }

  if (!progress) {
    return null;
  }

  const weighedSessions = progress.sessions.filter(
    (session) => session.max_weight_kg !== null,
  );

  if (weighedSessions.length === 0) {
    return (
      <StateNotice
        description={
          progress.sessions.length > 0
            ? "这个动作在当前范围内的记录没有重量数据，暂时画不出重量进展。"
            : "当前范围内还没有这个动作的记录，换个范围或再练一次后就会出现。"
        }
        icon="target"
        title="暂无重量进展"
      />
    );
  }

  const bars = buildBars(weighedSessions);

  return (
    <div style={insetStyle(theme)}>
      <div style={barRowStyle}>
        {bars.map((bar) => (
          <div key={`${bar.dateLabel}-${bar.weightKg}`} style={barColumnStyle}>
            <span style={barValueStyle(theme, bar.isLatest)}>
              {formatWeight(bar.weightKg)}kg
            </span>
            <div style={barStyle(theme, bar)} />
            <span style={barDateStyle(theme)}>{bar.dateLabel}</span>
          </div>
        ))}
      </div>
      <p style={summaryStyle(theme)}>
        {buildSummary(weighedSessions.length, bars)}
      </p>
    </div>
  );
}

function buildBars(sessions: ExerciseProgressSession[]): ChartBar[] {
  const visible = sessions.slice(-MAX_BARS);
  const peakWeight = visible.reduce(
    (peak, session) => Math.max(peak, session.max_weight_kg ?? 0),
    0,
  );

  return visible.map((session, index) => {
    const weightKg = session.max_weight_kg ?? 0;
    const rawHeight = peakWeight > 0 ? (weightKg / peakWeight) * 100 : 0;

    return {
      dateLabel: formatMonthDay(session.performed_at),
      heightPercent:
        weightKg > 0
          ? Math.max(Math.round(rawHeight), MIN_BAR_HEIGHT_PERCENT)
          : 0,
      isLatest: index === visible.length - 1,
      weightKg,
    };
  });
}

/**
 * Builds the chart's summary line from the plotted bars only.
 *
 * Every claim here is arithmetic on the rendered data — no trend adjectives,
 * so the sentence cannot drift from what the bars show.
 *
 * @param sessionCount - Sessions with a weight in the whole range
 * @param bars - Bars actually plotted
 * @returns Summary sentence
 */
function buildSummary(sessionCount: number, bars: ChartBar[]): string {
  const firstBar = bars[0];
  const lastBar = bars[bars.length - 1];

  if (!firstBar || !lastBar) {
    return "";
  }

  const truncationNote =
    sessionCount > bars.length ? `，图表显示最近 ${bars.length} 次` : "";

  if (bars.length === 1) {
    return `范围内 ${sessionCount} 次带重量的记录 · 最大重量 ${formatWeight(lastBar.weightKg)} 公斤，再练两次就能看出趋势。`;
  }

  const delta = lastBar.weightKg - firstBar.weightKg;
  const deltaLabel =
    delta === 0
      ? "持平"
      : `${delta > 0 ? "+" : "-"}${formatWeight(Math.abs(delta))} 公斤`;

  return `范围内 ${sessionCount} 次带重量的记录${truncationNote} · 最大重量 ${formatWeight(firstBar.weightKg)} → ${formatWeight(lastBar.weightKg)} 公斤（${deltaLabel}）。`;
}

function formatWeight(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(1))}`;
}

/** Design: soft inset holding the bars and the summary line. */
function insetStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.soft,
    borderRadius: 14,
    display: "grid",
    gap: 12,
    padding: "16px 14px 12px",
  };
}

const barRowStyle: React.CSSProperties = {
  alignItems: "end",
  display: "flex",
  gap: 14,
  height: 110,
  justifyContent: "center",
  overflowX: "auto",
};

/**
 * One bar column: weight label, bar, date label.
 *
 * @remarks
 * The design uses `align-content:end` over auto rows, which makes the bar's
 * percentage height resolve against an auto-sized row — measured at 0px in
 * Chromium, so no bar renders at all. An explicit `minmax(0, 1fr)` middle row
 * gives the percentage a definite track to resolve against, which is what the
 * design's varying bar heights need.
 */
const barColumnStyle: React.CSSProperties = {
  display: "grid",
  flex: "0 0 auto",
  gap: 6,
  gridTemplateRows: "auto minmax(0, 1fr) auto",
  height: "100%",
  justifyItems: "center",
};

function barValueStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isLatest: boolean,
): React.CSSProperties {
  return {
    color: isLatest ? theme.colors.ac : theme.colors.tx3,
    fontSize: 14,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 800,
    letterSpacing: "-0.2px",
    whiteSpace: "nowrap",
  };
}

/**
 * One bar. The latest bar keeps the design's fixed neon green in both themes,
 * matching the weekly-volume chart's 本周 bar.
 *
 * @param theme - Active theme tokens
 * @param bar - Bar data
 * @returns Bar style
 */
function barStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  bar: ChartBar,
): React.CSSProperties {
  return {
    alignSelf: "end",
    background: bar.isLatest ? "#c8f035" : theme.colors.bar,
    borderRadius: "8px 8px 4px 4px",
    height: `${bar.heightPercent}%`,
    transition: "height 0.6s cubic-bezier(0.65, 0, 0.35, 1)",
    width: 36,
  };
}

function barDateStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    whiteSpace: "nowrap",
  };
}

function summaryStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    borderTop: `1px solid ${theme.colors.divider}`,
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
    paddingTop: 10,
  };
}

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 12, lineHeight: 1.6, margin: 0 };
}
