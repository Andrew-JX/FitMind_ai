import { Icon, type IconName } from "./Icon";
import { useTheme } from "../theme/ThemeContext";

export interface IconButtonProps {
  disabled?: boolean | undefined;
  label: string;
  onClick?: (() => void) | undefined;
  tone?: "default" | "danger" | undefined;
  type?: "button" | "submit" | undefined;
  icon: IconName;
}

/**
 * Renders a square icon button for shell and list actions.
 *
 * @param props - Button icon, label, and click behavior
 * @returns Icon button
 */
export function IconButton(props: IconButtonProps) {
  const { theme } = useTheme();
  const color = props.tone === "danger" ? theme.colors.red : theme.colors.tx3;

  return (
    <button
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      style={{
        alignItems: "center",
        backgroundColor: theme.colors.surf2,
        border: `1px solid ${theme.colors.bdr}`,
        borderRadius: 10,
        color,
        cursor: props.disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        flex: "0 0 32px",
        height: 32,
        justifyContent: "center",
        opacity: props.disabled ? 0.56 : 1,
        width: 32,
      }}
      type={props.type ?? "button"}
    >
      <Icon name={props.icon} size={14} />
    </button>
  );
}
