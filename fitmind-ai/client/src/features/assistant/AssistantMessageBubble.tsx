import { Badge } from "../../components/Badge";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeContext";
import type { AssistantChatMessage } from "./assistant-types";

export interface AssistantMessageBubbleProps {
  message: AssistantChatMessage;
}

export function AssistantMessageBubble(props: AssistantMessageBubbleProps) {
  const { message } = props;
  const { theme } = useTheme();
  const isAssistant = message.role === "assistant";

  return (
    <article style={bubbleLayoutStyle}>
      <div style={avatarStyle(theme, isAssistant)}>
        <Icon name={isAssistant ? "bot" : "user"} size={12} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={metaRowStyle}>
          <span style={nameStyle(theme)}>{isAssistant ? "FitMind AI" : "你"}</span>
          {message.isStreaming ? <Badge tone="info">生成中</Badge> : null}
        </div>
        <div style={bubbleStyle(theme, isAssistant)}>
          <p style={messageTextStyle}>{message.text || "..."}</p>
        </div>
      </div>
    </article>
  );
}

const bubbleLayoutStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 10,
};

function avatarStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isAssistant: boolean,
): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: isAssistant
      ? theme.isDark
        ? "rgba(200, 240, 53, 0.18)"
        : "rgba(74, 140, 0, 0.12)"
      : theme.colors.surf2,
    border: `1px solid ${isAssistant ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: 8,
    color: isAssistant ? theme.colors.ac : theme.colors.tx3,
    display: "inline-flex",
    flexShrink: 0,
    height: 24,
    justifyContent: "center",
    marginTop: 2,
    width: 24,
  };
}

const metaRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  marginBottom: 6,
};

function nameStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    fontWeight: 700,
  };
}

function bubbleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isAssistant: boolean,
): React.CSSProperties {
  return {
    backgroundColor: isAssistant ? theme.colors.surf : theme.colors.surf2,
    border: `1px solid ${isAssistant ? theme.colors.bdr : "transparent"}`,
    borderRadius: theme.radius.card,
    color: theme.colors.tx,
    padding: "12px 14px",
  };
}

const messageTextStyle: React.CSSProperties = {
  lineHeight: 1.7,
  margin: 0,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};
