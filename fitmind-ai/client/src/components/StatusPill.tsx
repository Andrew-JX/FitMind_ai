import { useTheme } from "../theme/ThemeContext";
import { getToneColors } from "../theme/tokens";

export type StatusTone =
  | "idle"
  | "thinking"
  | "tool_calling"
  | "answering"
  | "done"
  | "error";

export interface StatusPillProps {
  status: StatusTone;
}

export function StatusPill(props: StatusPillProps) {
  const { theme } = useTheme();
  const tone =
    props.status === "done"
      ? getToneColors(theme, "success")
      : props.status === "error"
        ? getToneColors(theme, "danger")
        : props.status === "thinking"
          ? getToneColors(theme, "accent")
          : props.status === "tool_calling"
            ? getToneColors(theme, "info")
            : props.status === "answering"
              ? getToneColors(theme, "analysis")
              : getToneColors(theme, "neutral");

  return (
    <span
      style={{
        alignItems: "center",
        backgroundColor: tone.background,
        border: `1px solid ${tone.border}`,
        borderRadius: theme.radius.pill,
        color: tone.text,
        display: "inline-flex",
        fontSize: 11,
        fontWeight: 700,
        gap: 6,
        padding: "4px 10px",
      }}
    >
      <span
        style={{
          backgroundColor: tone.text,
          borderRadius: 999,
          display: "inline-block",
          height: 5,
          opacity: props.status === "idle" ? 0.45 : 1,
          width: 5,
        }}
      />
      {formatStatus(props.status)}
    </span>
  );
}

function formatStatus(status: StatusTone): string {
  if (status === "idle") {
    return "空闲";
  }

  if (status === "thinking") {
    return "思考中";
  }

  if (status === "tool_calling") {
    return "读取数据";
  }

  if (status === "answering") {
    return "回答中";
  }

  if (status === "done") {
    return "完成";
  }

  return "错误";
}
