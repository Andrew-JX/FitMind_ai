import { useState } from "react";

import { Card } from "../../components/Card";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeContext";
import { AthleteProfileSheet } from "./AthleteProfileSheet";

export interface ProfileViewProps {
  displayName: string | null;
  email: string;
  onLogout: () => void;
  token: string | null;
}

/**
 * 个人 Tab：账号卡 + 训练档案入口 + 退出登录（设计稿 Screens §6）。
 *
 * @param props - Current user identity, auth token, and logout callback
 * @returns The profile tab view
 */
export function ProfileView(props: ProfileViewProps) {
  const { theme } = useTheme();
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false);
  const [profileStatusText, setProfileStatusText] = useState<string | null>(
    null,
  );

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
        <button
          onClick={() => {
            setProfileStatusText(null);
            setIsProfileSheetOpen(true);
          }}
          style={profileRowStyle(theme)}
          type="button"
        >
          <span style={rowIconStyle(theme)}>
            <Icon name="user" size={16} />
          </span>
          <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
            <strong style={{ fontSize: 14 }}>训练档案</strong>
            <span style={{ color: theme.colors.tx2, fontSize: 12 }}>
              目标 · 每周天数 · 器械 · 伤病记录
            </span>
          </span>
          <span
            aria-hidden="true"
            style={{
              color: theme.colors.tx3,
              fontSize: 18,
              marginLeft: "auto",
            }}
          >
            ›
          </span>
        </button>
        {profileStatusText ? (
          <div
            aria-live="polite"
            style={{
              color: theme.colors.green,
              fontSize: 12,
              marginTop: 8,
            }}
          >
            {profileStatusText}
          </div>
        ) : null}
      </Card>

      <button onClick={props.onLogout} style={logoutStyle(theme)} type="button">
        退出登录
      </button>

      <AthleteProfileSheet
        onClose={() => setIsProfileSheetOpen(false)}
        onSaved={setProfileStatusText}
        open={isProfileSheetOpen}
        token={props.token}
      />
    </div>
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
    background: theme.colors.soft,
    border: "none",
    borderRadius: 14,
    color: theme.colors.tx,
    cursor: "pointer",
    display: "flex",
    gap: 10,
    padding: "12px 13px",
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
    color: theme.colors.ac,
    display: "flex",
    flex: "0 0 30px",
    height: 30,
    justifyContent: "center",
    width: 30,
  };
}

/** 设计稿：红色弱底退出按钮。 */
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
