import { useEffect, useRef, useState } from "react";

import { Card } from "../../components/Card";
import { useTheme } from "../../theme/ThemeContext";
import {
  EQUIPMENT_OPTIONS,
  getAthleteProfile,
  type AthleteProfile,
} from "../profile/athlete-profile-api";
import type {
  AssistantPlanEquipment,
  AssistantPlanFocusArea,
  AssistantPlanPreferencesWire,
} from "./assistant-types";

interface WeeklyPlanSetupProps {
  disabled: boolean;
  onChange: (preferences: AssistantPlanPreferencesWire) => void;
  token: string | null;
  value: AssistantPlanPreferencesWire;
}

const DURATION_OPTIONS = [30, 45, 60, 75, 90] as const;
const FOCUS_OPTIONS: Array<{ value: AssistantPlanFocusArea; label: string }> = [
  { value: "chest", label: "胸" },
  { value: "back", label: "背" },
  { value: "shoulders", label: "肩" },
  { value: "arms", label: "手臂" },
  { value: "legs", label: "腿" },
  { value: "glutes", label: "臀" },
  { value: "core", label: "核心" },
];
const EQUIPMENT_LABEL: Record<AssistantPlanEquipment, string> = {
  barbell: "杠铃",
  dumbbell: "哑铃",
  machine: "固定器械",
  cable: "绳索",
  bodyweight: "自重",
  kettlebell: "壶铃",
};
const GOAL_LABEL: Record<AthleteProfile["goal"], string> = {
  strength: "力量",
  hypertrophy: "增肌",
  endurance: "耐力",
  general_fitness: "综合健身",
};

/** One-page preflight: permanent profile is shown, only this week's overrides are edited. */
export function WeeklyPlanSetup(props: WeeklyPlanSetupProps) {
  const { disabled, onChange, token, value } = props;
  const { theme } = useTheme();
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const initializedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    void getAthleteProfile(token)
      .then((state) => {
        if (cancelled) return;
        setProfile(state.profile);
        setLoadState("ready");

        if (state.profile && initializedTokenRef.current !== token) {
          initializedTokenRef.current = token;
          onChange({
            weekly_days: state.profile.weeklyDays,
            session_duration_minutes: 60,
            available_equipment:
              state.profile.availableEquipment.length > 0
                ? state.profile.availableEquipment
                : ["bodyweight"],
            readiness: "ready",
            focus_areas: [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token, onChange]);

  const equipment = value.available_equipment ?? ["bodyweight"];
  const focusAreas = value.focus_areas ?? [];

  function toggleEquipment(item: AssistantPlanEquipment) {
    const next = equipment.includes(item)
      ? equipment.filter((value) => value !== item)
      : [...equipment, item];
    if (next.length > 0) onChange({ ...value, available_equipment: next });
  }

  function toggleFocus(item: AssistantPlanFocusArea) {
    const next = focusAreas.includes(item)
      ? focusAreas.filter((value) => value !== item)
      : focusAreas.length < 3
        ? [...focusAreas, item]
        : focusAreas;
    onChange({ ...value, focus_areas: next });
  }

  return (
    <Card>
      <div style={bodyStyle}>
        <div>
          <h3 style={titleStyle}>本周计划设置</h3>
          <p style={copyStyle(theme)}>
            档案自动带入，这里的修改只影响本次生成，不会覆盖长期设置。
          </p>
        </div>

        <div style={profileSummaryStyle(theme)}>
          {token && loadState === "loading" ? (
            <span>正在读取训练档案…</span>
          ) : loadState === "error" ? (
            <span>档案暂时读取失败，将使用本次设置继续生成。</span>
          ) : profile ? (
            <>
              <span>目标：{GOAL_LABEL[profile.goal]}</span>
              <span>
                已记录伤病：
                {profile.injuryConstraints.length > 0
                  ? profile.injuryConstraints.join("、")
                  : "无"}
              </span>
            </>
          ) : (
            <span>还没有训练档案，将使用保守默认值。</span>
          )}
        </div>

        <Field label="本周训练天数">
          <div style={chipRowStyle}>
            {[2, 3, 4, 5, 6].map((day) => (
              <ChoiceButton
                active={value.weekly_days === day}
                disabled={disabled}
                key={day}
                label={`${day} 天`}
                onClick={() => onChange({ ...value, weekly_days: day })}
              />
            ))}
          </div>
        </Field>

        <Field label="单次可用时间">
          <div style={chipRowStyle}>
            {DURATION_OPTIONS.map((minutes) => (
              <ChoiceButton
                active={value.session_duration_minutes === minutes}
                disabled={disabled}
                key={minutes}
                label={`${minutes} 分`}
                onClick={() =>
                  onChange({
                    ...value,
                    session_duration_minutes: minutes,
                  })
                }
              />
            ))}
          </div>
        </Field>

        <Field label="本周可用器械">
          <div style={chipRowStyle}>
            {EQUIPMENT_OPTIONS.map((item) => (
              <ChoiceButton
                active={equipment.includes(item)}
                disabled={disabled}
                key={item}
                label={EQUIPMENT_LABEL[item]}
                onClick={() => toggleEquipment(item)}
              />
            ))}
          </div>
        </Field>

        <Field label="本周状态">
          <div style={chipRowStyle}>
            <ChoiceButton
              active={(value.readiness ?? "ready") === "ready"}
              disabled={disabled}
              label="状态正常"
              onClick={() => onChange({ ...value, readiness: "ready" })}
            />
            <ChoiceButton
              active={value.readiness === "fatigued"}
              disabled={disabled}
              label="有点疲劳"
              onClick={() => onChange({ ...value, readiness: "fatigued" })}
            />
          </div>
        </Field>

        <Field label="本周重点（最多 3 个，可不选）">
          <div style={chipRowStyle}>
            {FOCUS_OPTIONS.map((item) => (
              <ChoiceButton
                active={focusAreas.includes(item.value)}
                disabled={disabled}
                key={item.value}
                label={item.label}
                onClick={() => toggleFocus(item.value)}
              />
            ))}
          </div>
        </Field>
      </div>
    </Card>
  );
}

function Field(props: { children: React.ReactNode; label: string }) {
  const { theme } = useTheme();
  return (
    <div style={fieldStyle}>
      <strong style={labelStyle(theme)}>{props.label}</strong>
      {props.children}
    </div>
  );
}

function ChoiceButton(props: {
  active: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  const { theme } = useTheme();
  return (
    <button
      disabled={props.disabled}
      onClick={props.onClick}
      style={choiceStyle(theme, props.active, props.disabled)}
      type="button"
    >
      {props.label}
    </button>
  );
}

const bodyStyle: React.CSSProperties = { display: "grid", gap: 14 };
const titleStyle: React.CSSProperties = { fontSize: 16, margin: 0 };
const fieldStyle: React.CSSProperties = { display: "grid", gap: 7 };
const chipRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 7,
};

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    lineHeight: 1.6,
    margin: "4px 0 0",
  };
}

function profileSummaryStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 10,
    color: theme.colors.tx2,
    display: "flex",
    flexWrap: "wrap",
    fontSize: 11,
    gap: "6px 14px",
    padding: "9px 11px",
  };
}

function labelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 12 };
}

function choiceStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  active: boolean,
  disabled: boolean,
): React.CSSProperties {
  return {
    backgroundColor: active ? theme.colors.ac : theme.colors.surf2,
    border: `1px solid ${active ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: theme.radius.pill,
    color: active ? theme.colors.acText : theme.colors.tx2,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 11,
    fontWeight: 700,
    opacity: disabled ? 0.55 : 1,
    padding: "7px 11px",
  };
}
