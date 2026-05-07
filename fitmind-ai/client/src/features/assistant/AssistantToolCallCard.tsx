import { Badge } from "../../components/Badge";
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
      <Card padding="12px">
        <div style={{ color: theme.colors.tx2, fontSize: 12, lineHeight: 1.6 }}>
          当前还没有活动的确定性工具调用。发起一轮对话后，这里会显示工具名、状态和耗时。
        </div>
      </Card>
    );
  }

  return (
    <Card padding="12px">
      <div style={{ color: theme.colors.tx3, fontSize: 11, marginBottom: 6 }}>
        当前确定性工具
      </div>
      <div style={toolHeaderStyle}>
        <div style={toolNameStyle(theme)}>{props.toolCall.toolName}</div>
        <Badge
          tone={
            props.toolCall.status === "success"
              ? "success"
              : props.toolCall.status === "error"
                ? "danger"
                : "info"
          }
        >
          {formatToolStatus(props.toolCall.status)}
        </Badge>
      </div>
      <div style={{ color: theme.colors.tx2, fontSize: 12 }}>
        状态：{formatToolStatus(props.toolCall.status)}
        {props.toolCall.durationMs !== undefined
          ? ` | 耗时：${props.toolCall.durationMs} ms`
          : ""}
      </div>
    </Card>
  );
}

function formatToolStatus(status: AssistantActiveToolCall["status"]): string {
  if (status === "running") {
    return "运行中";
  }

  if (status === "success") {
    return "成功";
  }

  return "失败";
}

function toolNameStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.blue,
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    fontWeight: 700,
  };
}

const toolHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
  marginBottom: 4,
};
