import { useState } from "react";

import type {
  LoginRequest,
  RegisterRequest,
} from "../../../../shared/src/auth";

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
        background: theme.isDark
          ? "radial-gradient(circle at top, rgba(200,240,53,0.16), transparent 32%), #0f0f0f"
          : "radial-gradient(circle at top, rgba(74,140,0,0.12), transparent 32%), #f0f0ee",
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
        <div
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.ac,
            borderRadius: 16,
            color: theme.colors.acText,
            display: "flex",
            fontSize: 18,
            fontWeight: 800,
            height: 56,
            justifyContent: "center",
            marginBottom: 16,
            width: 56,
          }}
        >
          FM
        </div>

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
          基于真实训练日志的可追溯 AI 训练分析工作台。
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
          }}
        >
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

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <label style={labelStyle(theme)}>
            邮箱
            <input
              autoComplete="email"
              disabled={isSubmitting}
              onChange={(event) => setEmail(event.target.value)}
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
            <>
              <label style={labelStyle(theme)}>
                确认密码
                <input
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  minLength={8}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  style={fieldStyle(theme)}
                  type="password"
                  value={confirmPassword}
                />
              </label>

              <label style={labelStyle(theme)}>
                显示名称
                <input
                  autoComplete="nickname"
                  disabled={isSubmitting}
                  onChange={(event) => setDisplayName(event.target.value)}
                  style={fieldStyle(theme)}
                  type="text"
                  value={displayName}
                />
              </label>
            </>
          ) : null}

          <button
            disabled={isSubmitting}
            style={{
              backgroundColor: theme.colors.ac,
              border: "none",
              borderRadius: 14,
              color: theme.colors.acText,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 700,
              padding: "13px 14px",
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
          登录状态保存在安全的 HttpOnly 会话 cookie
          中，刷新页面后会自动保持登录。
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
    backgroundColor: isActive ? theme.colors.bg : "transparent",
    border: "none",
    borderRadius: 12,
    color: isActive ? theme.colors.tx : theme.colors.tx2,
    cursor: "pointer",
    fontWeight: isActive ? 700 : 500,
    padding: "10px 12px",
  };
}

function labelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    display: "grid",
    fontSize: 12,
    gap: 8,
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
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    color: theme.colors.tx,
    fontSize: 16,
    padding: "12px 14px",
  };
}
