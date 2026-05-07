import { Icon, type IconName } from "./Icon";
import { useTheme } from "../theme/ThemeContext";

export interface StateNoticeProps {
  description: string;
  icon?: IconName | undefined;
  title: string;
  tone?: "default" | "error" | "warning" | undefined;
}

/**
 * Renders a small shared state block for loading, empty, and error cases.
 *
 * @param props - State copy and optional semantic styling
 * @returns Shared notice UI
 */
export function StateNotice(props: StateNoticeProps) {
  const { theme } = useTheme();
  const tone = props.tone ?? "default";
  const semanticColor =
    tone === "error"
      ? theme.colors.red
      : tone === "warning"
        ? theme.colors.orange
        : theme.colors.tx3;
  const backgroundColor =
    tone === "error"
      ? theme.isDark
        ? "rgba(255,92,92,0.1)"
        : "rgba(201,48,48,0.08)"
      : tone === "warning"
        ? theme.isDark
          ? "rgba(255,155,66,0.1)"
          : "rgba(192,96,16,0.08)"
        : theme.colors.surf2;
  const borderColor =
    tone === "default"
      ? theme.colors.bdr
      : theme.isDark
        ? `${semanticColor}55`
        : `${semanticColor}44`;

  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor,
        border: `1px solid ${borderColor}`,
        borderRadius: theme.radius.card,
        display: "grid",
        gap: 8,
        justifyItems: "center",
        padding: "18px 16px",
        textAlign: "center",
      }}
    >
      {props.icon ? (
        <div
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.surf,
            borderRadius: 12,
            color: semanticColor,
            display: "inline-flex",
            height: 36,
            justifyContent: "center",
            width: 36,
          }}
        >
          <Icon name={props.icon} size={18} />
        </div>
      ) : null}
      <strong style={{ color: theme.colors.tx, fontSize: 14 }}>
        {props.title}
      </strong>
      <p
        style={{
          color: tone === "default" ? theme.colors.tx2 : semanticColor,
          fontSize: 12,
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {props.description}
      </p>
    </div>
  );
}
