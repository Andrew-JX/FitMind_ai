import { useEffect, useState } from "react";

import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { Icon } from "../../components/Icon";
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
          <h2 style={titleStyle}>动作进展</h2>
          <Badge tone="analysis">Exercise Progress</Badge>
        </div>
        <div style={emptyStateStyle()}>
          <div style={emptyIconStyle(theme)}>
            <Icon name="target" size={20} />
          </div>
          <p style={copyStyle(theme)}>从上方选择一个动作，查看最近训练表现。</p>
        </div>
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
            <h2 style={titleStyle}>动作进展</h2>
            <Badge tone="analysis">Exercise Progress</Badge>
          </div>
          <p style={copyStyle(theme)}>{displayExerciseName}</p>
          <p style={subtleStyle(theme)}>
            范围：{formatRangeLabel(range.start_date, range.end_date)}
          </p>
        </div>
      </div>

      {errorMessage ? <p style={errorStyle(theme)}>{translateProgressError(errorMessage)}</p> : null}
      {isLoading && !progress ? <p style={copyStyle(theme)}>正在加载动作进展...</p> : null}
      {hasEmptyState ? (
        <p style={copyStyle(theme)}>最近 30 天还没有这个动作的训练记录。</p>
      ) : null}

      {progress ? (
        <>
          <div style={statsGridStyle}>
            <StatCell
              label="最大重量"
              tone="success"
              unit="kg"
              value={formatMetricValue(progress.totals.max_weight_kg)}
            />
            <StatCell
              label="估算 1RM"
              tone="accent"
              unit="kg"
              value={formatMetricValue(progress.totals.estimated_1rm_kg)}
            />
            <StatCell
              label="训练次数"
              tone="info"
              unit="次"
              value={`${progress.totals.workout_count}`}
            />
            <StatCell
              label="最近记录"
              tone="analysis"
              unit="次"
              value={`${recentSessions.length}`}
            />
          </div>

          <div style={sessionSectionStyle(theme)}>
            <div style={sectionHeaderStyle}>
              <h3 style={subheadingStyle}>最近 5 次记录</h3>
              <Pill tone="analysis">evidence</Pill>
            </div>
            {recentSessions.length === 0 ? (
              <p style={copyStyle(theme)}>当前范围内暂时没有最近记录。</p>
            ) : (
              <ul style={sessionListStyle}>
                {recentSessions.map((session) => (
                  <li key={session.workout_id} style={sessionItemStyle(theme)}>
                    <strong style={{ fontSize: 14 }}>
                      {formatDisplayDateTime(session.performed_at)}
                    </strong>
                    <p style={sessionTitleStyle(theme)}>
                      {displayExerciseName} · {session.set_count} 组
                    </p>
                    <div style={sessionMetaStyle(theme)}>
                      最高 {formatMetricValue(session.max_weight_kg)} kg · 估算 1RM{" "}
                      {formatMetricValue(session.estimated_1rm_kg)} kg
                    </div>
                    <div style={sessionMetaStyle(theme)}>
                      {session.total_reps.toLocaleString()} 次 · 容量{" "}
                      {session.total_volume.toLocaleString()} kg
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <details style={evidenceDetailsStyle(theme)}>
            <summary style={summaryStyle(theme)}>查看 evidence</summary>
            <div style={evidenceBodyStyle()}>
              <p style={evidenceTextStyle(theme)}>
                关联 workout：{progress.evidence.workout_ids.length} 条
              </p>
              <p style={evidenceTextStyle(theme)}>
                关联 set：{progress.evidence.set_ids.length} 条
              </p>
              <p style={evidenceTextStyle(theme)}>
                规则：{progress.evidence.calculation_rules.join(" / ") || "无"}
              </p>
            </div>
          </details>
        </>
      ) : null}
    </Card>
  );
}

function translateProgressError(message: string): string {
  return message.replaceAll("动作进展暂时不可用。", "动作进展加载失败");
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

function formatMetricValue(value: number | null): string {
  if (value === null) {
    return "0";
  }

  return value.toLocaleString();
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
  fontSize: 16,
  margin: 0,
};

const subheadingStyle: React.CSSProperties = {
  fontSize: 15,
  margin: 0,
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
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

const sectionHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
};

function copyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 12, lineHeight: 1.6, margin: 0 };
}

function subtleStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return { color: theme.colors.tx3, fontSize: 11, margin: "0.35rem 0 0" };
}

function errorStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return { color: theme.colors.orange, fontSize: 12, marginBottom: 16 };
}

function emptyStateStyle(): React.CSSProperties {
  return {
    alignItems: "center",
    display: "grid",
    gap: 10,
    justifyItems: "center",
    marginTop: 8,
    textAlign: "center",
  };
}

function emptyIconStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.surf2,
    borderRadius: theme.radius.card,
    color: theme.colors.tx3,
    display: "inline-flex",
    height: 40,
    justifyContent: "center",
    width: 40,
  };
}

function sessionSectionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    borderRadius: 14,
    padding: 14,
  };
}

function sessionItemStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    padding: 12,
  };
}

function sessionTitleStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    lineHeight: 1.5,
    margin: "4px 0 8px",
  };
}

function sessionMetaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 12, lineHeight: 1.6 };
}

function evidenceDetailsStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    borderRadius: theme.radius.control,
    marginTop: 14,
    padding: 12,
  };
}

function summaryStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.purple,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  };
}

function evidenceBodyStyle(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    marginTop: 10,
  };
}

function evidenceTextStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
  };
}
