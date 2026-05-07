import { Card } from "../../components/Card";
import { useTheme } from "../../theme/ThemeContext";
import type { AssistantActiveToolCall } from "./assistant-types";

export interface AssistantToolCallCardProps {
  toolCall: AssistantActiveToolCall | null;
}

export function AssistantToolCallCard(props: AssistantToolCallCardProps) {
  const { theme } = useTheme();

  if (!props.toolCall) {
    return (
      <Card padding="14px">
        <div style={metaStyle(theme)}>工具调用状态</div>
        <div style={headlineStyle(theme)}>等待本轮 Tool Calling</div>
        <p style={copyStyle(theme)}>
          当助手需要读取训练数据时，这里会展示当前工具名、状态和完成耗时。
        </p>
      </Card>
    );
  }

  const isRunning = props.toolCall.status === "running";

  return (
    <Card padding="14px">
      <div style={metaStyle(theme)}>{isRunning ? "正在调用工具" : "工具调用完成"}</div>
      <div style={toolNameStyle(theme)}>{props.toolCall.toolName}</div>
      <div style={summaryRowStyle}>
        <span style={statusLabelStyle(theme)}>
          状态：{formatToolStatus(props.toolCall.status)}
        </span>
        {props.toolCall.durationMs !== undefined ? (
          <span style={durationStyle(theme)}>{props.toolCall.durationMs}ms</span>
        ) : null}
      </div>
      <p style={copyStyle(theme)}>{getToolCopy(props.toolCall)}</p>
    </Card>
  );
}

function formatToolStatus(status: AssistantActiveToolCall["status"]): string {
  if (status === "running") {
    return "tool_calling";
  }

  if (status === "success") {
    return "success";
  }

  return "error";
}

function getToolCopy(toolCall: AssistantActiveToolCall): string {
  if (toolCall.status === "running") {
    return "助手正在读取确定性训练结果，完成后会继续生成中文解释。";
  }

  if (toolCall.status === "success") {
    return "本次工具读取已完成，回答会基于这次 evidence 继续拼接。";
  }

  return "本次工具调用返回错误，保留原有 SSE 错误处理链路。";
}

function metaStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    marginBottom: 8,
  };
}

function headlineStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 14,
    fontWeight: 700,
  };
}

function toolNameStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.blue,
    fontFamily: theme.fonts.mono,
    fontSize: 15,
    fontWeight: 700,
  };
}

const summaryRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 10,
  marginTop: 8,
};

function statusLabelStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
  };
}

function durationStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontFamily: theme.fonts.mono,
    fontSize: 11,
  };
}

function copyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "10px 0 0",
  };
}
