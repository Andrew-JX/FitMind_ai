import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { useTheme } from "../../theme/ThemeContext";

export function AssistantIntroCard() {
  const { theme } = useTheme();

  return (
    <Card>
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle(theme)}>智能助手</p>
          <h2 style={titleStyle}>训练助手</h2>
        </div>
      </div>
      <p style={subtitleStyle(theme)}>
        这里不只是重复分析页的数据，而是把最近训练记录转成更容易理解的行动建议、提醒和判断依据。
      </p>
      <div style={badgeRowStyle}>
        <Badge tone="accent">主动洞察</Badge>
        <Badge tone="analysis">动作进展</Badge>
        <Badge tone="info">判断依据</Badge>
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
