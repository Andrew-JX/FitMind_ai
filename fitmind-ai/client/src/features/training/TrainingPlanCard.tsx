import { useState } from "react";

import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeContext";
import type { UseCurrentPlanResult } from "../assistant/use-current-plan";
import { accentAlpha } from "../../theme/tokens";

export interface TrainingPlanCardProps {
  currentPlan: UseCurrentPlanResult;
  onOpenAssistant: () => void;
}

type CurrentPlanSnapshot = NonNullable<UseCurrentPlanResult["plan"]>["plan"];

/**
 * Compact neon weekly-plan card for the training tab (design Screens §2).
 *
 * Renders nothing until a plan exists, so the training tab stays clean for
 * users without an active plan. The detailed planned-vs-performed adherence
 * list stays on the assistant tab; here we show the range, headline adherence,
 * an abandon action, and a shortcut into the assistant.
 *
 * @param props - Auth token and a callback to switch to the assistant tab
 * @returns The plan card, or null when there is no active plan
 */
export function TrainingPlanCard(props: TrainingPlanCardProps) {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const { plan, isMutating, actionError, abandon } = props.currentPlan;

  if (!plan) {
    return null;
  }

  const adherence = plan.adherence ?? EMPTY_PLAN_ADHERENCE;
  const exercisePct = Math.round(adherence.exercise_adherence_ratio * 100);
  const setPct = Math.round(adherence.set_adherence_ratio * 100);

  return (
    <section style={cardStyle(theme)}>
      <div style={headerStyle}>
        <strong style={titleStyle(theme)}>
          <Icon name="zap" size={13} /> 本周计划
        </strong>
        <button
          disabled={isMutating}
          onClick={abandon}
          style={abandonStyle(theme, isMutating)}
          type="button"
        >
          放弃计划
        </button>
      </div>

      <p style={rangeStyle(theme)}>
        {plan.startDate} ~ {plan.endDate} · 动作{" "}
        {adherence.trained_exercise_count}/{adherence.planned_exercise_count}{" "}
        已练 · 组数依从 {setPct}%
      </p>

      <div style={trackStyle(theme)}>
        <div style={fillStyle(theme, exercisePct)} />
      </div>

      <button
        onClick={() => setIsExpanded((currentValue) => !currentValue)}
        style={detailsToggleStyle(theme)}
        type="button"
      >
        {isExpanded ? "收起本周计划" : "展开查看本周计划"}
      </button>

      {isExpanded ? <PlanDetails plan={plan.plan} /> : null}

      <button
        onClick={props.onOpenAssistant}
        style={ctaStyle(theme)}
        type="button"
      >
        和教练聊聊今天的安排
      </button>

      {actionError ? <p style={errorStyle(theme)}>{actionError}</p> : null}
    </section>
  );
}

function PlanDetails(props: { plan: CurrentPlanSnapshot }) {
  const { theme } = useTheme();
  const sessions = props.plan.sessions;

  if (sessions && sessions.length > 0) {
    return (
      <div style={sessionListStyle}>
        {sessions.map((session) => (
          <section key={session.session_index} style={sessionStyle(theme)}>
            <div style={sessionHeaderStyle}>
              <strong>{session.title}</strong>
              <span style={sessionMetaStyle(theme)}>
                约 {session.estimated_duration_minutes} 分钟
              </span>
            </div>
            <PlanExerciseList exercises={session.exercises} />
          </section>
        ))}
      </div>
    );
  }

  return <PlanExerciseList exercises={props.plan.exercises} />;
}

function PlanExerciseList(props: {
  exercises: CurrentPlanSnapshot["exercises"];
}) {
  const { theme } = useTheme();

  return (
    <ol style={exerciseListStyle}>
      {props.exercises.map((exercise) => (
        <li key={exercise.exercise_name} style={exerciseRowStyle(theme)}>
          <span>{exercise.exercise_name}</span>
          <span style={exerciseMetaStyle(theme)}>
            {exercise.sets} 组 ×{" "}
            {formatRepRange(exercise.rep_min, exercise.rep_max)}
            {exercise.rest_seconds ? ` · 休息 ${exercise.rest_seconds} 秒` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}

function formatRepRange(min: number, max: number): string {
  return min === max ? `${min} 次` : `${min}-${max} 次`;
}

const EMPTY_PLAN_ADHERENCE = {
  planned_exercise_count: 0,
  trained_exercise_count: 0,
  extra_exercise_count: 0,
  exercise_adherence_ratio: 0,
  set_adherence_ratio: 0,
  exercises: [],
} as const;

function cardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: `linear-gradient(180deg, ${accentAlpha(theme, 0.1)}, ${accentAlpha(theme, 0.04)}), ${theme.colors.surf}`,
    border: `1px solid ${accentAlpha(theme, 0.3)}`,
    borderRadius: theme.radius.card,
    boxShadow: `inset 0 1px 0 ${accentAlpha(theme, 0.12)}, 0 10px 24px ${theme.colors.sh25}`,
    display: "grid",
    gap: 8,
    padding: 16,
  };
}

const headerStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
};

function titleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    color: theme.colors.ac,
    display: "inline-flex",
    fontSize: 14,
    fontWeight: 800,
    gap: 6,
    letterSpacing: "-0.1px",
  };
}

function abandonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  disabled: boolean,
): React.CSSProperties {
  return {
    background: theme.colors.divider,
    border: "none",
    borderRadius: 10,
    color: theme.colors.tx2,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 11,
    fontWeight: 700,
    opacity: disabled ? 0.5 : 1,
    padding: "6px 11px",
  };
}

function rangeStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
  };
}

function trackStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.divider,
    borderRadius: 999,
    height: 5,
    overflow: "hidden",
  };
}

function fillStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  percent: number,
): React.CSSProperties {
  return {
    background: theme.colors.ac,
    height: "100%",
    transition: "width 0.3s ease",
    width: `${Math.max(0, Math.min(percent, 100))}%`,
  };
}

function ctaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${theme.colors.accDim}`,
    borderRadius: 10,
    color: theme.colors.ac,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    justifySelf: "start",
    padding: "8px 10px",
  };
}

function detailsToggleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 10,
    color: theme.colors.ac,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    justifySelf: "start",
    padding: "8px 10px",
  };
}

const sessionListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

function sessionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 10,
    overflow: "hidden",
  };
}

const sessionHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
  padding: "9px 11px",
};

function sessionMetaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
  };
}

const exerciseListStyle: React.CSSProperties = {
  display: "grid",
  gap: 1,
  listStylePosition: "inside",
  margin: 0,
  padding: 0,
};

function exerciseRowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.colors.soft,
    color: theme.colors.tx,
    display: "flex",
    fontSize: 12,
    gap: 8,
    justifyContent: "space-between",
    padding: "9px 11px",
  };
}

function exerciseMetaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    flex: "0 0 auto",
    fontSize: 11,
    textAlign: "right",
  };
}

function errorStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.red,
    fontSize: 12,
    margin: 0,
  };
}
