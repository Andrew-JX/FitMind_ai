import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { useTheme } from "../../theme/ThemeContext";

export function AssistantIntroCard() {
  const { theme } = useTheme();

  return (
    <Card>
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle(theme)}>AI Assistant</p>
          <h2 style={titleStyle}>AI 训练助手</h2>
        </div>
      </div>
      <p style={subtitleStyle(theme)}>
        助手会先调用确定性训练工具，再基于 evidence 解释你的训练表现。
      </p>
      <div style={badgeRowStyle}>
        <Badge tone="info">SSE Stream</Badge>
        <Badge tone="analysis">Tool Calling</Badge>
        <Badge tone="accent">Evidence-backed</Badge>
      </div>
    </Card>
  );
}

const headerStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  justifyContent: "space-between",
};

function eyebrowStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.6,
    margin: 0,
    textTransform: "uppercase",
  };
}

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  margin: "6px 0 0",
};

function subtitleStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 13,
    lineHeight: 1.7,
    margin: "10px 0 0",
  };
}

const badgeRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 14,
};
