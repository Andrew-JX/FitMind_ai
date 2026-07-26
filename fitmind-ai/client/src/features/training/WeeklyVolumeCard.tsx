import { useEffect, useMemo, useState } from "react";

import { Card } from "../../components/Card";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import { createWeeklyBuckets } from "./analysis-range";
import { getTrainingSummary } from "./training-summary-api";

export interface WeeklyVolumeCardProps {
  refreshSignal: number;
  token: string | null;
}

/** Design draws 4 columns labelled W1 / W2 / W3 / 本周. */
const WEEK_COUNT = 4;
/** Keep a non-zero week visible even next to a much bigger one. */
const MIN_BAR_HEIGHT_PERCENT = 6;

interface WeeklyVolumeBar {
  isCurrentWeek: boolean;
  label: string;
  totalVolume: number;
}

/**
 * Analysis tab's 每周训练容量 card.
 *
 * The training endpoints have no weekly bucket, so this asks the summary
 * endpoint once per Sunday-to-Saturday week — real per-week totals rather than
 * a derived guess. The window is fixed at the trailing 4 weeks, independent of
 * the page's range control, exactly as the design labels it.
 *
 * @param props - Auth token and the refresh signal
 * @returns Weekly-volume card element
 */
export function WeeklyVolumeCard(props: WeeklyVolumeCardProps) {
  const { theme } = useTheme();
  const { refreshSignal, token } = props;
  const buckets = useMemo(() => createWeeklyBuckets(WEEK_COUNT), []);
  const [bars, setBars] = useState<WeeklyVolumeBar[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadWeeklyVolume(): Promise<void> {
      if (!token) {
        setBars(null);
        setErrorMessage(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const summaries = await Promise.all(
          buckets.map((bucket) =>
            getTrainingSummary(token, {
              endDate: bucket.range.end_date,
              startDate: bucket.range.start_date,
            }),
          ),
        );

        if (!isActive) {
          return;
        }

        setBars(
          buckets.map((bucket, index) => ({
            isCurrentWeek: index === buckets.length - 1,
            label: bucket.label,
            totalVolume: summaries[index]?.totals.total_volume ?? 0,
          })),
        );
      } catch {
        if (!isActive) {
          return;
        }

        setBars(null);
        setErrorMessage("每周容量暂时不可用。");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadWeeklyVolume();

    return () => {
      isActive = false;
    };
  }, [buckets, refreshSignal, token]);

  const peakVolume = (bars ?? []).reduce(
    (peak, bar) => Math.max(peak, bar.totalVolume),
    0,
  );

  return (
    <Card>
      <div style={bodyStyle}>
        <div style={headerRowStyle}>
          <h3 style={titleStyle}>每周训练容量</h3>
          <span style={eyebrowStyle(theme)}>近 {WEEK_COUNT} 周</span>
        </div>

        {errorMessage ? (
          <StateNotice
            description="请确认登录状态有效，或稍后重试。"
            icon="chart"
            title="每周容量加载失败"
            tone="error"
          />
        ) : null}

        {isLoading && !bars ? (
          <p style={copyStyle(theme)}>正在加载每周容量...</p>
        ) : null}

        {bars ? (
          <div style={insetStyle(theme)}>
            <div style={chartStyle}>
              {bars.map((bar) => (
                <div key={bar.label} style={columnStyle}>
                  <div style={barStyle(theme, bar, peakVolume)} />
                  <span style={labelStyle(theme, bar.isCurrentWeek)}>
                    {bar.label}
                  </span>
                </div>
              ))}
            </div>
            <p style={footnoteStyle(theme)}>
              {peakVolume > 0
                ? `本周累计 ${Math.round(bars[bars.length - 1]?.totalVolume ?? 0).toLocaleString()} 公斤 · 周起始为周日`
                : "近 4 周还没有带重量的训练记录。"}
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  );
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

function insetStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.soft,
    borderRadius: 14,
    display: "grid",
    gap: 10,
    padding: "16px 14px 12px",
  };
}

const chartStyle: React.CSSProperties = {
  alignItems: "end",
  display: "grid",
  gap: 10,
  gridTemplateColumns: `repeat(${WEEK_COUNT}, 1fr)`,
  height: 110,
};

/**
 * One week column: bar then label.
 *
 * @remarks
 * Same fix as the exercise chart — the design's auto rows leave the bar's
 * percentage height with no definite track to resolve against, so it collapses
 * to 0 in Chromium. `minmax(0, 1fr)` gives it one.
 */
const columnStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  gridTemplateRows: "minmax(0, 1fr) auto",
  height: "100%",
  justifyItems: "center",
};

/**
 * One weekly bar.
 *
 * The current week keeps the design's fixed neon green plus its glow in both
 * themes, matching the always-neon FAB.
 *
 * @param theme - Active theme tokens
 * @param bar - Bar data
 * @param peakVolume - Largest volume across the rendered weeks
 * @returns Bar style
 */
function barStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  bar: WeeklyVolumeBar,
  peakVolume: number,
): React.CSSProperties {
  const rawHeight = peakVolume > 0 ? (bar.totalVolume / peakVolume) * 100 : 0;

  return {
    alignSelf: "end",
    background: bar.isCurrentWeek ? "#c8f035" : theme.colors.bar,
    borderRadius: "8px 8px 4px 4px",
    boxShadow: bar.isCurrentWeek ? "0 0 16px rgba(200,240,53,0.25)" : "none",
    height: `${bar.totalVolume > 0 ? Math.max(Math.round(rawHeight), MIN_BAR_HEIGHT_PERCENT) : 0}%`,
    transition: "height 0.6s cubic-bezier(0.65, 0, 0.35, 1)",
    width: 30,
  };
}

function labelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isCurrentWeek: boolean,
): React.CSSProperties {
  return {
    color: isCurrentWeek ? theme.colors.ac : theme.colors.tx2,
    fontSize: 12,
    fontWeight: isCurrentWeek ? 700 : 400,
  };
}

function footnoteStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    borderTop: `1px solid ${theme.colors.divider}`,
    color: theme.colors.tx3,
    fontSize: 11,
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
