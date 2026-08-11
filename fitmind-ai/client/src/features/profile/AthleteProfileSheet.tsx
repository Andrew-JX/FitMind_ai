import { useEffect, useState } from "react";

import { CURRENT_PRIVACY_POLICY_VERSION } from "../../../../shared/src/consent";

import { ActionSheet } from "../../components/ActionSheet";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useTheme } from "../../theme/ThemeContext";
import { accentAlpha } from "../../theme/tokens";
import {
  EQUIPMENT_OPTIONS,
  TRAINING_GOALS,
  getAthleteProfile,
  parseInjuryTags,
  saveAthleteProfile,
  withdrawInjuryConstraints,
  type Equipment,
  type TrainingGoal,
} from "./athlete-profile-api";
import { classifyInjuryWithdrawalReadback } from "./injury-withdrawal-state";

export interface AthleteProfileSheetProps {
  open: boolean;
  onClose: () => void;
  token: string | null;
  onSaved?: ((label: string) => void) | undefined;
}

const GOAL_LABEL: Record<TrainingGoal, string> = {
  strength: "力量",
  hypertrophy: "增肌",
  endurance: "耐力",
  general_fitness: "综合健身",
};

const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: "杠铃",
  dumbbell: "哑铃",
  machine: "器械",
  cable: "绳索",
  bodyweight: "自重",
  kettlebell: "壶铃",
};

const WEEKLY_DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const DEFAULT_GOAL: TrainingGoal = "hypertrophy";
const DEFAULT_WEEKLY_DAYS = 3;

/**
 * Athlete profile editor opened from the header. Loads the saved profile on
 * open and upserts goal / weekly days / equipment / injury constraints.
 *
 * @param props - Open state, close handler, token, and saved callback
 * @returns The profile editing sheet
 */
export function AthleteProfileSheet(props: AthleteProfileSheetProps) {
  const { theme } = useTheme();
  const [goal, setGoal] = useState<TrainingGoal>(DEFAULT_GOAL);
  const [weeklyDays, setWeeklyDays] = useState<number>(DEFAULT_WEEKLY_DAYS);
  const [equipment, setEquipment] = useState<Set<Equipment>>(() => new Set());
  const [injuryText, setInjuryText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Whether the server already holds art. 29 consent for this user. Starts
  // true so the checkbox does not flash in before the profile loads.
  const [hasStoredHealthConsent, setHasStoredHealthConsent] = useState(true);
  const [acceptedHealthConsent, setAcceptedHealthConsent] = useState(false);
  // What the server actually holds, as opposed to what is currently typed in
  // the box. Withdrawal is about stored data, so a draft edit must not make the
  // control appear or disappear.
  const [storedInjuryCount, setStoredInjuryCount] = useState(0);
  // Starts false, unlike `hasStoredHealthConsent`: an optimistic default here
  // would flash a withdrawal control at users who have nothing to withdraw,
  // which is the worse of the two wrong first frames.
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [isConfirmingWithdraw, setIsConfirmingWithdraw] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const injuryTags = parseInjuryTags(injuryText);
  const hasInjuryTags = injuryTags.length > 0;
  const needsHealthConsent = hasInjuryTags && !hasStoredHealthConsent;
  // This control owns only the injury field. Other health records have their
  // own deletion controls, so a consent kept alive by body/menstrual data must
  // not make an empty injury form advertise a destructive action it cannot do.
  const canWithdrawHealthData = isProfileLoaded && storedInjuryCount > 0;

  useEffect(() => {
    if (!props.open || !props.token) {
      return;
    }

    let isActive = true;
    setError(null);
    setIsLoading(true);
    setIsConfirmingWithdraw(false);

    void getAthleteProfile(props.token)
      .then((state) => {
        if (!isActive) {
          return;
        }

        setHasStoredHealthConsent(state.healthConsentOnFile);
        setStoredInjuryCount(state.profile?.injuryConstraints.length ?? 0);
        setIsProfileLoaded(true);

        if (!state.profile) {
          return;
        }

        setGoal(state.profile.goal);
        setWeeklyDays(state.profile.weeklyDays);
        setEquipment(new Set(state.profile.availableEquipment));
        setInjuryText(state.profile.injuryConstraints.join("、"));
      })
      .catch(() => {
        if (isActive) {
          setError("加载档案失败，可稍后重试。");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [props.open, props.token]);

  function toggleEquipment(item: Equipment): void {
    setEquipment((current) => {
      const next = new Set(current);
      if (next.has(item)) {
        next.delete(item);
      } else {
        next.add(item);
      }
      return next;
    });
  }

  async function handleSave(): Promise<void> {
    if (!props.token) {
      return;
    }

    if (needsHealthConsent && !acceptedHealthConsent) {
      setError(
        "伤病信息属于敏感个人信息，请先勾选同意，或清空伤病约束后保存。",
      );
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await saveAthleteProfile(props.token, {
        goal,
        weeklyDays,
        availableEquipment: [...equipment],
        injuryConstraints: injuryTags,
        sensitiveHealthConsent: needsHealthConsent
          ? { accepted: true, policy_version: CURRENT_PRIVACY_POLICY_VERSION }
          : undefined,
      });
      props.onSaved?.("训练档案已保存。");
      props.onClose();
    } catch {
      setError("保存失败，请稍后再试。");
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Reset only the injury-related state to its withdrawn values.
   *
   * @remarks
   * Goal, weekly days and equipment keep any edits in progress, and nothing
   * here touches training history or the account: withdrawing one category
   * must not cost the user everything else.
   *
   * Shared by the ordinary success path and the "committed but the response
   * was lost" path, so the two cannot end up leaving the form in different
   * states after the same thing happened on the server.
   */
  function applyWithdrawnState(flags?: { healthConsentOnFile: boolean }): void {
    setInjuryText("");
    setStoredInjuryCount(0);
    setHasStoredHealthConsent(flags?.healthConsentOnFile ?? false);
    setAcceptedHealthConsent(false);
    setIsConfirmingWithdraw(false);
  }

  /**
   * Withdraw the stored injury data and the consent that covered it.
   *
   * @returns Resolves once the sheet reflects what the server actually holds
   *
   * @remarks
   * Deliberately not a substitute for the server rule: clearing the box by hand
   * and pressing Save revokes the consent too (fitmind-lmy). This button exists
   * because a right the user cannot find is not a right they have — the only
   * entry point used to be the catch-up screen, which an account with its
   * consents settled never sees.
   */
  async function handleWithdraw(): Promise<void> {
    setIsWithdrawing(true);
    setError(null);

    try {
      const result = await withdrawInjuryConstraints(props.token);
      applyWithdrawnState({
        healthConsentOnFile: result.health_consent_on_file,
      });
      props.onSaved?.("伤病信息已删除；其他健康数据不受影响。");
    } catch {
      // "Your data was not changed" is not something this catch block knows.
      // The transaction is atomic, so a *refusal* means nothing moved — but a
      // request can also fail after the server committed: a dropped connection,
      // a timeout, a proxy giving up on the response. Those land here too, and
      // in them the withdrawal succeeded and the reassurance would be a lie
      // about the one thing the user most needs to be true.
      //
      // So ask the server what actually happened rather than inferring it.
      try {
        const state = await getAthleteProfile(props.token);
        const readback = classifyInjuryWithdrawalReadback(state);

        if (readback.kind === "withdrawn") {
          // The write landed; only the response was lost.
          applyWithdrawnState({
            healthConsentOnFile: readback.healthConsentOnFile,
          });
          props.onSaved?.("伤病信息已删除；其他健康数据不受影响。");
          return;
        }

        setStoredInjuryCount(readback.storedInjuryCount);
        setHasStoredHealthConsent(readback.healthConsentOnFile);
        // A snapshot of now, stated as a snapshot of now. "Your data was not
        // changed" is a claim about history, and this read cannot support it:
        // the withdrawal may have committed and another session may have saved
        // injury data again afterwards. What the read does establish is that
        // the data is there at this moment, so the withdrawal is not done.
        setError("当前仍检测到伤病信息，删除尚未完成，请重试。");
      } catch {
        // Two failures in a row: the honest answer is that we do not know.
        setError("撤回结果暂时无法确认，请稍后重新打开档案查看。");
      }
    } finally {
      setIsWithdrawing(false);
    }
  }

  return (
    <ActionSheet
      description="档案会注入下周计划：目标决定次数/强度，伤病/每周天数加保守提示。"
      footer={
        <div style={footerRowStyle}>
          <Button onClick={props.onClose} type="button" variant="secondary">
            取消
          </Button>
          <Button
            disabled={isSaving || isLoading}
            onClick={() => void handleSave()}
            style={{ flex: 2 }}
            type="button"
          >
            {isSaving ? "保存中…" : "保存档案"}
          </Button>
        </div>
      }
      onClose={props.onClose}
      open={props.open}
      title="训练档案"
    >
      <label style={fieldStyle}>
        <span style={labelStyle(theme)}>训练目标</span>
        <select
          onChange={(event) => {
            const next = TRAINING_GOALS.find(
              (item) => item === event.target.value,
            );
            if (next) {
              setGoal(next);
            }
          }}
          style={selectStyle(theme)}
          value={goal}
        >
          {TRAINING_GOALS.map((item) => (
            <option key={item} value={item}>
              {GOAL_LABEL[item]}
            </option>
          ))}
        </select>
      </label>

      <label style={fieldStyle}>
        <span style={labelStyle(theme)}>每周训练天数</span>
        <select
          onChange={(event) => setWeeklyDays(Number(event.target.value))}
          style={selectStyle(theme)}
          value={weeklyDays}
        >
          {WEEKLY_DAYS_OPTIONS.map((day) => (
            <option key={day} value={day}>
              {day} 天
            </option>
          ))}
        </select>
      </label>

      <div style={fieldStyle}>
        <span style={labelStyle(theme)}>可用器械</span>
        <div style={chipRowStyle}>
          {EQUIPMENT_OPTIONS.map((item) => {
            const active = equipment.has(item);
            return (
              <button
                key={item}
                onClick={() => toggleEquipment(item)}
                style={chipStyle(theme, active)}
                type="button"
              >
                {EQUIPMENT_LABEL[item]}
              </button>
            );
          })}
        </div>
      </div>

      <label style={fieldStyle}>
        <span style={labelStyle(theme)}>伤病约束（可选）</span>
        <Input
          onChange={(event) => setInjuryText(event.target.value)}
          placeholder="用逗号分隔，如：膝盖, 肩"
          value={injuryText}
        />
      </label>

      {/* Asked here, at the moment the field is actually filled in, rather than
          bundled into the sign-up form. Injury data is sensitive personal
          information under PIPL art. 28, and art. 29 wants consent for the
          handling that is really happening — at registration there is no health
          data yet, so agreeing then would be agreeing to a hypothetical.

          Appears only when there is something to consent to, and disappears
          once the consent is on file, so it is not a checkbox users learn to
          tick past. */}
      {needsHealthConsent ? (
        <label style={healthConsentStyle(theme)}>
          <input
            checked={acceptedHealthConsent}
            onChange={(event) => setAcceptedHealthConsent(event.target.checked)}
            style={{ marginTop: 3 }}
            type="checkbox"
          />
          <span>
            伤病信息属于<strong>敏感个人信息</strong>
            。我同意本站存储并使用它，用于在训练计划中规避相关动作；用途仅此一项，详见
            <a
              href="/legal/privacy.html"
              rel="noreferrer"
              style={{ color: theme.colors.ac }}
              target="_blank"
            >
              隐私政策
            </a>
            。不填写伤病约束不影响其他功能。（政策版本{" "}
            {CURRENT_PRIVACY_POLICY_VERSION}）
          </span>
        </label>
      ) : null}

      {/* PIPL art. 15: withdrawal has to be as easy to reach as consent was.
          Kept visually quiet but plainly worded — it is a normal setting, not a
          danger zone, and dressing it up as one discourages people from using a
          right they have. The two-step confirm is there because the action is
          not undoable, not because it is discouraged. */}
      {canWithdrawHealthData ? (
        <div style={withdrawBlockStyle(theme)}>
          <span>
            <strong>删除伤病信息</strong>
            ：删除已存储的伤病约束。训练记录、身体数据、经期记录、其余档案设置与账号都不受影响；如果已无其他健康数据，相关同意也会一并撤回。
          </span>
          {isConfirmingWithdraw ? (
            <div style={withdrawActionRowStyle}>
              <Button
                disabled={isWithdrawing}
                onClick={() => setIsConfirmingWithdraw(false)}
                type="button"
                variant="secondary"
              >
                取消
              </Button>
              <Button
                disabled={isWithdrawing}
                onClick={() => void handleWithdraw()}
                type="button"
              >
                {isWithdrawing ? "删除中…" : "确认删除"}
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setIsConfirmingWithdraw(true)}
              style={withdrawTriggerStyle(theme)}
              type="button"
            >
              删除伤病信息
            </button>
          )}
        </div>
      ) : null}

      {error ? <p style={errorStyle(theme)}>{error}</p> : null}
    </ActionSheet>
  );
}

function withdrawBlockStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    color: theme.colors.tx2,
    display: "grid",
    fontSize: 12,
    gap: 10,
    lineHeight: 1.6,
    padding: "10px 12px",
  };
}

const withdrawActionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
};

function withdrawTriggerStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: "transparent",
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    justifySelf: "start",
    padding: "6px 12px",
  };
}

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

function healthConsentStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "flex-start",
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    color: theme.colors.tx2,
    display: "flex",
    fontSize: 12,
    gap: 8,
    lineHeight: 1.6,
    padding: "10px 12px",
  };
}

function labelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    fontWeight: 500,
  };
}

function selectStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx,
    fontSize: 14,
    padding: "10px 12px",
    width: "100%",
  };
}

const chipRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

function chipStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  active: boolean,
): React.CSSProperties {
  return {
    backgroundColor: active
      ? accentAlpha(theme, theme.isDark ? 0.18 : 0.12)
      : theme.colors.surf2,
    border: `1px solid ${active ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: theme.radius.pill,
    color: active ? theme.colors.ac : theme.colors.tx2,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 12px",
  };
}

const footerRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
};

function errorStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.red,
    fontSize: 12,
    margin: 0,
  };
}
