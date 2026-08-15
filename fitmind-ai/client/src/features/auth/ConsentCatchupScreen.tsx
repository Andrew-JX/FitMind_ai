import { useState } from "react";

import type { PendingConsentDto } from "../../../../shared/src/consent";

import { useTheme } from "../../theme/ThemeContext";
import { accentAlpha } from "../../theme/tokens";

export interface ConsentCatchupScreenProps {
  /** The consents this account still owes, in the order they will be asked. */
  pendingConsents: PendingConsentDto[];
  onAccept: (consent: PendingConsentDto) => Promise<void>;
  onDecline: () => Promise<void>;
  /** Deletes the account from the active database. Requires the password. */
  onDeleteAccount: (password: string) => Promise<void>;
  /**
   * Deletes all stored health data, keeping the account and training history.
   */
  onWithdrawHealthData: () => Promise<void>;
}

interface ConsentCopy {
  title: string;
  body: React.ReactNode;
  confirmationCopy: React.ReactNode;
}

/**
 * Blocking screen that asks accounts predating the consent seam for the
 * consents they never gave.
 *
 * @param props - The outstanding consents and the accept/decline handlers
 * @returns The catch-up UI
 *
 * @remarks
 * This screen exists because the alternative was a backfill migration, and a
 * backfilled consent row is a signature the user did not write. The two
 * pre-existing accounts were notified offline before their data was deleted,
 * but being told about a policy is not the same act as agreeing to it, so they
 * are asked here instead.
 *
 * Declining offers two distinct outcomes, because they are genuinely different
 * and an earlier version conflated them. Logging out ends the session but
 * nothing else: the account and its data — including injury constraints — stay
 * in the overseas database under the consent that was just refused. Only
 * deletion actually stops the processing. The screen now says so and provides
 * both, rather than claiming the first is the second.
 */
export function ConsentCatchupScreen(props: ConsentCatchupScreenProps) {
  const { theme } = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Deletion is irreversible, so it is asked for twice rather than fired from
  // the first click — and the server re-checks the password regardless, because
  // a dialog protects nobody who is calling the API directly.
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  const consent = props.pendingConsents[0];

  if (consent === undefined) {
    return null;
  }

  const copy = getConsentCopy(consent, theme.colors.ac);

  async function handleAccept(): Promise<void> {
    if (consent === undefined) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await props.onAccept(consent);
    } catch {
      setErrorMessage("提交失败，请检查网络后重试。未提交前不会记录任何同意。");
    } finally {
      setIsSubmitting(false);
    }
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
          display: "grid",
          gap: 16,
          maxWidth: 420,
          padding: "24px 20px",
          width: "100%",
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0 }}>{copy.title}</h1>

        <div
          style={{
            color: theme.colors.tx2,
            display: "grid",
            fontSize: 13,
            gap: 10,
            lineHeight: 1.7,
          }}
        >
          {copy.body}
        </div>

        {props.pendingConsents.length > 1 ? (
          <p style={{ color: theme.colors.tx3, fontSize: 12, margin: 0 }}>
            还有 {props.pendingConsents.length - 1} 项需要确认，将逐项询问。
          </p>
        ) : null}

        <p
          style={{
            color: theme.colors.tx2,
            fontSize: 13,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {copy.confirmationCopy}
        </p>

        {errorMessage !== null ? (
          <p style={{ color: theme.colors.red, fontSize: 12, margin: 0 }}>
            {errorMessage}
          </p>
        ) : null}

        <div style={{ display: "grid", gap: 8 }}>
          <div style={acceptSubmitRowStyle}>
            <button
              disabled={isSubmitting}
              onClick={handleAccept}
              style={acceptSubmitButtonStyle(theme, isSubmitting)}
              type="button"
            >
              <span style={acceptSubmitLabelStyle(isSubmitting)}>
                我已阅读并同意，继续
              </span>
            </button>
            <span aria-hidden="true" style={acceptSpinnerStyle(isSubmitting)}>
              <span style={acceptSpinnerRingStyle(theme)} />
            </span>
          </div>

          {/* The proportionate way out of a health-data consent: remove the
              sensitive data, keep everything else. Without it, declining this
              one consent cost the user their entire training history — which is
              refusing service over an unrelated consent, not a free choice. */}
          {consent.consent_type === "sensitive_health_data" ? (
            <button
              disabled={isSubmitting}
              onClick={() => {
                setIsSubmitting(true);
                setErrorMessage(null);
                void props
                  .onWithdrawHealthData()
                  .catch(() => {
                    setErrorMessage(
                      "删除失败，你的健康数据没有被改动。请稍后重试。",
                    );
                  })
                  .finally(() => {
                    setIsSubmitting(false);
                  });
              }}
              style={{
                background: "none",
                border: `1px solid ${theme.colors.ac}66`,
                borderRadius: 12,
                color: theme.colors.ac,
                cursor: isSubmitting ? "default" : "pointer",
                fontSize: 13,
                padding: "10px 16px",
              }}
              type="button"
            >
              不同意，请删除全部健康数据（保留账号与训练记录）
            </button>
          ) : null}

          {/* Declining is a real option, but it has to be an honest one. Logging
              out on its own does not stop anything: the account, the training
              data and the injury constraints stay in the same overseas database
              under the consent that was just refused. So the two outcomes are
              offered separately and described for what they actually do. */}
          <button
            disabled={isSubmitting}
            onClick={() => {
              void props.onDecline();
            }}
            style={{
              background: "none",
              border: `1px solid ${theme.colors.bdr}`,
              borderRadius: 12,
              color: theme.colors.tx2,
              cursor: isSubmitting ? "default" : "pointer",
              fontSize: 13,
              padding: "10px 16px",
            }}
            type="button"
          >
            暂不同意，先退出登录
          </button>

          {isConfirmingDelete ? (
            <div
              style={{
                border: `1px solid ${theme.colors.red}55`,
                borderRadius: 12,
                display: "grid",
                gap: 8,
                padding: "12px 14px",
              }}
            >
              {/* Says what the implementation actually does. An earlier version
                  promised "permanently deleted, unrecoverable" while the code
                  ran a single `DELETE FROM users` — which clears the live
                  database but says nothing about the host's point-in-time
                  history, where a copy can persist for the length of the
                  retention window. */}
              <p
                style={{
                  color: theme.colors.tx,
                  fontSize: 12,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                这会从<strong>活动数据库中删除</strong>
                你的账号、全部训练记录与计划、训练档案（含伤病信息）、助手对话、反馈与同意记录，并
                <strong>立即停止对它们的一切业务处理</strong>
                。你无法再恢复它们。
                <br />
                托管商的<strong>备份与时间点恢复副本</strong>
                会在其保留期届满后清除，期间不用于任何业务处理。
              </p>
              <label
                style={{
                  color: theme.colors.tx2,
                  display: "grid",
                  fontSize: 12,
                  gap: 4,
                }}
              >
                请输入当前密码以确认
                <input
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  style={{
                    backgroundColor: theme.colors.bg,
                    border: `1px solid ${theme.colors.bdr}`,
                    borderRadius: 8,
                    color: theme.colors.tx,
                    fontSize: 13,
                    padding: "8px 10px",
                  }}
                  type="password"
                  value={deletePassword}
                />
              </label>
              <button
                disabled={isSubmitting || deletePassword.length === 0}
                onClick={() => {
                  setIsSubmitting(true);
                  setErrorMessage(null);
                  void props
                    .onDeleteAccount(deletePassword)
                    .catch(() => {
                      setErrorMessage(
                        "删除失败，你的数据没有被改动。请确认密码是否正确，或通过隐私政策末尾的邮箱联系我们。",
                      );
                    })
                    .finally(() => {
                      setIsSubmitting(false);
                    });
                }}
                style={{
                  backgroundColor:
                    deletePassword.length === 0
                      ? theme.colors.surf2
                      : theme.colors.red,
                  border: "none",
                  borderRadius: 10,
                  color:
                    deletePassword.length === 0 ? theme.colors.tx3 : "#fff",
                  cursor:
                    isSubmitting || deletePassword.length === 0
                      ? "default"
                      : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "10px 16px",
                }}
                type="button"
              >
                确认删除
              </button>
              <button
                disabled={isSubmitting}
                onClick={() => setIsConfirmingDelete(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: theme.colors.tx3,
                  cursor: "pointer",
                  fontSize: 12,
                  padding: 0,
                }}
                type="button"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              disabled={isSubmitting}
              onClick={() => setIsConfirmingDelete(true)}
              style={{
                background: "none",
                border: `1px solid ${theme.colors.red}55`,
                borderRadius: 12,
                color: theme.colors.red,
                cursor: isSubmitting ? "default" : "pointer",
                fontSize: 13,
                padding: "10px 16px",
              }}
              type="button"
            >
              不同意，并删除我的账号与全部数据
            </button>
          )}
        </div>

        <p
          style={{
            color: theme.colors.tx3,
            fontSize: 11,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          <strong>只退出登录不会停止存储</strong>
          ——你的数据仍会留在境外数据库里，直到你删除它或联系我们删除。想真正停止处理，请用上面的删除入口。
        </p>
      </section>
    </main>
  );
}

function getConsentCopy(
  consent: PendingConsentDto,
  linkColor: string,
): ConsentCopy {
  const privacyLink = (
    <a
      href="/legal/privacy.html"
      rel="noreferrer"
      style={{ color: linkColor }}
      target="_blank"
    >
      隐私政策
    </a>
  );

  if (consent.consent_type === "sensitive_health_data") {
    return {
      title: "需要你单独确认：健康数据",
      body: (
        <>
          <p style={{ margin: 0 }}>
            你的账号中保存了<strong>伤病约束、经期日期或身体测量数据</strong>
            。这些属于《个人信息保护法》定义的<strong>敏感个人信息</strong>
            ，需要取得你的单独同意才能继续处理。
          </p>
          <p style={{ margin: 0 }}>
            它们只用于训练安全提示，以及你主动使用的健康记录、趋势和日历展示。详见
            {privacyLink}。
          </p>
        </>
      ),
      confirmationCopy: (
        <>
          我同意本站处理我主动填写的健康数据，用于训练安全提示和健康记录功能。（政策版本{" "}
          {consent.policy_version}）
        </>
      ),
    };
  }

  return {
    title: "需要你确认：数据存储在境外",
    body: (
      <>
        <p style={{ margin: 0 }}>
          你的账号建于本站补齐同意流程之前。本实例把数据存储在
          <strong>中国境外的服务器</strong>
          上，这属于个人信息出境，需要你的单独同意。
        </p>
        <p style={{ margin: 0 }}>
          涉及的信息、境外接收方的名称、所在国与联系方式，以及你如何就已出境数据行使权利，都写在
          {privacyLink}第五节。
        </p>
      </>
    ),
    confirmationCopy: (
      <>
        我已阅读隐私政策，并同意本站将我的个人信息存储在中国境外的服务器上。（政策版本{" "}
        {consent.policy_version}）
      </>
    ),
  };
}

const acceptSubmitRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  height: 48,
  justifyContent: "center",
  position: "relative",
};

function acceptSubmitButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isSubmitting: boolean,
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.colors.ac,
    border: "none",
    borderRadius: isSubmitting ? 999 : 14,
    color: theme.colors.acText,
    cursor: isSubmitting ? "default" : "pointer",
    display: "flex",
    fontSize: 14,
    fontWeight: 700,
    height: 48,
    justifyContent: "center",
    opacity: 1,
    overflow: "hidden",
    padding: 0,
    transition:
      "width 0.5s cubic-bezier(0.65, 0, 0.35, 1), border-radius 0.5s cubic-bezier(0.65, 0, 0.35, 1)",
    width: isSubmitting ? 48 : "100%",
  };
}

function acceptSubmitLabelStyle(isSubmitting: boolean): React.CSSProperties {
  return {
    opacity: isSubmitting ? 0 : 1,
    transition: "opacity 0.2s ease",
    whiteSpace: "nowrap",
  };
}

function acceptSpinnerStyle(isSubmitting: boolean): React.CSSProperties {
  return {
    alignItems: "center",
    display: "flex",
    height: 48,
    justifyContent: "center",
    opacity: isSubmitting ? 1 : 0,
    pointerEvents: "none",
    position: "absolute",
    transition: "opacity 0.2s ease",
    width: 48,
  };
}

function acceptSpinnerRingStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    animation: "fmspin 0.8s linear infinite",
    border: `2px solid ${accentAlpha(theme, 0.35)}`,
    borderRadius: "50%",
    borderTopColor: theme.colors.acText,
    height: 20,
    width: 20,
  };
}
