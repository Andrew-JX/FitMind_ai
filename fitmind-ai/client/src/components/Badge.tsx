import { useTheme } from "../theme/ThemeContext";
import { getToneColors, type SemanticTone } from "../theme/tokens";

export interface BadgeProps {
  children: React.ReactNode;
  tone?: SemanticTone | undefined;
}

/**
 * Renders a compact monospace technical badge.
 *
 * @param props - Badge label and optional semantic tone
 * @returns Badge element
 */
export function Badge(props: BadgeProps) {
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
        fontFamily: theme.fonts.mono,
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 8px",
      }}
    >
      {props.children}
    </span>
  );
}
