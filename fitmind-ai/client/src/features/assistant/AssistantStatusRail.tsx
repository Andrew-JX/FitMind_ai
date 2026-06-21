import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { StatusPill, type StatusTone } from "../../components/StatusPill";
import { useTheme } from "../../theme/ThemeContext";
import type { AssistantChatStatus, AssistantProvider } from "./assistant-types";

export interface AssistantStatusRailProps {
  provider: AssistantProvider | null;
  sessionId: string | null;
  status: AssistantChatStatus;
}

export function AssistantStatusRail(props: AssistantStatusRailProps) {
  const { theme } = useTheme();

  return (
    <Card padding="14px">
      <div style={topRowStyle}>
        <div>
          <p style={labelStyle(theme)}>当前状态</p>
          <StatusPill status={toPillTone(props.status)} />
        </div>
        <div style={metaColumnStyle}>
          <Badge tone="analysis">{formatProvider(props.provider)}</Badge>
          {props.sessionId ? (
            <span style={sessionStyle(theme)}>连续对话已开启</span>
          ) : null}
        </div>
      </div>
      <p style={copyStyle(theme)}>{getStatusCopy(props.status)}</p>
    </Card>
  );
}

function formatProvider(provider: AssistantProvider | null): string {
  if (provider === "anthropic" || provider === "groq") {
    return "智能回答";
  }

  if (provider === "mock") {
    return "演示回答";
  }

  return "准备中";
}

function toPillTone(status: AssistantChatStatus): StatusTone {
  // The status rail has no dedicated planning tone; reuse the thinking pill.
  return status === "planning" ? "thinking" : status;
}

function getStatusCopy(status: AssistantChatStatus): string {
  if (status === "idle") {
    return "准备好了，可以开始新的训练问题。";
  }

  if (status === "thinking") {
    return "正在理解问题，并准备查看相关训练记录。";
  }

  if (status === "planning") {
    return "正在多步规划：依次查看训练量、弱项和进展。";
  }

  if (status === "tool_calling") {
    return "正在读取你的训练数据。";
  }

  if (status === "retrieving") {
    return "正在检索训练知识。";
  }

  if (status === "answering") {
    return "正在组织回答内容。";
  }

  if (status === "done") {
    return "回答完成，可以继续追问。";
  }

  return "助手响应失败，可以重试本次问题。";
}

const topRowStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const metaColumnStyle: React.CSSProperties = {
  alignItems: "flex-end",
  display: "grid",
  gap: 8,
  justifyItems: "end",
};

function labelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    margin: "0 0 8px",
  };
}

function sessionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 10,
    maxWidth: 180,
    overflowWrap: "anywhere",
    textAlign: "right",
  };
}

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "12px 0 0",
  };
}
