import type { AppTabKey } from "../app-navigation";

import { useTheme } from "../theme/ThemeContext";
import { Icon, type IconName } from "./Icon";
import { useToast } from "./ToastProvider";
import { BRAND_NEON, brandAlpha } from "../theme/tokens";

export type { AppTabKey } from "../app-navigation";

export interface AppShellProps {
  activeTab: AppTabKey;
  children: React.ReactNode;
  onSelectTab: (tab: AppTabKey) => void;
  secondaryAction?: React.ReactNode | undefined;
  subtitle: string;
}

export function AppShell(props: AppShellProps) {
  const { isDark, theme, toggleTheme } = useTheme();
  const { showToast } = useToast();

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
            alignItems: "center",
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: 10,
              minWidth: 0,
            }}
          >
            <span style={logoOuterStyle(theme)}>
              <span style={logoMidStyle}>
                <span style={logoInnerStyle}>
                  <Icon name="dumbbell" size={11} />
                </span>
              </span>
            </span>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: "block", fontSize: 15 }}>
                FitMind AI
              </strong>
              <span style={{ color: theme.colors.tx3, fontSize: 11 }}>
                {props.subtitle}
              </span>
            </div>
          </div>

          <div
            style={{
              alignItems: "center",
              display: "flex",
              flex: "0 0 auto",
              gap: 8,
            }}
          >
            <button
              aria-label="切换主题"
              onClick={() => {
                toggleTheme();
                showToast(isDark ? "已切换为浅色主题" : "已切换为深色主题");
              }}
              style={themeToggleStyle(theme)}
              type="button"
            >
              <Icon name={isDark ? "sun" : "moon"} size={14} />
            </button>
            {props.secondaryAction}
          </div>
        </div>
      </header>

      <main style={{ padding: "12px 16px 0" }}>{props.children}</main>

      <div style={bottomBarStyle}>
        <nav style={navStyle(theme)}>
          <div
            aria-hidden="true"
            style={navPillStyle(theme, props.activeTab)}
          />
          <TabButton
            active={props.activeTab === "training"}
            icon="dumbbell"
            label="训练"
            onClick={() => props.onSelectTab("training")}
          />
          <TabButton
            active={props.activeTab === "history"}
            icon="clock"
            label="历史"
            onClick={() => props.onSelectTab("history")}
          />
          <TabButton
            active={props.activeTab === "profile"}
            icon="user"
            label="个人"
            onClick={() => props.onSelectTab("profile")}
          />
        </nav>

        <button
          aria-label="AI 助手"
          onClick={() => props.onSelectTab("assistant")}
          style={assistantFabStyle(props.activeTab === "assistant")}
          type="button"
        >
          <Icon name="bot" size={26} />
        </button>
      </div>
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
        color: props.active ? theme.colors.tx : theme.colors.tx3,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minHeight: 48,
        minWidth: 0,
        padding: "5px 0",
        // Keep labels above the sliding glass pill.
        position: "relative",
        transition: "color 0.3s ease",
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

/** Design: nested logo mark — dark tile, grey inner, neon square with a barbell. */
function logoOuterStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.isDark ? "#0d0d0d" : theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 9,
    display: "flex",
    flex: "0 0 30px",
    height: 30,
    justifyContent: "center",
    width: 30,
  };
}

const logoMidStyle: React.CSSProperties = {
  alignItems: "center",
  background: "#3a3a3a",
  borderRadius: 7,
  display: "flex",
  height: 23,
  justifyContent: "center",
  width: 23,
};

const logoInnerStyle: React.CSSProperties = {
  alignItems: "center",
  background: BRAND_NEON,
  borderRadius: 4,
  color: "#0f0f0f",
  display: "flex",
  height: 15,
  justifyContent: "center",
  width: 15,
};

/** Design: 32px square theme switch in the header. */
function themeToggleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 10,
    color: theme.colors.tx3,
    cursor: "pointer",
    display: "inline-flex",
    flex: "0 0 32px",
    height: 32,
    justifyContent: "center",
    width: 32,
  };
}

/** Fixed bottom row that holds the tab nav (left) and the AI FAB (right). */
const bottomBarStyle: React.CSSProperties = {
  alignItems: "flex-end",
  bottom: "max(10px, env(safe-area-inset-bottom, 0px))",
  display: "flex",
  gap: 12,
  left: "50%",
  maxWidth: 406,
  position: "fixed",
  transform: "translateX(-50%)",
  width: "calc(100% - 24px)",
  zIndex: 300,
};

function navStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 18,
    boxShadow: theme.shadows.card,
    display: "grid",
    flex: "1 1 auto",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    minWidth: 0,
    padding: "7px 6px",
    position: "relative",
  };
}

/**
 * Always-visible AI assistant FAB (design: 62px neon-green round button).
 *
 * The neon green is intentionally hardcoded: the design keeps the FAB
 * `#c8f035` in both themes, unlike the theme accent which darkens in light
 * mode. On the assistant view it gains a neon ring instead of a nav pill.
 *
 * @param isAssistantActive - Whether the assistant view is currently shown
 * @returns FAB style with elevation and active ring
 */
function assistantFabStyle(isAssistantActive: boolean): React.CSSProperties {
  return {
    alignItems: "center",
    background: BRAND_NEON,
    border: "none",
    borderRadius: "50%",
    boxShadow: isAssistantActive
      ? `0 8px 20px rgba(0,0,0,0.45), 0 0 0 3px ${brandAlpha(0.35)}`
      : "0 8px 20px rgba(0,0,0,0.45)",
    color: "#0f0f0f",
    cursor: "pointer",
    display: "flex",
    flex: "0 0 62px",
    height: 62,
    justifyContent: "center",
    marginBottom: 6,
    transition: "box-shadow 0.3s ease",
    width: 62,
  };
}

const NAV_TAB_ORDER: AppTabKey[] = ["training", "history", "profile"];

/**
 * Sliding glass pill that marks the active tab (design segmented-control range).
 *
 * When the assistant view is active no nav tab is selected: the pill fades out
 * and slides home, mirroring the design's `navPillOn` behavior.
 *
 * @param theme - Active theme tokens
 * @param activeTab - Currently selected tab
 * @returns Absolutely positioned pill style translated to the active column
 */
function navPillStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  activeTab: AppTabKey,
): React.CSSProperties {
  const activeIndex = Math.max(0, NAV_TAB_ORDER.indexOf(activeTab));

  return {
    background: `linear-gradient(180deg, ${theme.colors.glassA}, ${theme.colors.glassB})`,
    border: `1px solid ${theme.colors.glassA}`,
    borderRadius: 13,
    boxShadow: `inset 0 1px 0 ${theme.colors.glassC}, 0 6px 14px ${theme.colors.sh40}`,
    height: "calc(100% - 14px)",
    left: 6,
    opacity: NAV_TAB_ORDER.includes(activeTab) ? 1 : 0,
    pointerEvents: "none",
    position: "absolute",
    top: 7,
    transform: `translateX(${activeIndex * 100}%)`,
    transition:
      "transform 0.5s cubic-bezier(0.3, 1.4, 0.4, 1), opacity 0.25s ease",
    width: "calc((100% - 12px) / 3)",
  };
}
