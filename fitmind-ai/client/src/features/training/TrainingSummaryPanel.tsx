import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import { AnalysisStatsGrid } from "./AnalysisStatsGrid";
import { ExerciseInsightCard } from "./ExerciseInsightCard";
import type { TrainingSummary } from "./training-summary-api";

export interface TrainingSummaryPanelProps {
  errorMessage: string | null;
  isLoading: boolean;
  onExerciseSelect?: (exerciseId: string, exerciseName: string) => void;
  onRefresh: () => Promise<void>;
  selectedExerciseId?: string | null;
  summary: TrainingSummary | null;
}

export function TrainingSummaryPanel(props: TrainingSummaryPanelProps) {
  const { theme } = useTheme();
  const {
    errorMessage,
    isLoading,
    onExerciseSelect,
    onRefresh,
    selectedExerciseId,
    summary,
  } = props;
  const hasEmptyState =
    summary !== null &&
    summary.totals.workout_count === 0 &&
    summary.by_exercise.length === 0;
  const topExercises = summary?.by_exercise.slice(0, 5) ?? [];

  return (
    <Card>
      <div style={headerStyle}>
        <div>
          <div style={titleRowStyle}>
            <h2 style={titleStyle}>30 天总览</h2>
            <Badge tone="accent">Training Summary</Badge>
          </div>
          <p style={copyStyle(theme)}>
            {summary
              ? `范围：${formatRangeLabel(summary.range.start_date, summary.range.end_date)}`
              : "范围：最近 30 天"}
          </p>
          <p style={subtleStyle(theme)}>
            统计结果来自训练日志的确定性计算，可继续点击动作查看进展。
          </p>
        </div>

        <Button
          disabled={isLoading}
          onClick={() => void onRefresh()}
          type="button"
          variant="secondary"
        >
          {isLoading ? "刷新中..." : "刷新"}
        </Button>
      </div>

      {errorMessage ? (
        <StateNotice
          description="请确认后端服务已启动，或稍后重试。"
          icon="chart"
          title="数据加载失败"
          tone="error"
        />
      ) : null}

      {isLoading && !summary ? (
        <p style={copyStyle(theme)}>正在加载分析数据...</p>
      ) : null}

      {hasEmptyState ? (
        <StateNotice
          description="完成训练记录后，这里会展示总容量、动作排行和进展趋势。"
          icon="chart"
          title="暂无分析数据"
        />
      ) : null}

      {summary ? (
        <>
          <AnalysisStatsGrid totals={summary.totals} />

          <div style={exerciseSectionStyle(theme)}>
            <div style={sectionIntroStyle}>
              <h3 style={subheadingStyle}>重点动作</h3>
              <p style={sectionCopyStyle(theme)}>
                按总容量排序，点击动作可查看进展。
              </p>
            </div>

            {topExercises.length === 0 ? (
              <p style={copyStyle(theme)}>当前范围内还没有动作汇总数据。</p>
            ) : (
              <div style={exerciseListStyle}>
                {topExercises.map((exercise) => (
                  <ExerciseInsightCard
                    exercise={exercise}
                    isSelected={selectedExerciseId === exercise.exercise_id}
                    key={exercise.exercise_id}
                    onSelect={() =>
                      onExerciseSelect?.(
                        exercise.exercise_id,
                        exercise.exercise_name,
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </Card>
  );
}

function formatRangeLabel(startDate: string, endDate: string): string {
  return `${formatDisplayDate(startDate)} 至 ${formatDisplayDate(endDate)}`;
}

function formatDisplayDate(value: string): string {
  const [yearValue, monthValue, dayValue] = value.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return value;
  }

  return new Date(year, month - 1, day).toLocaleDateString("zh-CN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const headerStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 16,
  justifyContent: "space-between",
  marginBottom: 16,
};

const titleRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  marginBottom: 4,
};

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  margin: 0,
};

const subheadingStyle: React.CSSProperties = {
  fontSize: 15,
  margin: 0,
};

const sectionIntroStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const exerciseListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 12,
};

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 12, lineHeight: 1.6, margin: 0 };
}

function subtleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    lineHeight: 1.6,
    margin: "8px 0 0",
  };
}

function exerciseSectionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    borderRadius: theme.radius.card,
    marginTop: 16,
    padding: 14,
  };
}

function sectionCopyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    lineHeight: 1.6,
    margin: 0,
  };
}
