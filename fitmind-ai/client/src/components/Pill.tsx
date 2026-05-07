import { useTheme } from "../theme/ThemeContext";
import { getToneColors, type SemanticTone } from "../theme/tokens";

export interface PillProps {
  children: React.ReactNode;
  tone?: SemanticTone | undefined;
}

/**
 * Renders a compact semantic pill label.
 *
 * @param props - Pill label and optional semantic tone
 * @returns Pill element
 */
export function Pill(props: PillProps) {
  const { theme } = useTheme();
  const tone = getToneColors(theme, props.tone ?? "neutral");

  return (
    <span
      style={{
        backgroundColor: tone.background,
        border: `1px solid ${tone.border}`,
        borderRadius: theme.radius.pill,
        color: tone.text,
        display: "inline-flex",
        fontSize: 11,
        fontWeight: 700,
        padding: "4px 10px",
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </span>
  );
}
