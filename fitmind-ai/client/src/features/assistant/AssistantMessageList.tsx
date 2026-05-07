import { Card } from "../../components/Card";
import { useTheme } from "../../theme/ThemeContext";
import type { AssistantChatMessage } from "./assistant-types";

export interface AssistantMessageListProps {
  messages: AssistantChatMessage[];
}

export function AssistantMessageList(props: AssistantMessageListProps) {
  const { theme } = useTheme();

  if (props.messages.length === 0) {
    return (
      <Card padding="12px">
        <div style={{ color: theme.colors.tx2, fontSize: 12, lineHeight: 1.6 }}>
          发送一条问题后，这里会依次展示用户消息、工具调用和流式回答内容。
        </div>
      </Card>
    );
  }

  return (
    <div style={listStyle}>
      {props.messages.map((message) => (
        <article key={message.id} style={messageBubbleStyle(theme, message.role)}>
          <div style={messageLabelStyle(theme)}>
            {message.role === "user" ? "你" : "FitMind AI"}
            {message.isStreaming ? " · 流式中" : ""}
          </div>
          <div style={messageTextStyle}>{message.text || "..."}</div>
        </article>
      ))}
    </div>
  );
}

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

function messageLabelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
  };
}

const messageTextStyle: React.CSSProperties = {
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
};

function messageBubbleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  role: AssistantChatMessage["role"],
): React.CSSProperties {
  return {
    backgroundColor: role === "user" ? theme.colors.surf2 : theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    color: theme.colors.tx,
    padding: 12,
  };
}
