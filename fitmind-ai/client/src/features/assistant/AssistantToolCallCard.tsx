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
        <div style={metaStyle(theme)}>正在读取训练数据</div>
        <div style={headlineStyle(theme)}>准备根据训练记录回答</div>
        <p style={copyStyle(theme)}>
          当你提问时，我会先查看相关训练记录，再给出更具体的回答。
        </p>
      </Card>
    );
  }

  const isRunning = props.toolCall.status === "running";

  return (
    <Card padding="14px">
      <div style={metaStyle(theme)}>{isRunning ? "正在读取训练数据" : "训练数据已读取"}</div>
      <div style={toolNameStyle(theme)}>{getReadableToolName(props.toolCall.toolName)}</div>
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
    return "读取中";
  }

  if (status === "success") {
    return "已完成";
  }

  return "读取失败";
}

function getReadableToolName(toolName: string): string {
  return toolName
    .replaceAll("get_training_summary", "训练总览")
    .replaceAll("get_recommendation_context", "训练建议依据")
    .replaceAll("get_exercise_progress", "动作进展")
    .replaceAll("get_muscle_load", "肌群负荷");
}

function getToolCopy(toolCall: AssistantActiveToolCall): string {
  if (toolCall.status === "running") {
    return "正在查看你的训练记录，完成后会继续回答。";
  }

  if (toolCall.status === "success") {
    return "已读取到相关训练数据，本次回答会基于这些记录生成。";
  }

  return "训练数据读取失败，可以稍后重试或换个问题。";
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
