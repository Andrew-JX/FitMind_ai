import { useEffect, useState } from "react";

import { Card } from "../../components/Card";
import { IconButton } from "../../components/IconButton";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import {
  deleteAssistantSavedInsight,
  listAssistantSavedInsights,
  type AssistantSavedInsight,
} from "./assistant-saved-insights-api";
import { getAssistantInsightTypeLabel } from "./assistant-saved-insights";

export interface AssistantSavedInsightsPanelProps {
  refreshKey: number;
  token: string | null;
}

export function AssistantSavedInsightsPanel(
  props: AssistantSavedInsightsPanelProps,
) {
  const { theme } = useTheme();
  const [items, setItems] = useState<AssistantSavedInsight[]>([]);
  const [statusText, setStatusText] = useState<string | null>(null);
  const displayItems = props.token ? items : [];

  useEffect(() => {
    if (!props.token) {
      return;
    }

    let isMounted = true;
    listAssistantSavedInsights(props.token)
      .then((nextItems) => {
        if (isMounted) {
          setItems(nextItems);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStatusText("保存洞察加载失败。");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [props.refreshKey, props.token]);

  async function copyInsight(item: AssistantSavedInsight): Promise<void> {
    await navigator.clipboard.writeText(item.share_text);
    setStatusText("洞察文本已复制。");
  }

  async function deleteInsight(item: AssistantSavedInsight): Promise<void> {
    if (!props.token) {
      return;
    }

    await deleteAssistantSavedInsight(props.token, item.id);
    setItems((currentItems) =>
      currentItems.filter((currentItem) => currentItem.id !== item.id),
    );
    setStatusText("已删除保存洞察。");
  }

  return (
    <Card padding="14px">
      <section style={panelStyle}>
        <div style={headingRowStyle}>
          <div>
            <h3 style={{ margin: 0 }}>已保存洞察</h3>
            <p style={copyStyle(theme)}>
              回看周报、平台期诊断和下周训练草案。
            </p>
          </div>
        </div>

        {displayItems.length === 0 ? (
          <StateNotice
            description="Save a coach reply to keep it available for review and copy-text sharing."
            icon="bot"
            title="还没有保存洞察"
          />
        ) : (
          <div style={listStyle}>
            {displayItems.map((item) => (
              <article key={item.id} style={itemStyle(theme)}>
                <div style={{ minWidth: 0 }}>
                  <div style={typeStyle(theme)}>
                    {getAssistantInsightTypeLabel(item.insight_type)}
                  </div>
                  <h4 style={titleStyle}>{item.title}</h4>
                  <p style={summaryStyle(theme)}>{item.summary}</p>
                  <time style={dateStyle(theme)} dateTime={item.created_at}>
                    {formatDateTime(item.created_at)}
                  </time>
                </div>
                <div style={actionsStyle}>
                  <IconButton
                    icon="copy"
                    label="复制已保存洞察"
                    onClick={() => void copyInsight(item)}
                  />
                  <IconButton
                    icon="trash"
                    label="删除已保存洞察"
                    onClick={() => void deleteInsight(item)}
                    tone="danger"
                  />
                </div>
              </article>
            ))}
          </div>
        )}

        {statusText ? <p style={statusStyle(theme)}>{statusText}</p> : null}
      </section>
    </Card>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

const panelStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const headingRowStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

function itemStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "flex-start",
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    display: "flex",
    gap: 10,
    justifyContent: "space-between",
    padding: 12,
  };
}

const actionsStyle: React.CSSProperties = {
  display: "flex",
  flexShrink: 0,
  gap: 8,
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  margin: "4px 0",
};

function typeStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.ac,
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
  };
}

function summaryStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 13,
    lineHeight: 1.5,
    margin: 0,
  };
}

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 13,
    lineHeight: 1.5,
    margin: "6px 0 0",
  };
}

function dateStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    display: "block",
    fontSize: 11,
    marginTop: 8,
  };
}

function statusStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 12,
    margin: 0,
  };
}
