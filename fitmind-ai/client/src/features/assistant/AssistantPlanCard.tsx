import { useState } from "react";

import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeContext";
import {
  deletePlanExercise,
  getEditablePlanSessions,
  replacePlanExercise,
  updatePlanExercise,
} from "./assistant-plan-editor";
import type {
  AssistantPlanDraft,
  AssistantPlanStrategy,
  AssistantPlannedExercise,
} from "./assistant-types";

export interface AssistantPlanCardProps {
  plan: AssistantPlanDraft;
  onAccept?: ((plan: AssistantPlanDraft) => void) | undefined;
  isAccepting?: boolean | undefined;
  isAccepted?: boolean | undefined;
}

const STRATEGY_LABEL: Record<AssistantPlanStrategy, string> = {
  consolidate: "巩固 / 控制疲劳",
  add_frequency: "可小幅加量",
  maintain: "维持基线",
};

/** Editable deterministic weekly plan grouped by flexible training days. */
export function AssistantPlanCard(props: AssistantPlanCardProps) {
  const { theme } = useTheme();
  const [editedPlan, setEditedPlan] = useState(props.plan);
  const sessions = getEditablePlanSessions(editedPlan);
  const disabled = Boolean(props.isAccepting || props.isAccepted);

  if (editedPlan.exercises.length === 0) return null;

  return (
    <details open style={containerStyle(theme)}>
      <summary style={summaryStyle(theme)}>
        <Icon name="zap" size={13} />
        <span>
          下周训练草案 · {sessions.length} 天 / {editedPlan.exercises.length}{" "}
          个动作
        </span>
        <span style={strategyChipStyle(theme)}>
          {STRATEGY_LABEL[editedPlan.strategy]}
        </span>
      </summary>

      <p style={editorHintStyle(theme)}>
        训练日不绑定星期。你可以先改动作、组次和休息，再设为本周计划。
      </p>

      <div style={sessionListStyle}>
        {sessions.map((session) => (
          <section key={session.sessionIndex} style={sessionStyle(theme)}>
            <div style={sessionHeaderStyle}>
              <strong>{session.title}</strong>
              <span style={sessionMetaStyle(theme)}>
                约 {session.estimatedDurationMinutes} 分钟
                {session.focusAreas.length > 0
                  ? ` · ${session.focusAreas.join(" / ")}`
                  : ""}
              </span>
            </div>

            <div style={exerciseListStyle}>
              {session.exercises.map((exercise, exerciseIndex) => (
                <PlanExerciseEditor
                  disabled={disabled}
                  exercise={exercise}
                  key={`${exercise.exerciseName}-${exerciseIndex}`}
                  onDelete={() =>
                    setEditedPlan((current) =>
                      deletePlanExercise(
                        current,
                        session.sessionIndex,
                        exerciseIndex,
                      ),
                    )
                  }
                  onReplace={(alternativeIndex) => {
                    const alternative =
                      exercise.alternatives?.[alternativeIndex];
                    if (!alternative) return;
                    setEditedPlan((current) =>
                      replacePlanExercise(
                        current,
                        session.sessionIndex,
                        exerciseIndex,
                        alternative,
                      ),
                    );
                  }}
                  onUpdate={(patch) =>
                    setEditedPlan((current) =>
                      updatePlanExercise(
                        current,
                        session.sessionIndex,
                        exerciseIndex,
                        patch,
                      ),
                    )
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {editedPlan.notes.length > 0 ? (
        <details style={notesStyle(theme)}>
          <summary>查看生成依据与安全提示</summary>
          <ul>
            {editedPlan.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {props.onAccept ? (
        <button
          disabled={disabled || editedPlan.exercises.length === 0}
          onClick={() => props.onAccept?.(editedPlan)}
          style={acceptButtonStyle(theme, props.isAccepted ?? false)}
          type="button"
        >
          {props.isAccepted
            ? "已设为本周计划"
            : props.isAccepting
              ? "接受中…"
              : "设为本周计划"}
        </button>
      ) : null}
    </details>
  );
}

function PlanExerciseEditor(props: {
  disabled: boolean;
  exercise: AssistantPlannedExercise;
  onDelete: () => void;
  onReplace: (alternativeIndex: number) => void;
  onUpdate: (
    patch: Partial<
      Pick<
        AssistantPlannedExercise,
        "sets" | "repMin" | "repMax" | "restSeconds"
      >
    >,
  ) => void;
}) {
  const { theme } = useTheme();
  const exercise = props.exercise;

  return (
    <article style={exerciseStyle(theme)}>
      <div style={exerciseHeaderStyle}>
        <div>
          <strong style={exerciseNameStyle(theme)}>
            {exercise.exerciseName}
          </strong>
          <div style={exerciseMetaStyle(theme)}>
            {exercise.equipment ?? "未标器械"} ·{" "}
            {exercise.targetWeightKg !== null
              ? `目标 ${exercise.targetWeightKg} kg`
              : "沿用上次重量"}
          </div>
        </div>
        <button
          disabled={props.disabled}
          onClick={props.onDelete}
          style={deleteButtonStyle(theme)}
          type="button"
        >
          删除
        </button>
      </div>

      <div style={fieldGridStyle}>
        <NumberField
          disabled={props.disabled}
          label="组"
          max={8}
          min={1}
          onChange={(sets) => props.onUpdate({ sets })}
          value={exercise.sets}
        />
        <NumberField
          disabled={props.disabled}
          label="最低次数"
          max={30}
          min={1}
          onChange={(repMin) => props.onUpdate({ repMin })}
          value={exercise.repMin}
        />
        <NumberField
          disabled={props.disabled}
          label="最高次数"
          max={30}
          min={1}
          onChange={(repMax) => props.onUpdate({ repMax })}
          value={exercise.repMax}
        />
        <label style={miniFieldStyle(theme)}>
          <span>休息</span>
          <select
            disabled={props.disabled}
            onChange={(event) =>
              props.onUpdate({ restSeconds: Number(event.target.value) })
            }
            style={controlStyle(theme)}
            value={exercise.restSeconds ?? 90}
          >
            {[60, 75, 90, 120, 150, 180].map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds} 秒
              </option>
            ))}
          </select>
        </label>
      </div>

      {(exercise.alternatives?.length ?? 0) > 0 ? (
        <label style={replaceFieldStyle(theme)}>
          <span>换动作</span>
          <select
            defaultValue=""
            disabled={props.disabled}
            onChange={(event) => {
              if (event.target.value !== "")
                props.onReplace(Number(event.target.value));
            }}
            style={controlStyle(theme)}
          >
            <option value="">选择同模式 / 同肌群替代动作</option>
            {exercise.alternatives?.map((alternative, index) => (
              <option key={alternative.exerciseId} value={index}>
                {alternative.exerciseName} · {alternative.equipment ?? "无器械"}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <p style={basisStyle(theme)}>{exercise.basis}</p>
    </article>
  );
}

function NumberField(props: {
  disabled: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  const { theme } = useTheme();
  return (
    <label style={miniFieldStyle(theme)}>
      <span>{props.label}</span>
      <input
        disabled={props.disabled}
        max={props.max}
        min={props.min}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (
            Number.isInteger(value) &&
            value >= props.min &&
            value <= props.max
          ) {
            props.onChange(value);
          }
        }}
        style={controlStyle(theme)}
        type="number"
        value={props.value}
      />
    </label>
  );
}

function containerStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    marginTop: 12,
    padding: "11px 12px",
  };
}
function summaryStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    color: theme.colors.tx,
    cursor: "pointer",
    display: "flex",
    flexWrap: "wrap",
    fontSize: 12,
    fontWeight: 800,
    gap: 8,
  };
}
function strategyChipStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.pill,
    color: theme.colors.tx2,
    fontSize: 10,
    padding: "2px 8px",
  };
}
function editorHintStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    lineHeight: 1.5,
    margin: "10px 0",
  };
}
const sessionListStyle: React.CSSProperties = { display: "grid", gap: 10 };
function sessionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    overflow: "hidden",
  };
}
const sessionHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  padding: "10px 11px",
};
function sessionMetaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx3, fontSize: 10, textAlign: "right" };
}
const exerciseListStyle: React.CSSProperties = { display: "grid", gap: 1 };
function exerciseStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    borderTop: `1px solid ${theme.colors.bdr}`,
    display: "grid",
    gap: 9,
    padding: "11px",
  };
}
const exerciseHeaderStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
};
function exerciseNameStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx, fontSize: 13 };
}
function exerciseMetaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx3, fontSize: 10, marginTop: 3 };
}
const fieldGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
};
function miniFieldStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx3, display: "grid", fontSize: 9, gap: 3 };
}
function replaceFieldStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, display: "grid", fontSize: 10, gap: 4 };
}
function controlStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 7,
    color: theme.colors.tx,
    fontSize: 10,
    minWidth: 0,
    padding: "6px",
  };
}
function deleteButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 7,
    color: theme.colors.red,
    cursor: "pointer",
    fontSize: 10,
    padding: "4px 7px",
  };
}
function basisStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx3, fontSize: 10, lineHeight: 1.5, margin: 0 };
}
function notesStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 10,
    lineHeight: 1.5,
    marginTop: 10,
  };
}
function acceptButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  accepted: boolean,
): React.CSSProperties {
  return {
    backgroundColor: accepted ? theme.colors.surf3 : theme.colors.ac,
    border: "none",
    borderRadius: theme.radius.control,
    color: accepted ? theme.colors.tx2 : theme.colors.acText,
    cursor: accepted ? "default" : "pointer",
    fontSize: 13,
    fontWeight: 700,
    marginTop: 12,
    padding: "11px 14px",
    width: "100%",
  };
}
