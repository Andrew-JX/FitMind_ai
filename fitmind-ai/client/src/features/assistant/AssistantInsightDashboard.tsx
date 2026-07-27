import { useEffect, useState } from "react";

import { Card } from "../../components/Card";
import { StateNotice } from "../../components/StateNotice";
import { StatTrio, type StatTrioEntry } from "../../components/StatTrio";
import { HttpClientError } from "../../services/http-client";
import { useTheme } from "../../theme/ThemeContext";
import { getToneColors, type SemanticTone } from "../../theme/tokens";
import { createDefaultAssistantRange } from "./assistant-date-range";
import {
  getAssistantInsights,
  type AssistantInsightCard,
  type AssistantInsightType,
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

const TYPE_LABEL: Record<AssistantInsightType, string> = {
  next_training_focus: "今日建议",
  training_imbalance: "偏科提醒",
  recovery_check: "恢复提醒",
  exercise_progress: "动作进展",
  evidence_explain: "判断依据",
};

/**
 * Assistant tab's 主动训练洞察 card: the deterministic 30-day overview plus the
 * backend's insight cards, each tappable to prefill the composer.
 *
 * @param props - Auth token, refresh signal, and the prompt handler
 * @returns Insight dashboard card
 */
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
  const stats: StatTrioEntry[] = [
    {
      label: "训练次数",
      unit: "次",
      value: (snapshot?.overview.workout_count ?? 0).toLocaleString(),
    },
    {
      label: "训练组数",
      unit: "组",
      value: (snapshot?.overview.set_count ?? 0).toLocaleString(),
    },
    {
      label: "总训练量",
      unit: "公斤",
      value: Math.round(snapshot?.overview.total_volume ?? 0).toLocaleString(),
    },
  ];

  return (
    <Card>
      <div style={bodyStyle}>
        <div style={headingStyle}>
          <h3 style={titleStyle}>主动训练洞察</h3>
          <span style={subtitleStyle(theme)}>
            打开这里就能先看到训练建议、偏科提醒和重点动作进展，再决定要不要继续追问。
          </span>
        </div>

        {errorMessage ? (
          <StateNotice
            description="通常是后端暂时不可用或本地环境未启动；恢复后重新进入页面即可。"
            icon="bot"
            title="洞察加载失败"
            tone="error"
          />
        ) : null}

        {isLoading && !snapshot ? (
          <p style={mutedStyle(theme)}>正在整理最近 30 天的训练记录...</p>
        ) : null}

        {snapshot ? <StatTrio size="sm" stats={stats} /> : null}

        {hasEmptyState ? (
          <StateNotice
            description="只要补 1-2 次训练，这里就会开始展示建议、偏科提醒、恢复节奏和动作进展。"
            icon="bot"
            title="洞察已准备好，等你喂第一批训练数据"
          />
        ) : null}

        {snapshot?.cards.map((card) => (
          <InsightCard
            card={card}
            key={card.type}
            onSelectPrompt={props.onPromptSelect}
          />
        ))}

        {snapshot && snapshot.limitations.length > 0 ? (
          <div style={limitationStyle(theme)}>
            <strong style={limitationTitleStyle(theme)}>说明与边界</strong>
            <span style={limitationBodyStyle(theme)}>
              {snapshot.limitations.map((item) => (
                <span key={item} style={limitationLineStyle}>
                  · {item}
                </span>
              ))}
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

interface InsightCardProps {
  card: AssistantInsightCard;
  onSelectPrompt: (prompt: AssistantPromptSuggestion) => void;
}

/**
 * One insight card.
 *
 * The design shows a ☆ 保存 action here, which has no backend: saved insights
 * are keyed by an assistant *message* id and these cards are not messages. It
 * is left out rather than faked; the whole card stays tappable to prefill the
 * composer, which is the action the backend does support.
 *
 * @param props - Card payload and the prompt handler
 * @returns Insight card element
 */
function InsightCard(props: InsightCardProps) {
  const { theme } = useTheme();
  const { card } = props;
  const tagColor = getToneColors(theme, card.tone as SemanticTone).text;

  const content = (
    <>
      <div style={cardHeaderStyle}>
        <strong style={{ ...cardTagStyle, color: tagColor }}>
          {TYPE_LABEL[card.type]}
        </strong>
      </div>
      <p style={cardBodyStyle(theme)}>{card.summary}</p>
      {card.hint ? <span style={cardHintStyle(theme)}>{card.hint}</span> : null}
      {card.evidence_summary ? (
        <span style={cardFootStyle(theme)}>{card.evidence_summary}</span>
      ) : null}
    </>
  );

  if (!card.suggested_prompt) {
    return <div style={cardStyle(theme, false)}>{content}</div>;
  }

  const prompt = card.suggested_prompt;

  return (
    <button
      onClick={() => props.onSelectPrompt(prompt)}
      style={cardStyle(theme, true)}
      type="button"
    >
      {content}
    </button>
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

const bodyStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const headingStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "-0.2px",
  margin: 0,
};

function subtitleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    lineHeight: 1.6,
  };
}

function mutedStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 12, lineHeight: 1.6, margin: 0 };
}

function cardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isButton: boolean,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.soft,
    border: "none",
    borderRadius: 14,
    color: theme.colors.tx,
    cursor: isButton ? "pointer" : "default",
    display: "grid",
    gap: 6,
    padding: "13px 14px",
    textAlign: "left",
    width: "100%",
  };
}

const cardHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
};

const cardTagStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
};

function cardBodyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx, fontSize: 13, lineHeight: 1.7, margin: 0 };
}

function cardHintStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.orange, fontSize: 11, lineHeight: 1.6 };
}

function cardFootStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx3, fontSize: 11, lineHeight: 1.6 };
}

function limitationStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.soft,
    borderRadius: 14,
    display: "grid",
    gap: 4,
    padding: "13px 14px",
  };
}

function limitationTitleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 11, fontWeight: 700 };
}

function limitationBodyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    display: "grid",
    fontSize: 11,
    lineHeight: 1.7,
  };
}

const limitationLineStyle: React.CSSProperties = {
  display: "block",
};
