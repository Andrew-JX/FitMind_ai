import { useEffect, useState } from "react";

import type {
  LoginRequest,
  RegisterRequest,
} from "../../../../shared/src/auth";
import type { RegistrationPolicyData } from "../../../../shared/src/consent";

import { fetchRegistrationPolicy } from "./auth-api";
import { Icon } from "../../components/Icon";
import { SiteFooter } from "../../components/SiteFooter";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import {
  getRememberedLoginEmail,
  saveRememberedLoginEmail,
} from "./remembered-login-email";
import type { AuthStatus } from "./use-auth";
import { accentAlpha, brandAlpha, BRAND_NEON } from "../../theme/tokens";

type AuthMode = "login" | "register";

export interface AuthScreenProps {
  errorMessage: string | null;
  /**
   * True once the session is live. The screen stays mounted for a short beat so
   * the submit button can finish its checkmark before the app takes over.
   */
  isAuthenticated?: boolean | undefined;
  onLogin: (input: LoginRequest) => Promise<void>;
  onRegister: (input: RegisterRequest) => Promise<void>;
  /** Fired when an interactive submit starts, so the app can hold the dwell. */
  onSubmitStart?: (() => void) | undefined;
  status: AuthStatus;
}

export function AuthScreen(props: AuthScreenProps) {
  const { errorMessage, onLogin, onRegister, status } = props;
  const { theme } = useTheme();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginEmail, setLoginEmail] = useState(getRememberedLoginEmail);
  const [loginPassword, setLoginPassword] = useState("");
  const [registrationEmail, setRegistrationEmail] = useState("");
  const [registrationPassword, setRegistrationPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [rememberEmail, setRememberEmail] = useState(
    () => getRememberedLoginEmail().length > 0,
  );
  // Cross-border consent is asked separately from the agreement, and starts
  // unchecked: a pre-ticked box is not consent.
  const [acceptedCrossBorder, setAcceptedCrossBorder] = useState(false);
  const [localErrorMessage, setLocalErrorMessage] = useState<string | null>(
    null,
  );
  // Server auth errors belong to the form that actually submitted them. Without
  // this owner, switching tabs relabels a failed login as "registration failed"
  // even though no registration request was sent.
  const [submittedMode, setSubmittedMode] = useState<AuthMode | null>(null);
  // What this instance actually does, read from the server rather than assumed.
  // `null` means the answer has not arrived; `policyFailed` means it will not.
  const [policy, setPolicy] = useState<RegistrationPolicyData | null>(null);
  const [policyFailed, setPolicyFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchRegistrationPolicy()
      .then((data) => {
        if (!cancelled) {
          setPolicy(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPolicyFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const isPolicyLoading = policy === null && !policyFailed;
  // Fail closed: an instance whose policy could not be read must not accept
  // sign-ups, because the consent it requires is one of the unknowns. Login is
  // deliberately unaffected — an existing user has already consented, and
  // locking them out over a failed policy read would turn a legal control into
  // an availability incident.
  const isRegistrationOpen = policy?.registration_open === true;
  const requiresCrossBorderConsent =
    policy?.cross_border_consent_required === true;

  const isSubmitting = status === "authenticating";
  const isSucceeded = props.isAuthenticated === true;
  // Design: the button shrinks to a circle for both the spinner and the check.
  const isMorphed = isSubmitting || isSucceeded;
  const email = mode === "login" ? loginEmail : registrationEmail;
  const password = mode === "login" ? loginPassword : registrationPassword;
  const visibleErrorMessage =
    localErrorMessage ?? (submittedMode === mode ? errorMessage : null);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setLocalErrorMessage(null);
    setSubmittedMode(mode);

    if (mode === "register") {
      // Every check below is repeated on the server, which is where the real
      // gate lives. These exist to explain the refusal in place rather than to
      // enforce it: the previous version enforced consent only here, so
      // anything that was not this form could register without it.
      if (!isRegistrationOpen || policy === null) {
        setLocalErrorMessage(
          policyFailed
            ? "无法读取本站的注册政策，暂时不能创建账号。登录不受影响，请稍后再试。"
            : "本站当前不开放自助注册。",
        );
        return;
      }

      if (password !== confirmPassword) {
        setLocalErrorMessage("两次输入的密码不一致，请重新确认。");
        return;
      }

      if (requiresCrossBorderConsent && !acceptedCrossBorder) {
        setLocalErrorMessage(
          "请先阅读并勾选跨境存储同意项，再创建账号。你也可以不注册，直接关闭本页。",
        );
        return;
      }

      await onRegister({
        email,
        password,
        display_name: displayName.trim() || undefined,
        cross_border_consent: requiresCrossBorderConsent
          ? { accepted: true, policy_version: policy.policy_version }
          : undefined,
      });
      return;
    }

    if (rememberEmail) {
      saveRememberedLoginEmail(loginEmail);
    } else {
      saveRememberedLoginEmail("");
    }

    props.onSubmitStart?.();
    await onLogin({ email: loginEmail, password: loginPassword });
  }

  return (
    <main
      style={{
        alignItems: "center",
        background: `radial-gradient(circle at top, ${accentAlpha(
          theme,
          theme.isDark ? 0.16 : 0.12,
        )}, transparent 32%), ${theme.colors.bg}`,
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
              setSubmittedMode(null);
              setMode("login");
            }}
            style={toggleButtonStyle(theme, mode === "login")}
            type="button"
          >
            登录
          </button>
          <button
            disabled={isSubmitting || isPolicyLoading || !isRegistrationOpen}
            onClick={() => {
              setLocalErrorMessage(null);
              setSubmittedMode(null);
              setMode("register");
            }}
            style={toggleButtonStyle(theme, mode === "register")}
            type="button"
          >
            注册
          </button>
        </div>

        {/* Says why the sign-up tab is unavailable instead of leaving a dead
            control. The mainland instance is invite-only, and until this the
            only way to discover that was to fill the form in and be refused. */}
        {mode === "login" && !isPolicyLoading && !isRegistrationOpen ? (
          <div style={{ marginBottom: 16 }}>
            <StateNotice
              description={
                policyFailed
                  ? "无法读取本站的注册政策，注册暂时关闭。登录不受影响。"
                  : "本站账号由管理员邀请创建。如需账号，请联系站点邮箱。"
              }
              icon={policyFailed ? "refresh" : "user"}
              title={policyFailed ? "注册暂不可用" : "当前为邀请制"}
              tone={policyFailed ? "warning" : "default"}
            />
          </div>
        ) : null}

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
              key={`${mode}-email`}
              name={mode === "login" ? "login-email" : "registration-email"}
              onChange={(event) => {
                if (mode === "login") {
                  setLoginEmail(event.target.value);
                } else {
                  setRegistrationEmail(event.target.value);
                }
              }}
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
              key={`${mode}-password`}
              minLength={8}
              name={
                mode === "login" ? "login-password" : "registration-password"
              }
              onChange={(event) => {
                if (mode === "login") {
                  setLoginPassword(event.target.value);
                } else {
                  setRegistrationPassword(event.target.value);
                }
              }}
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

          {/* Rendered only where it applies. A mainland instance stores nothing
              abroad, and asking it to agree to cross-border storage would be
              asking for consent to something that does not happen.

              The categories listed are the ones actually written to the
              database, checked against the migrations rather than recalled:
              the earlier wording said "account, workouts and chat" and left
              out the training profile and the feedback form's user agent.

              No country is named here. Which countries hold the data is a fact
              about deployment configuration that this bundle cannot verify —
              it shipped identically to both targets while asserting "Vercel and
              Neon, both in the United States". "Outside mainland China" is what
              the server actually told us; the named recipients, their countries
              and their contact details live in the privacy policy, which is one
              page and can be kept correct. */}
          {mode === "register" && requiresCrossBorderConsent ? (
            <label style={consentStyle(theme)}>
              <input
                checked={acceptedCrossBorder}
                disabled={isSubmitting}
                onChange={(event) =>
                  setAcceptedCrossBorder(event.target.checked)
                }
                style={consentCheckboxStyle(theme)}
                type="checkbox"
              />
              <span>
                我已阅读
                <a
                  href="/legal/privacy.html"
                  rel="noreferrer"
                  style={consentLinkStyle(theme)}
                  target="_blank"
                >
                  隐私政策
                </a>
                与
                <a
                  href="/legal/terms.html"
                  rel="noreferrer"
                  style={consentLinkStyle(theme)}
                  target="_blank"
                >
                  用户协议
                </a>
                ，并同意本站将我的账号信息、训练记录与计划、训练档案（训练目标、可用器械、伤病约束）、助手对话，以及我提交的反馈（含提交页面与浏览器标识）
                <strong>存储在中国境外的服务器</strong>
                。接收方名称、所在国与联系方式见隐私政策第五节。
                <br />
                其中伤病信息属于敏感个人信息，将在你填写训练档案时
                <strong>另行单独征求同意</strong>，不包含在本项之内。
                <br />
                {/* Shown because the policy page tells users they can compare
                    this against the version printed there. It said so before
                    anything but the catch-up screen actually displayed it. */}
                （政策版本 {policy.policy_version}）
              </span>
            </label>
          ) : null}

          <div style={submitRowStyle}>
            <button
              disabled={isMorphed}
              style={submitButtonStyle(isMorphed)}
              type="submit"
            >
              <span style={submitLabelStyle(isMorphed)}>
                {mode === "login" ? "登录 FitMind AI" : "创建账号"}
              </span>
              <svg
                aria-hidden="true"
                height="26"
                style={submitCheckStyle(isSucceeded)}
                viewBox="0 0 24 24"
                width="26"
              >
                <path
                  d="M5 12.5 10 17.5 19 7"
                  fill="none"
                  stroke="#0f0f0f"
                  strokeDasharray="30"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.6"
                  style={{
                    animation: isSucceeded
                      ? "fmcheck 0.5s cubic-bezier(0.65, 0, 0.35, 1) 0.1s both"
                      : "none",
                  }}
                />
              </svg>
            </button>
            <svg
              aria-hidden="true"
              height="62"
              style={submitSpinnerStyle(isSubmitting)}
              viewBox="0 0 62 62"
              width="62"
            >
              <circle
                cx="31"
                cy="31"
                fill="none"
                r="28"
                stroke={brandAlpha(0.22)}
                strokeWidth="3"
              />
              <circle
                cx="31"
                cy="31"
                fill="none"
                r="28"
                stroke={BRAND_NEON}
                strokeDasharray="44 176"
                strokeLinecap="round"
                strokeWidth="3"
              />
            </svg>
          </div>
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

        <SiteFooter />
      </section>
    </main>
  );
}

/** Fixed-height row so the button can shrink without moving the layout. */
const submitRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  height: 48,
  justifyContent: "center",
  position: "relative",
};

/**
 * Design's morphing submit button: full-width pill that shrinks to a 48px
 * circle while the request runs and while the checkmark draws.
 *
 * @param isMorphed - Whether the button is in its circular state
 * @returns Button style
 */
function submitButtonStyle(isMorphed: boolean): React.CSSProperties {
  return {
    alignItems: "center",
    background: BRAND_NEON,
    border: "none",
    borderRadius: isMorphed ? 999 : 14,
    color: "#0f0f0f",
    cursor: isMorphed ? "default" : "pointer",
    display: "flex",
    fontSize: 14,
    fontWeight: 700,
    height: 48,
    justifyContent: "center",
    // Disabled only to block a second submit; the design keeps the morphing
    // button at full neon, so opt out of the global disabled dimming.
    opacity: 1,
    overflow: "hidden",
    padding: 0,
    position: "relative",
    transition:
      "width 0.5s cubic-bezier(0.65, 0, 0.35, 1), border-radius 0.5s cubic-bezier(0.65, 0, 0.35, 1)",
    width: isMorphed ? 48 : "100%",
  };
}

function submitLabelStyle(isMorphed: boolean): React.CSSProperties {
  return {
    opacity: isMorphed ? 0 : 1,
    transition: "opacity 0.2s ease",
    whiteSpace: "nowrap",
  };
}

function submitCheckStyle(isSucceeded: boolean): React.CSSProperties {
  return {
    left: 11,
    opacity: isSucceeded ? 1 : 0,
    position: "absolute",
    top: 11,
    transition: "opacity 0.15s ease",
  };
}

function submitSpinnerStyle(isSubmitting: boolean): React.CSSProperties {
  return {
    animation: "fmspin 0.8s linear infinite",
    opacity: isSubmitting ? 1 : 0,
    pointerEvents: "none",
    position: "absolute",
    transition: "opacity 0.3s ease",
  };
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
  background: BRAND_NEON,
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

/** Cross-border consent row: checkbox stays top-aligned beside wrapped text. */
function consentStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "flex-start",
    color: theme.colors.tx2,
    display: "flex",
    fontSize: 12,
    gap: 8,
    lineHeight: 1.6,
  };
}

/** A comfortably tappable native checkbox with a quiet grey check state. */
function consentCheckboxStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    accentColor: theme.colors.tx2,
    cursor: "pointer",
    flex: "0 0 auto",
    height: 18,
    margin: "2px 0 0",
    width: 18,
  };
}

function consentLinkStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    textDecoration: "underline",
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
