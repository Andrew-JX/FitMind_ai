import { useEffect, useState } from "react";

import { Card } from "../../components/Card";
import { useTheme } from "../../theme/ThemeContext";
import {
  deleteAssistantSavedInsight,
  listAssistantSavedInsights,
  type AssistantSavedInsight,
} from "./assistant-saved-insights-api";

export interface AssistantSavedInsightsPanelProps {
  refreshKey: number;
  token: string | null;
}

/**
 * Assistant tab's 已保存洞察 card: saved coach replies with their date, plus
 * copy-to-clipboard and delete.
 *
 * @param props - Auth token and the refresh key bumped on every new save
 * @returns Saved insights card
 */
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
    <Card>
      <div style={bodyStyle}>
        <div style={headingStyle}>
          <h3 style={titleStyle}>已保存洞察</h3>
          <span style={subtitleStyle(theme)}>
            回看周报、平台期诊断和下周训练草案。
          </span>
        </div>

        {displayItems.length === 0 ? (
          <div style={emptyStyle(theme)}>
            <strong style={emptyTitleStyle(theme)}>还没有保存洞察</strong>
            <span style={emptyCopyStyle(theme)}>
              保存教练回复后，可以随时回看或复制分享。
            </span>
          </div>
        ) : (
          displayItems.map((item) => (
            <article key={item.id} style={itemStyle(theme)}>
              <strong style={itemTitleStyle(theme)}>{item.title}</strong>
              <p style={itemSummaryStyle(theme)}>{item.summary}</p>
              <div style={itemFooterStyle}>
                <time dateTime={item.created_at} style={dateStyle(theme)}>
                  {formatDateTime(item.created_at)}
                </time>
                <div style={itemActionsStyle}>
                  <button
                    onClick={() => void copyInsight(item)}
                    style={textButtonStyle(theme)}
                    type="button"
                  >
                    复制
                  </button>
                  <button
                    onClick={() => void deleteInsight(item)}
                    style={textButtonStyle(theme)}
                    type="button"
                  >
                    删除
                  </button>
                </div>
              </div>
            </article>
          ))
        )}

        {statusText ? <p style={statusStyle(theme)}>{statusText}</p> : null}
      </div>
    </Card>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
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
  return { color: theme.colors.tx3, fontSize: 11, lineHeight: 1.6 };
}

function itemStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.soft,
    borderRadius: 14,
    display: "grid",
    gap: 8,
    padding: "13px 14px",
  };
}

function itemTitleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx, fontSize: 12, fontWeight: 700 };
}

function itemSummaryStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx, fontSize: 12, lineHeight: 1.7, margin: 0 };
}

const itemFooterStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
};

const itemActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
};

function textButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    color: theme.colors.tx3,
    cursor: "pointer",
    fontSize: 11,
    padding: 0,
  };
}

function dateStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx3, fontSize: 11 };
}

function emptyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.soft,
    borderRadius: 14,
    display: "grid",
    gap: 4,
    justifyItems: "center",
    padding: 18,
    textAlign: "center",
  };
}

function emptyTitleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx, fontSize: 13 };
}

function emptyCopyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 11, lineHeight: 1.6 };
}

function statusStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx3, fontSize: 12, margin: 0 };
}
