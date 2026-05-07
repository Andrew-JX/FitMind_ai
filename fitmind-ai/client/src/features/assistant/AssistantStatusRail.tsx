import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { StatusPill } from "../../components/StatusPill";
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
          <StatusPill status={props.status} />
        </div>
        <div style={metaColumnStyle}>
          <Badge tone="analysis">
            provider {props.provider ? formatProvider(props.provider) : "waiting"}
          </Badge>
          <span style={sessionStyle(theme)}>
            sessionId {props.sessionId ?? "waiting-for-session"}
          </span>
        </div>
      </div>
      <p style={copyStyle(theme)}>{getStatusCopy(props.status)}</p>
    </Card>
  );
}

function formatProvider(provider: AssistantProvider): string {
  return provider === "anthropic" ? "anthropic" : "mock";
}

function getStatusCopy(status: AssistantChatStatus): string {
  if (status === "idle") {
    return "准备就绪，可以开始新的训练问题。";
  }

  if (status === "thinking") {
    return "正在理解问题，并准备选择合适的训练工具。";
  }

  if (status === "tool_calling") {
    return "正在通过 Tool Calling 读取确定性 evidence。";
  }

  if (status === "answering") {
    return "正在通过 SSE 增量拼接回答内容。";
  }

  if (status === "done") {
    return "回答完成，本轮 sessionId 会继续复用到下一次提问。";
  }

  return "助手响应失败，可以重试本次问题，或检查 assistant provider 配置。";
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

function labelStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    margin: "0 0 8px",
  };
}

function sessionStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    maxWidth: 180,
    overflowWrap: "anywhere",
    textAlign: "right",
  };
}

function copyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "12px 0 0",
  };
}
