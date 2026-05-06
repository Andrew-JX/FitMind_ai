import type { AssistantActiveToolCall } from "./assistant-types";

export interface AssistantToolCallCardProps {
  toolCall: AssistantActiveToolCall | null;
}

/**
 * Displays the current assistant tool execution state for demo purposes.
 *
 * @param props - Active tool call information from the chat hook.
 * @returns Minimal tool call status card.
 */
export function AssistantToolCallCard(props: AssistantToolCallCardProps) {
  if (!props.toolCall) {
    return (
      <div style={idleCardStyle}>
        Waiting for a deterministic tool call. Tool-backed requests will surface the
        selected backend tool here.
      </div>
    );
  }

  return (
    <div style={activeCardStyle}>
      <div style={toolLabelStyle}>Active deterministic tool</div>
      <div style={toolNameStyle}>{props.toolCall.toolName}</div>
      <div style={toolMetaStyle}>
        Status: {formatToolStatus(props.toolCall.status)}
        {props.toolCall.durationMs !== undefined
          ? ` | Duration: ${props.toolCall.durationMs} ms`
          : ""}
      </div>
    </div>
  );
}

const idleCardStyle: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  border: "1px dashed #94a3b8",
  borderRadius: 12,
  color: "#475569",
  padding: 12,
};

const activeCardStyle: React.CSSProperties = {
  backgroundColor: "#eff6ff",
  border: "1px solid #93c5fd",
  borderRadius: 12,
  padding: 12,
};

const toolNameStyle: React.CSSProperties = {
  color: "#1d4ed8",
  fontFamily: "monospace",
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 4,
};

const toolLabelStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  marginBottom: 6,
  textTransform: "uppercase",
};

const toolMetaStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: 14,
};

function formatToolStatus(status: AssistantActiveToolCall["status"]): string {
  return status.replace("_", " ");
}
