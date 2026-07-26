import { useState } from "react";

import type {
  LoginRequest,
  RegisterRequest,
} from "../../../../shared/src/auth";

import { Icon } from "../../components/Icon";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import {
  getRememberedLoginEmail,
  saveRememberedLoginEmail,
} from "./remembered-login-email";
import type { AuthStatus } from "./use-auth";

type AuthMode = "login" | "register";

export interface AuthScreenProps {
  errorMessage: string | null;
  onLogin: (input: LoginRequest) => Promise<void>;
  onRegister: (input: RegisterRequest) => Promise<void>;
  status: AuthStatus;
}

export function AuthScreen(props: AuthScreenProps) {
  const { errorMessage, onLogin, onRegister, status } = props;
  const { theme } = useTheme();
  const rememberedEmail = getRememberedLoginEmail();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [rememberEmail, setRememberEmail] = useState(
    rememberedEmail.length > 0,
  );
  const [localErrorMessage, setLocalErrorMessage] = useState<string | null>(
    null,
  );

  const isSubmitting = status === "authenticating";
  const visibleErrorMessage = localErrorMessage ?? errorMessage;

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setLocalErrorMessage(null);

    if (mode === "register") {
      if (password !== confirmPassword) {
        setLocalErrorMessage("两次输入的密码不一致，请重新确认。");
        return;
      }

      await onRegister({
        email,
        password,
        display_name: displayName.trim() || undefined,
      });
      return;
    }

    if (rememberEmail) {
      saveRememberedLoginEmail(email);
    } else {
      saveRememberedLoginEmail("");
    }

    await onLogin({ email, password });
  }

  return (
    <main
      style={{
        alignItems: "center",
        background: `radial-gradient(circle at top, ${
          theme.isDark ? "rgba(200,240,53,0.16)" : "rgba(92,116,4,0.12)"
        }, transparent 32%), ${theme.colors.bg}`,
        color: theme.colors.tx,
        display: "flex",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "24px 16px",
      }}
    >
      <section
        style={{
          backgroundColor: theme.colors.surf,
          border: `1px solid ${theme.colors.bdr}`,
          borderRadius: 18,
          boxShadow: theme.shadows.card,
          maxWidth: 390,
          padding: "24px 20px",
          width: "100%",
        }}
      >
        <span style={logoOuterStyle(theme)}>
          <span style={logoMidStyle}>
            <span style={logoInnerStyle}>
              <Icon name="dumbbell" size={23} />
            </span>
          </span>
        </span>

        <h1 style={{ fontSize: 28, margin: 0 }}>FitMind AI</h1>
        <p
          style={{
            color: theme.colors.tx2,
            fontSize: 13,
            lineHeight: 1.6,
            marginBottom: 20,
            marginTop: 8,
          }}
        >
          基于真实训练日志的可追溯 AI 教练。
        </p>

        <div
          style={{
            backgroundColor: theme.colors.surf2,
            borderRadius: 14,
            display: "grid",
            gap: 8,
            gridTemplateColumns: "1fr 1fr",
            marginBottom: 20,
            padding: 6,
            position: "relative",
          }}
        >
          <div aria-hidden="true" style={segmentPillStyle(theme, mode)} />
          <button
            disabled={isSubmitting}
            onClick={() => {
              setLocalErrorMessage(null);
              setMode("login");
            }}
            style={toggleButtonStyle(theme, mode === "login")}
            type="button"
          >
            登录
          </button>
          <button
            disabled={isSubmitting}
            onClick={() => {
              setLocalErrorMessage(null);
              setMode("register");
            }}
            style={toggleButtonStyle(theme, mode === "register")}
            type="button"
          >
            注册
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          {mode === "register" ? (
            <label style={labelStyle(theme)}>
              昵称
              <input
                autoComplete="nickname"
                disabled={isSubmitting}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="怎么称呼你"
                style={fieldStyle(theme)}
                type="text"
                value={displayName}
              />
            </label>
          ) : null}

          <label style={labelStyle(theme)}>
            邮箱
            <input
              autoComplete="email"
              disabled={isSubmitting}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              style={fieldStyle(theme)}
              type="email"
              value={email}
            />
          </label>

          <label style={labelStyle(theme)}>
            密码
            <input
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              disabled={isSubmitting}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 8 位"
              required
              style={fieldStyle(theme)}
              type="password"
              value={password}
            />
          </label>

          {mode === "login" ? (
            <label style={rememberEmailStyle(theme)}>
              <input
                checked={rememberEmail}
                disabled={isSubmitting}
                onChange={(event) => setRememberEmail(event.target.checked)}
                type="checkbox"
              />
              记住邮箱，不保存密码
            </label>
          ) : null}

          {mode === "register" ? (
            <label style={labelStyle(theme)}>
              确认密码
              <input
                autoComplete="new-password"
                disabled={isSubmitting}
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="再输入一次"
                required
                style={fieldStyle(theme)}
                type="password"
                value={confirmPassword}
              />
            </label>
          ) : null}

          <button
            disabled={isSubmitting}
            style={{
              alignItems: "center",
              background: "#c8f035",
              border: "none",
              borderRadius: 14,
              color: "#0f0f0f",
              cursor: "pointer",
              display: "flex",
              fontSize: 14,
              fontWeight: 700,
              height: 48,
              justifyContent: "center",
              padding: 0,
            }}
            type="submit"
          >
            {isSubmitting
              ? "提交中..."
              : mode === "login"
                ? "登录 FitMind AI"
                : "创建账号"}
          </button>
        </form>

        {visibleErrorMessage ? (
          <div style={{ marginTop: 14 }}>
            <StateNotice
              description={visibleErrorMessage}
              title={mode === "register" ? "注册失败" : "登录失败"}
              tone="error"
            />
          </div>
        ) : null}

        <p
          style={{
            color: theme.colors.tx3,
            fontSize: 11,
            lineHeight: 1.6,
            marginBottom: 0,
            marginTop: 14,
          }}
        >
          登录后会为你安全地保持登录状态，下次打开无需重新登录。
        </p>
      </section>
    </main>
  );
}

function toggleButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isActive: boolean,
): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    borderRadius: 12,
    color: isActive ? theme.colors.tx : theme.colors.tx2,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: isActive ? 700 : 500,
    padding: "10px 12px",
    position: "relative",
    transition: "color 0.3s ease",
  };
}

/**
 * Sliding glass pill behind the 登录/注册 segmented control (design auth range).
 *
 * @param theme - Active theme tokens
 * @param mode - Currently selected auth mode
 * @returns The absolutely positioned pill, translated to the active segment
 */
function segmentPillStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  mode: AuthMode,
): React.CSSProperties {
  return {
    background: `linear-gradient(180deg, ${theme.colors.glassA}, ${theme.colors.glassB})`,
    border: `1px solid ${theme.colors.glassA}`,
    borderRadius: 12,
    boxShadow: `inset 0 1px 0 ${theme.colors.glassC}, 0 6px 14px ${theme.colors.sh40}`,
    height: "calc(100% - 12px)",
    left: 6,
    pointerEvents: "none",
    position: "absolute",
    top: 6,
    transform: `translateX(${mode === "register" ? "calc(100% + 8px)" : "0"})`,
    transition: "transform 0.5s cubic-bezier(0.3, 1.4, 0.4, 1)",
    width: "calc((100% - 20px) / 2)",
  };
}

/** Design: nested logo mark on the auth screen (56 / 44 / 31px). */
function logoOuterStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.isDark ? "#0d0d0d" : theme.colors.surf2,
    borderRadius: 16,
    boxShadow: `0 4px 14px ${theme.colors.sh40}`,
    display: "flex",
    height: 56,
    justifyContent: "center",
    marginBottom: 16,
    width: 56,
  };
}

const logoMidStyle: React.CSSProperties = {
  alignItems: "center",
  background: "#3a3a3a",
  borderRadius: 13,
  display: "flex",
  height: 44,
  justifyContent: "center",
  width: 44,
};

const logoInnerStyle: React.CSSProperties = {
  alignItems: "center",
  background: "#c8f035",
  borderRadius: 9,
  color: "#0f0f0f",
  display: "flex",
  height: 31,
  justifyContent: "center",
  width: 31,
};

function labelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    display: "grid",
    fontSize: 12,
    fontWeight: 600,
    gap: 6,
  };
}

function rememberEmailStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    color: theme.colors.tx2,
    display: "flex",
    fontSize: 12,
    gap: 8,
  };
}

function fieldStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr2}`,
    borderRadius: 12,
    color: theme.colors.tx,
    font: "inherit",
    fontSize: 16,
    padding: 12,
    width: "100%",
  };
}
