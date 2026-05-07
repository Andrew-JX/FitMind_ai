import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Pill } from "../../components/Pill";
import { StatCell } from "../../components/StatCell";
import { useTheme } from "../../theme/ThemeContext";
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
            <h2 style={titleStyle}>近 30 天训练概览</h2>
            <Badge tone="accent">Training Summary</Badge>
          </div>
          <p style={copyStyle(theme)}>
            {summary
              ? `范围：${formatRangeLabel(summary.range.start_date, summary.range.end_date)}`
              : "范围：最近 30 天"}
          </p>
        </div>

        <Button disabled={isLoading} onClick={() => void onRefresh()} type="button" variant="secondary">
          {isLoading ? "刷新中..." : "刷新"}
        </Button>
      </div>

      {errorMessage ? <p style={errorStyle(theme)}>错误：{errorMessage}</p> : null}
      {isLoading && !summary ? <p style={copyStyle(theme)}>正在加载训练概览...</p> : null}
      {hasEmptyState ? (
        <p style={copyStyle(theme)}>
          最近 30 天还没有训练记录。先在“训练”页创建一条训练，再回来看概览。
        </p>
      ) : null}

      {summary ? (
        <>
          <div style={statsGridStyle}>
            <StatCell label="Workouts" tone="accent" value={summary.totals.workout_count.toLocaleString()} />
            <StatCell label="Sets" tone="info" value={summary.totals.set_count.toLocaleString()} />
            <StatCell label="Total reps" tone="analysis" value={summary.totals.total_reps.toLocaleString()} />
            <StatCell label="Total volume" tone="warning" value={summary.totals.total_volume.toLocaleString()} />
          </div>

          <div style={exerciseSectionStyle(theme)}>
            <h3 style={subheadingStyle}>重点动作</h3>
            {topExercises.length === 0 ? (
              <p style={copyStyle(theme)}>当前范围内还没有动作汇总数据。</p>
            ) : (
              <ul style={exerciseListStyle}>
                {topExercises.map((exercise) => {
                  const isSelected = selectedExerciseId === exercise.exercise_id;

                  return (
                    <li key={exercise.exercise_id} style={{ listStyle: "none" }}>
                      <button
                        onClick={() =>
                          onExerciseSelect?.(exercise.exercise_id, exercise.exercise_name)
                        }
                        style={{
                          ...exerciseButtonStyle(theme),
                          borderColor: isSelected ? theme.colors.ac : theme.colors.bdr,
                          boxShadow: isSelected
                            ? `0 0 0 1px ${theme.colors.ac} inset`
                            : "none",
                        }}
                        type="button"
                      >
                        <div style={exerciseHeaderStyle}>
                          <strong>{exercise.exercise_name}</strong>
                          <Pill tone="accent">
                            {exercise.total_volume.toLocaleString()} volume
                          </Pill>
                        </div>
                        <div style={exerciseMetaStyle(theme)}>
                          {exercise.set_count.toLocaleString()} 组 |{" "}
                          {exercise.total_reps.toLocaleString()} 次
                        </div>
                        <div style={exerciseActionStyle(theme)}>
                          {isSelected ? "已选中，查看进展中" : "点击查看动作进展"}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
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
  alignItems: "center",
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
  fontSize: "1.1rem",
  margin: "0 0 0.25rem",
};

const subheadingStyle: React.CSSProperties = {
  fontSize: "1rem",
  margin: "0 0 0.75rem",
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(2, 1fr)",
  marginBottom: 16,
};

const exerciseListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const exerciseHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
  marginBottom: 6,
};

function copyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return { color: theme.colors.tx2, margin: 0 };
}

function errorStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return { color: theme.colors.orange, marginBottom: 16 };
}

function exerciseSectionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    borderRadius: theme.radius.card,
    padding: "0.9rem",
  };
}

function exerciseButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    color: theme.colors.tx,
    cursor: "pointer",
    display: "block",
    padding: "0.75rem",
    textAlign: "left",
    width: "100%",
  };
}

function exerciseMetaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: "0.95rem" };
}

function exerciseActionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.ac, fontSize: "0.85rem", marginTop: "0.45rem" };
}
