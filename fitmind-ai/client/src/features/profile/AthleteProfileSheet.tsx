import { useEffect, useState } from "react";

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
  type Equipment,
  type TrainingGoal,
} from "./athlete-profile-api";

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

  useEffect(() => {
    if (!props.open || !props.token) {
      return;
    }

    let isActive = true;
    setError(null);
    setIsLoading(true);

    void getAthleteProfile(props.token)
      .then((profile) => {
        if (!isActive || !profile) {
          return;
        }

        setGoal(profile.goal);
        setWeeklyDays(profile.weeklyDays);
        setEquipment(new Set(profile.availableEquipment));
        setInjuryText(profile.injuryConstraints.join("、"));
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

    setIsSaving(true);
    setError(null);

    try {
      await saveAthleteProfile(props.token, {
        goal,
        weeklyDays,
        availableEquipment: [...equipment],
        injuryConstraints: parseInjuryTags(injuryText),
      });
      props.onSaved?.("训练档案已保存。");
      props.onClose();
    } catch {
      setError("保存失败，请稍后再试。");
    } finally {
      setIsSaving(false);
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

      {error ? <p style={errorStyle(theme)}>{error}</p> : null}
    </ActionSheet>
  );
}

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

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
