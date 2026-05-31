import { useEffect, useState } from "react";

import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { Pill } from "../../components/Pill";
import { StateNotice } from "../../components/StateNotice";
import { HttpClientError } from "../../services/http-client";
import { useTheme } from "../../theme/ThemeContext";
import { createDefaultAssistantRange } from "./assistant-date-range";
import {
  getAssistantInsights,
  type AssistantInsightsResponse,
} from "./assistant-insights-api";
import type { AssistantPromptSuggestion } from "./assistant-types";

export interface AssistantInsightDashboardProps {
  onPromptSelect: (prompt: AssistantPromptSuggestion) => void;
  refreshSignal: number;
  selectedExerciseId?: string | null | undefined;
  selectedExerciseName?: string | null | undefined;
  token: string | null;
}

export function AssistantInsightDashboard(
  props: AssistantInsightDashboardProps,
) {
  const { theme } = useTheme();
  const [snapshot, setSnapshot] = useState<AssistantInsightsResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [range] = useState(() => createDefaultAssistantRange());

  useEffect(() => {
    let isActive = true;

    async function loadInsights(): Promise<void> {
      if (!props.token) {
        setSnapshot(null);
        setIsLoading(false);
        setErrorMessage(null);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextSnapshot = await getAssistantInsights(props.token, {
          endDate: range.end_date,
          exerciseId: props.selectedExerciseId ?? null,
          startDate: range.start_date,
        });

        if (!isActive) {
          return;
        }

        setSnapshot(nextSnapshot);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setSnapshot(null);
        setErrorMessage(getReadableErrorMessage(error));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadInsights();

    return () => {
      isActive = false;
    };
  }, [
    props.refreshSignal,
    props.selectedExerciseId,
    props.selectedExerciseName,
    props.token,
    range.end_date,
    range.start_date,
  ]);

  const hasEmptyState =
    snapshot !== null && snapshot.overview.workout_count === 0;

  return (
    <Card>
      <div style={headerStyle}>
        <div>
          <div style={titleRowStyle}>
            <h3 style={titleStyle}>主动训练洞察</h3>
            <Badge tone="accent">Insight Dashboard</Badge>
          </div>
          <p style={copyStyle(theme)}>
            打开这里就能先看到训练建议、偏科提醒、恢复提醒和重点动作进展，再决定要不要继续追问。
          </p>
        </div>
      </div>

      {errorMessage ? (
        <StateNotice
          description="这次没有成功拉取训练洞察。通常是后端暂时不可用或本地环境未启动；恢复后重新进入页面或再试一次即可。"
          icon="bot"
          title="洞察加载失败"
          tone="error"
        />
      ) : null}

      {isLoading && !snapshot ? (
        <p style={copyStyle(theme)}>
          正在整理最近 30 天的训练记录并生成本页洞察...
        </p>
      ) : null}

      {hasEmptyState ? (
        <StateNotice
          description="当前账号还没有足够训练记录，但页面结构已经就绪。只要补 1-2 次训练，这里就会开始展示建议、偏科提醒、恢复节奏和动作进展。"
          icon="bot"
          title="洞察已准备好，等你喂第一批训练数据"
        />
      ) : null}

      {snapshot ? (
        <>
          <div style={overviewGridStyle}>
            <div style={overviewCellStyle(theme)}>
              <span style={overviewLabelStyle(theme)}>训练次数</span>
              <strong style={overviewValueStyle(theme)}>
                {snapshot.overview.workout_count.toLocaleString()} 次
              </strong>
            </div>
            <div style={overviewCellStyle(theme)}>
              <span style={overviewLabelStyle(theme)}>训练组数</span>
              <strong style={overviewValueStyle(theme)}>
                {snapshot.overview.set_count.toLocaleString()} 组
              </strong>
            </div>
            <div style={overviewCellStyle(theme)}>
              <span style={overviewLabelStyle(theme)}>总训练量</span>
              <strong style={overviewValueStyle(theme)}>
                {snapshot.overview.total_volume.toLocaleString()} kg
              </strong>
            </div>
          </div>

          <div style={cardListStyle}>
            {snapshot.cards.map((card) => {
              const content = (
                <>
                  <div style={cardHeaderStyle}>
                    <h4 style={cardTitleStyle}>{card.title}</h4>
                    <Pill tone={card.tone}>{getToneLabel(card.type)}</Pill>
                  </div>
                  <p style={cardSummaryStyle(theme)}>{card.summary}</p>
                  {card.hint ? (
                    <p style={cardHintStyle(theme)}>{card.hint}</p>
                  ) : null}
                  {card.evidence_summary ? (
                    <p style={cardEvidenceStyle(theme)}>
                      {card.evidence_summary}
                    </p>
                  ) : null}
                </>
              );

              if (!card.suggested_prompt) {
                return (
                  <article key={card.type} style={cardStyle(theme, false)}>
                    {content}
                  </article>
                );
              }

              return (
                <button
                  key={card.type}
                  onClick={() => props.onPromptSelect(card.suggested_prompt!)}
                  style={cardStyle(theme, true)}
                  type="button"
                >
                  {content}
                </button>
              );
            })}
          </div>

          <div style={limitationBoxStyle(theme)}>
            <h4 style={limitationTitleStyle}>说明与边界</h4>
            <ul style={limitationListStyle(theme)}>
              {snapshot.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
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

  return "助手洞察暂时不可用。";
}

function getToneLabel(
  type: AssistantInsightsResponse["cards"][number]["type"],
): string {
  switch (type) {
    case "next_training_focus":
      return "今日建议";
    case "training_imbalance":
      return "偏科提醒";
    case "recovery_check":
      return "恢复提醒";
    case "exercise_progress":
      return "动作进展";
    case "evidence_explain":
      return "判断依据";
  }
}

const headerStyle: React.CSSProperties = {
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

const overviewGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};

const cardListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 16,
};

const cardHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 15,
  margin: 0,
};

const limitationTitleStyle: React.CSSProperties = {
  fontSize: 14,
  margin: 0,
};

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 13,
    lineHeight: 1.6,
    margin: 0,
  };
}

function overviewCellStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    display: "grid",
    gap: 6,
    padding: 12,
  };
}

function overviewLabelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
  };
}

function overviewValueStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 14,
    lineHeight: 1.4,
  };
}

function cardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isButton: boolean,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    cursor: isButton ? "pointer" : "default",
    display: "grid",
    gap: 8,
    padding: 14,
    textAlign: "left",
  };
}

function cardSummaryStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 13,
    lineHeight: 1.7,
    margin: 0,
  };
}

function cardHintStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.orange,
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
  };
}

function cardEvidenceStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    lineHeight: 1.6,
    margin: 0,
  };
}

function limitationBoxStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    display: "grid",
    gap: 10,
    marginTop: 16,
    padding: 14,
  };
}

function limitationListStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
    paddingLeft: 18,
  };
}
