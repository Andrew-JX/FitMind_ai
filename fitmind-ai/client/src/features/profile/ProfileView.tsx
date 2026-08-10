import { useState } from "react";

import { Card } from "../../components/Card";
import { Icon, type IconName } from "../../components/Icon";
import { SiteFooter } from "../../components/SiteFooter";
import { useTheme } from "../../theme/ThemeContext";
import { AthleteProfileSheet } from "./AthleteProfileSheet";
import { BodyMeasurementsView } from "./BodyMeasurementsView";
import { MenstrualTrackerView } from "./MenstrualTrackerView";
import { RmCalculatorView } from "./RmCalculatorView";
import { TrainingMemosView } from "./TrainingMemosView";

export interface ProfileViewProps {
  displayName: string | null;
  email: string;
  onLogout: () => void;
  token: string | null;
}

type ActiveTool = "menu" | "menstrual" | "body" | "rm" | "memos";

/** Personal tab with account settings and account-synced training tools. */
export function ProfileView(props: ProfileViewProps) {
  const { theme } = useTheme();
  const [activeTool, setActiveTool] = useState<ActiveTool>("menu");
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false);
  const [profileStatusText, setProfileStatusText] = useState<string | null>(
    null,
  );

  if (activeTool === "menstrual") {
    return (
      <MenstrualTrackerView
        onBack={() => setActiveTool("menu")}
        token={props.token}
      />
    );
  }

  if (activeTool === "body") {
    return (
      <BodyMeasurementsView
        onBack={() => setActiveTool("menu")}
        token={props.token}
      />
    );
  }

  if (activeTool === "rm") {
    return <RmCalculatorView onBack={() => setActiveTool("menu")} />;
  }

  if (activeTool === "memos") {
    return (
      <TrainingMemosView
        onBack={() => setActiveTool("menu")}
        token={props.token}
      />
    );
  }

  const shownName = props.displayName ?? props.email;
  const avatarChar = shownName.trim().charAt(0).toUpperCase() || "F";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card>
        <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
          <div style={avatarStyle(theme)}>{avatarChar}</div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {shownName}
            </div>
            <div
              style={{
                color: theme.colors.tx2,
                fontSize: 12,
                marginTop: 3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {props.email}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ display: "grid" }}>
          <ProfileToolRow
            description="按日期标记实际经期，不做周期预测"
            icon="clock"
            label="经期记录"
            onClick={() => setActiveTool("menstrual")}
            tone="pink"
          />
          <ProfileToolRow
            description="体重、体脂率与身体围度趋势"
            icon="user"
            label="身体数据"
            onClick={() => setActiveTool("body")}
            tone="green"
          />
          <ProfileToolRow
            description="按 Epley 公式估算 1RM 与训练负荷"
            icon="chart"
            label="RM 计算器"
            onClick={() => setActiveTool("rm")}
            tone="orange"
          />
          <ProfileToolRow
            description="记录动作提示与下次训练安排"
            icon="copy"
            label="训练备忘录"
            onClick={() => setActiveTool("memos")}
            tone="blue"
          />
        </div>
      </Card>

      <Card>
        <ProfileToolRow
          description="目标 · 每周天数 · 器械 · 伤病记录"
          icon="target"
          label="训练档案"
          onClick={() => {
            setProfileStatusText(null);
            setIsProfileSheetOpen(true);
          }}
          tone="accent"
        />
        {profileStatusText ? (
          <div
            aria-live="polite"
            style={{ color: theme.colors.green, fontSize: 12, marginTop: 8 }}
          >
            {profileStatusText}
          </div>
        ) : null}
      </Card>

      <button onClick={props.onLogout} style={logoutStyle(theme)} type="button">
        退出登录
      </button>

      <SiteFooter />

      <AthleteProfileSheet
        onClose={() => setIsProfileSheetOpen(false)}
        onSaved={setProfileStatusText}
        open={isProfileSheetOpen}
        token={props.token}
      />
    </div>
  );
}

function ProfileToolRow(props: {
  description: string;
  icon: IconName;
  label: string;
  onClick: () => void;
  tone: "accent" | "pink" | "green" | "orange" | "blue";
}) {
  const { theme } = useTheme();
  const toneColor =
    props.tone === "pink"
      ? theme.colors.pink
      : props.tone === "green"
        ? theme.colors.green
        : props.tone === "orange"
          ? theme.colors.orange
          : props.tone === "blue"
            ? theme.colors.blue
            : theme.colors.ac;

  return (
    <button
      onClick={props.onClick}
      style={profileRowStyle(theme)}
      type="button"
    >
      <span style={{ ...rowIconStyle(theme), color: toneColor }}>
        <Icon name={props.icon} size={16} />
      </span>
      <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
        <strong style={{ fontSize: 14 }}>{props.label}</strong>
        <span
          style={{
            color: theme.colors.tx2,
            fontSize: 11,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {props.description}
        </span>
      </span>
      <span style={{ color: theme.colors.tx3, marginLeft: "auto" }}>
        <Icon name="chevron-right" size={17} />
      </span>
    </button>
  );
}

function avatarStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.soft,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: "50%",
    color: theme.colors.ac,
    display: "flex",
    flex: "0 0 46px",
    fontSize: 18,
    fontWeight: 800,
    height: 46,
    justifyContent: "center",
    width: 46,
  };
}

function profileRowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${theme.colors.divider}`,
    color: theme.colors.tx,
    cursor: "pointer",
    display: "flex",
    gap: 10,
    padding: "12px 2px",
    textAlign: "left",
    width: "100%",
  };
}

function rowIconStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.divider,
    borderRadius: 9,
    display: "flex",
    flex: "0 0 30px",
    height: 30,
    justifyContent: "center",
    width: 30,
  };
}

function logoutStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: "rgba(255,92,92,0.12)",
    border: "1px solid rgba(255,92,92,0.35)",
    borderRadius: 12,
    color: theme.colors.red,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    padding: "12px 10px",
    width: "100%",
  };
}
