import { useTheme } from "../theme/ThemeContext";
import { Badge } from "./Badge";
import { Icon, type IconName } from "./Icon";
import { IconButton } from "./IconButton";

export type AppTabKey = "training" | "analysis" | "assistant";

export interface AppShellProps {
  activeTab: AppTabKey;
  children: React.ReactNode;
  onClearAuth: () => void;
  onSelectTab: (tab: AppTabKey) => void;
  subtitle: string;
  userLabel: string;
}

export function AppShell(props: AppShellProps) {
  const { isDark, theme, toggleTheme } = useTheme();

  return (
    <div
      style={{
        backgroundColor: theme.colors.bg,
        color: theme.colors.tx,
        margin: "0 auto",
        maxWidth: 430,
        minHeight: "100dvh",
        paddingBottom: "calc(92px + env(safe-area-inset-bottom, 0px))",
        width: "100%",
      }}
    >
      <header
        style={{
          backgroundColor: theme.colors.bg,
          borderBottom: `1px solid ${theme.colors.bdr}`,
          padding: "max(12px, env(safe-area-inset-top, 0px)) 16px 12px",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            alignItems: "flex-start",
            display: "flex",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <div style={{ alignItems: "center", display: "flex", gap: 10, minWidth: 0 }}>
            <div
              style={{
                alignItems: "center",
                backgroundColor: theme.colors.ac,
                borderRadius: 10,
                color: theme.colors.acText,
                display: "flex",
                flex: "0 0 30px",
                height: 30,
                justifyContent: "center",
                width: 30,
              }}
            >
              <Icon name="zap" size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
                <strong style={{ fontSize: 16 }}>FitMind AI</strong>
                <Badge tone="accent">Workspace</Badge>
              </div>
              <div
                style={{
                  color: theme.colors.tx2,
                  fontSize: 12,
                  lineHeight: 1.5,
                  marginTop: 3,
                }}
              >
                {props.subtitle}
              </div>
            </div>
          </div>

          <IconButton
            icon={isDark ? "sun" : "moon"}
            label="切换主题"
            onClick={toggleTheme}
          />
        </div>

        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
            marginTop: 12,
          }}
        >
          <div
            style={{
              color: theme.colors.tx2,
              fontSize: 11,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            当前用户：{props.userLabel}
          </div>
          <button
            onClick={props.onClearAuth}
            style={{
              backgroundColor: theme.colors.surf2,
              border: `1px solid ${theme.colors.bdr}`,
              borderRadius: theme.radius.pill,
              color: theme.colors.tx2,
              cursor: "pointer",
              flex: "0 0 auto",
              fontSize: 11,
              fontWeight: 700,
              padding: "7px 12px",
            }}
            type="button"
          >
            退出登录
          </button>
        </div>
      </header>

      <main style={{ padding: "12px 16px 0" }}>{props.children}</main>

      <nav style={navStyle(theme)}>
        <TabButton
          active={props.activeTab === "training"}
          icon="dumbbell"
          label="训练"
          onClick={() => props.onSelectTab("training")}
        />
        <TabButton
          active={props.activeTab === "analysis"}
          icon="chart"
          label="分析"
          onClick={() => props.onSelectTab("analysis")}
        />
        <TabButton
          active={props.activeTab === "assistant"}
          icon="bot"
          label="AI 助手"
          onClick={() => props.onSelectTab("assistant")}
        />
      </nav>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  icon: IconName;
  label: string;
  onClick: () => void;
}

function TabButton(props: TabButtonProps) {
  const { theme } = useTheme();

  return (
    <button
      onClick={props.onClick}
      style={{
        alignItems: "center",
        background: "transparent",
        border: "none",
        color: props.active ? theme.colors.ac : theme.colors.tx3,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minHeight: 48,
        minWidth: 0,
        padding: "5px 0",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
      type="button"
    >
      <Icon name={props.icon} size={20} />
      <span
        style={{
          fontSize: 11,
          fontWeight: props.active ? 700 : 500,
          lineHeight: 1.2,
          whiteSpace: "nowrap",
        }}
      >
        {props.label}
      </span>
    </button>
  );
}

function navStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 18,
    bottom: "max(10px, env(safe-area-inset-bottom, 0px))",
    boxShadow: theme.shadows.card,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    left: "50%",
    maxWidth: 390,
    padding: "7px 6px",
    position: "fixed",
    transform: "translateX(-50%)",
    width: "calc(100% - 20px)",
    zIndex: 300,
  };
}
