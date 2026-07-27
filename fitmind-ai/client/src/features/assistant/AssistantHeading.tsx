import { useTheme } from "../../theme/ThemeContext";

/**
 * Assistant tab's page heading.
 *
 * The design opens the tab with a bare text block rather than a card, so the
 * first real surface on screen is 本周计划.
 *
 * @returns Heading block
 */
export function AssistantHeading() {
  const { theme } = useTheme();

  return (
    <div style={headingStyle}>
      <h2 style={titleStyle}>训练助手</h2>
      <span style={subtitleStyle(theme)}>
        把最近训练记录转成更容易理解的行动建议、提醒和判断依据。
      </span>
    </div>
  );
}

const headingStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  padding: "0 2px",
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  margin: 0,
};

function subtitleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
  };
}
