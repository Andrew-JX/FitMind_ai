import { useEffect, useState } from "react";

import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { Pill } from "../../components/Pill";
import { StatCell } from "../../components/StatCell";
import { HttpClientError } from "../../services/http-client";
import { useTheme } from "../../theme/ThemeContext";
import {
  getExerciseProgress,
  type ExerciseProgress,
  type ExerciseProgressRange,
} from "./exercise-progress-api";

export interface ExerciseProgressPanelProps {
  refreshSignal: number;
  selectedExerciseId: string | null;
  selectedExerciseName: string | null;
  token: string | null;
}

export function ExerciseProgressPanel(props: ExerciseProgressPanelProps) {
  const { refreshSignal, selectedExerciseId, selectedExerciseName, token } = props;
  const { theme } = useTheme();
  const [progress, setProgress] = useState<ExerciseProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [range] = useState<ExerciseProgressRange>(() => createDefaultRange());

  useEffect(() => {
    let isActive = true;

    async function loadProgress(): Promise<void> {
      if (!token || !selectedExerciseId) {
        setProgress(null);
        setIsLoading(false);
        setErrorMessage(null);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextProgress = await getExerciseProgress(token, {
          endDate: range.end_date,
          exerciseId: selectedExerciseId,
          startDate: range.start_date,
        });

        if (!isActive) {
          return;
        }

        setProgress(nextProgress);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setProgress(null);
        setErrorMessage(getReadableErrorMessage(error));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadProgress();

    return () => {
      isActive = false;
    };
  }, [range.end_date, range.start_date, refreshSignal, selectedExerciseId, token]);

  if (!selectedExerciseId) {
    return (
      <Card>
        <div style={titleRowStyle}>
          <h2 style={titleStyle}>当前动作进步</h2>
          <Badge tone="analysis">Exercise Progress</Badge>
        </div>
        <p style={copyStyle(theme)}>
          先在上方训练概览里选择一个动作，再查看它近 30 天的确定性进展。
        </p>
      </Card>
    );
  }

  const displayExerciseName =
    selectedExerciseName?.trim() ||
    progress?.exercise.exercise_name ||
    "当前动作";
  const hasEmptyState =
    progress !== null &&
    progress.totals.workout_count === 0 &&
    progress.sessions.length === 0;
  const recentSessions = progress?.sessions.slice(-5).reverse() ?? [];

  return (
    <Card>
      <div style={headerStyle}>
        <div>
          <div style={titleRowStyle}>
            <h2 style={titleStyle}>当前动作进步</h2>
            <Badge tone="analysis">Exercise Progress</Badge>
          </div>
          <p style={copyStyle(theme)}>{displayExerciseName}</p>
          <p style={subtleStyle(theme)}>
            范围：{formatRangeLabel(range.start_date, range.end_date)}
          </p>
        </div>
      </div>

      {errorMessage ? <p style={errorStyle(theme)}>错误：{errorMessage}</p> : null}
      {isLoading && !progress ? <p style={copyStyle(theme)}>正在加载动作进展...</p> : null}
      {hasEmptyState ? (
        <p style={copyStyle(theme)}>最近 30 天还没有这个动作的训练组数据。</p>
      ) : null}

      {progress ? (
        <>
          <div style={statsGridStyle}>
            <StatCell label="训练次数" tone="accent" value={progress.totals.workout_count.toLocaleString()} />
            <StatCell label="总组数" tone="info" value={progress.totals.set_count.toLocaleString()} />
            <StatCell label="总次数" tone="analysis" value={progress.totals.total_reps.toLocaleString()} />
            <StatCell label="总容量" tone="warning" value={progress.totals.total_volume.toLocaleString()} />
            <StatCell label="最大重量" tone="success" value={formatMetric(progress.totals.max_weight_kg, "kg")} />
            <StatCell label="预计 1RM" tone="success" value={formatMetric(progress.totals.estimated_1rm_kg, "kg")} />
          </div>

          <div style={sessionSectionStyle(theme)}>
            <h3 style={subheadingStyle}>最近训练记录</h3>
            {recentSessions.length === 0 ? (
              <p style={copyStyle(theme)}>当前范围内暂时没有最近训练记录。</p>
            ) : (
              <ul style={sessionListStyle}>
                {recentSessions.map((session) => (
                  <li key={session.workout_id} style={sessionItemStyle(theme)}>
                    <div style={sessionHeaderStyle}>
                      <strong>{formatDisplayDateTime(session.performed_at)}</strong>
                      <Pill tone="accent">
                        {session.total_volume.toLocaleString()} volume
                      </Pill>
                    </div>
                    <div style={sessionMetaStyle(theme)}>
                      {session.set_count.toLocaleString()} 组 | {session.total_reps.toLocaleString()} 次
                    </div>
                    <div style={sessionMetaStyle(theme)}>
                      最大重量 {formatMetric(session.max_weight_kg, "kg")} | 预计 1RM{" "}
                      {formatMetric(session.estimated_1rm_kg, "kg")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </Card>
  );
}

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "动作进展暂时不可用。";
}

function createDefaultRange(): ExerciseProgressRange {
  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 29);

  return {
    end_date: formatDateOnly(endDate),
    start_date: formatDateOnly(startDate),
  };
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
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
  });
}

function formatDisplayDateTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("zh-CN", {
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        month: "short",
      });
}

function formatMetric(value: number | null, unit: string): string {
  if (value === null) {
    return "N/A";
  }

  return `${value.toLocaleString()} ${unit}`;
}

const headerStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
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

const sessionListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const sessionHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
  marginBottom: 6,
};

function copyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return { color: theme.colors.tx2, margin: 0 };
}

function subtleStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return { color: theme.colors.tx3, margin: "0.35rem 0 0" };
}

function errorStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return { color: theme.colors.orange, marginBottom: 16 };
}

function sessionSectionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    borderRadius: 14,
    padding: "0.9rem",
  };
}

function sessionItemStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    padding: "0.75rem",
  };
}

function sessionMetaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: "0.95rem" };
}
