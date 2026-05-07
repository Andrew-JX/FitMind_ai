import { useEffect, useEffectEvent, useState } from "react";

import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Pill } from "../../components/Pill";
import { StateNotice } from "../../components/StateNotice";
import { HttpClientError } from "../../services/http-client";
import { useTheme } from "../../theme/ThemeContext";
import { AnalysisStatsGrid } from "./AnalysisStatsGrid";
import {
  getRecommendationContext,
  type RecommendationContext,
  type RecommendationContextRange,
} from "./recommendation-context-api";

export interface RecommendationContextPanelProps {
  refreshSignal: number;
  token: string | null;
}

export function RecommendationContextPanel(props: RecommendationContextPanelProps) {
  const { refreshSignal, token } = props;
  const { theme } = useTheme();
  const [context, setContext] = useState<RecommendationContext | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [range] = useState<RecommendationContextRange>(() => createDefaultRange());

  const refreshOnTokenChange = useEffectEvent(async () => {
    await refresh();
  });
  const refreshOnSignalChange = useEffectEvent(async () => {
    await refresh();
  });

  useEffect(() => {
    if (!token) {
      setContext(null);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    void refreshOnTokenChange();
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    void refreshOnSignalChange();
  }, [refreshSignal, token]);

  async function refresh(): Promise<void> {
    if (!token) {
      setErrorMessage("你必须先登录才能查看推荐上下文。");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextContext = await getRecommendationContext(token, {
        endDate: range.end_date,
        startDate: range.start_date,
      });
      setContext(nextContext);
    } catch (error) {
      setContext(null);
      setErrorMessage(getReadableErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  const hasEmptyState =
    context !== null &&
    context.summary.workout_count === 0 &&
    context.focus_exercises.length === 0 &&
    context.recent_workouts.length === 0;

  return (
    <Card>
      <div style={headerStyle}>
        <div>
          <div style={titleRowStyle}>
            <h2 style={titleStyle}>AI 可用上下文预览</h2>
            <Badge tone="info">Deterministic</Badge>
          </div>
          <p style={copyStyle(theme)}>
            {context
              ? `范围：${formatRangeLabel(context.range.start_date, context.range.end_date)}`
              : `范围：${formatRangeLabel(range.start_date, range.end_date)}`}
          </p>
          <p style={subtleStyle(theme)}>
            这里展示的是后端提供给 AI 助手的确定性上下文，不是模型直接生成的建议。
          </p>
        </div>

        <Button
          disabled={isLoading}
          onClick={() => void refresh()}
          type="button"
          variant="secondary"
        >
          {isLoading ? "刷新中..." : "刷新"}
        </Button>
      </div>

      {errorMessage ? (
        <StateNotice
          description="请确认后端服务已启动，或稍后重试。"
          icon="tool"
          title="数据加载失败"
          tone="error"
        />
      ) : null}

      {isLoading && !context ? <p style={copyStyle(theme)}>正在加载分析数据...</p> : null}

      {hasEmptyState ? (
        <StateNotice
          description="完成训练记录后，这里会展示总容量、动作排行和进展趋势。"
          icon="tool"
          title="暂无分析数据"
        />
      ) : null}

      {context ? (
        <>
          <section style={sectionCardStyle(theme)}>
            <div style={sectionHeaderStyle}>
              <h3 style={subheadingStyle}>训练摘要</h3>
              <Pill tone="accent">summary</Pill>
            </div>
            <AnalysisStatsGrid
              totals={{
                set_count: context.summary.set_count,
                total_reps: context.summary.total_reps,
                total_volume: context.summary.total_volume,
                workout_count: context.summary.workout_count,
              }}
            />
          </section>

          <div style={contentGridStyle}>
            <section style={sectionCardStyle(theme)}>
              <div style={sectionHeaderStyle}>
                <h3 style={subheadingStyle}>重点动作</h3>
                <Pill tone="analysis">focus_exercises</Pill>
              </div>
              {context.focus_exercises.length === 0 ? (
                <p style={copyStyle(theme)}>当前范围内没有重点动作。</p>
              ) : (
                <ul style={listStyle}>
                  {context.focus_exercises.map((exercise) => (
                    <li key={exercise.exercise_id} style={listItemStyle(theme)}>
                      <div style={itemHeaderStyle}>
                        <strong>{exercise.exercise_name}</strong>
                        <Pill tone="accent">{exercise.total_volume.toLocaleString()} kg</Pill>
                      </div>
                      <div style={itemMetaStyle(theme)}>
                        {exercise.workout_count.toLocaleString()} 次训练 ·{" "}
                        {exercise.set_count.toLocaleString()} 组 ·{" "}
                        {exercise.total_reps.toLocaleString()} 次
                      </div>
                      <div style={itemMetaStyle(theme)}>
                        最高 {formatMetric(exercise.max_weight_kg, "kg")} · 估算 1RM{" "}
                        {formatMetric(exercise.estimated_1rm_kg, "kg")}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section style={sectionCardStyle(theme)}>
              <div style={sectionHeaderStyle}>
                <h3 style={subheadingStyle}>最近训练</h3>
                <Pill tone="warning">recent_workouts</Pill>
              </div>
              {context.recent_workouts.length === 0 ? (
                <p style={copyStyle(theme)}>当前范围内没有最近训练。</p>
              ) : (
                <ul style={listStyle}>
                  {context.recent_workouts.map((workout) => (
                    <li key={workout.workout_id} style={listItemStyle(theme)}>
                      <div style={itemHeaderStyle}>
                        <strong>{formatDisplayDateTime(workout.performed_at)}</strong>
                        <Pill tone="info">{workout.total_volume.toLocaleString()} kg</Pill>
                      </div>
                      <div style={itemMetaStyle(theme)}>{workout.set_count.toLocaleString()} 组</div>
                      <div style={itemMetaStyle(theme)}>
                        {workout.notes?.trim() || "这次训练没有备注。"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section style={sectionCardStyle(theme)}>
            <div style={sectionHeaderStyle}>
              <h3 style={subheadingStyle}>证据链</h3>
              <Pill tone="info">evidence</Pill>
            </div>
            <div style={evidenceGridStyle}>
              <div style={evidenceCellStyle(theme)}>
                <span style={evidenceLabelStyle(theme)}>来源</span>
                <strong style={evidenceValueStyle(theme)}>{context.evidence.source}</strong>
              </div>
              <div style={evidenceCellStyle(theme)}>
                <span style={evidenceLabelStyle(theme)}>关联 workout</span>
                <strong style={evidenceValueStyle(theme)}>
                  {context.evidence.workout_ids.length} 条
                </strong>
              </div>
              <div style={evidenceCellStyle(theme)}>
                <span style={evidenceLabelStyle(theme)}>关联 set</span>
                <strong style={evidenceValueStyle(theme)}>
                  {context.evidence.set_ids.length} 条
                </strong>
              </div>
              <div style={evidenceCellStyle(theme)}>
                <span style={evidenceLabelStyle(theme)}>规则数量</span>
                <strong style={evidenceValueStyle(theme)}>
                  {context.evidence.calculation_rules.length} 条
                </strong>
              </div>
            </div>

            <details style={detailsStyle}>
              <summary style={summaryStyle(theme)}>查看 calculation_rules</summary>
              <ul style={rulesListStyle(theme)}>
                {context.evidence.calculation_rules.map((rule) => (
                  <li key={rule} style={{ marginBottom: "0.4rem" }}>
                    {rule}
                  </li>
                ))}
              </ul>
            </details>
          </section>
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

  return "推荐上下文暂时不可用。";
}

function createDefaultRange(): RecommendationContextRange {
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
  fontSize: 16,
  margin: 0,
};

const subheadingStyle: React.CSSProperties = {
  fontSize: 15,
  margin: 0,
};

const contentGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "1fr",
  marginTop: 16,
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const itemHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const sectionHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 12,
};

const evidenceGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const detailsStyle: React.CSSProperties = {
  marginTop: 12,
};

function copyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 12, lineHeight: 1.6, margin: 0 };
}

function subtleStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return { color: theme.colors.tx3, fontSize: 11, lineHeight: 1.6, margin: "0.35rem 0 0" };
}

function sectionCardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    borderRadius: 14,
    marginTop: 16,
    padding: 14,
  };
}

function listItemStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    padding: 12,
  };
}

function itemMetaStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 12, lineHeight: 1.6 };
}

function summaryStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return { color: theme.colors.ac, fontSize: 12, fontWeight: 700 };
}

function rulesListStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "0.75rem 0 0",
    paddingLeft: "1rem",
  };
}

function evidenceCellStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    display: "grid",
    gap: 4,
    padding: 10,
  };
}

function evidenceLabelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
  };
}

function evidenceValueStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 12,
    lineHeight: 1.5,
  };
}
