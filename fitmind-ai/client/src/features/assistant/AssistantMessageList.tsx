import type { AssistantChatMessage } from "./assistant-types";

export interface AssistantMessageListProps {
  messages: AssistantChatMessage[];
}

/**
 * Renders the current in-memory assistant conversation as plain text only.
 *
 * @param props - Chat messages in display order.
 * @returns Minimal message list for the demo panel.
 */
export function AssistantMessageList(props: AssistantMessageListProps) {
  if (props.messages.length === 0) {
    return (
      <div style={emptyStateStyle}>
        Send a question to watch the assistant move through thinking, tool calling,
        and streamed answering.
      </div>
    );
  }

  return (
    <div style={listStyle}>
      {props.messages.map((message) => (
        <article
          key={message.id}
          style={message.role === "user" ? userMessageStyle : assistantMessageStyle}
        >
          <div style={messageLabelStyle}>
            {message.role === "user" ? "You" : "Assistant"}
            {message.isStreaming ? " (streaming)" : ""}
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

const emptyStateStyle: React.CSSProperties = {
  border: "1px dashed #94a3b8",
  borderRadius: 12,
  color: "#475569",
  padding: 16,
};

const baseMessageStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: 12,
};

const userMessageStyle: React.CSSProperties = {
  ...baseMessageStyle,
  backgroundColor: "#e2e8f0",
};

const assistantMessageStyle: React.CSSProperties = {
  ...baseMessageStyle,
  backgroundColor: "#f8fafc",
  border: "1px solid #cbd5e1",
};

const messageLabelStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 6,
  textTransform: "uppercase",
};

const messageTextStyle: React.CSSProperties = {
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
};
