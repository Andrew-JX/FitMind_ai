import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeContext";
import type { UseCurrentPlanResult } from "../assistant/use-current-plan";

export interface TrainingPlanCardProps {
  currentPlan: UseCurrentPlanResult;
  onOpenAssistant: () => void;
}

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
  const { plan, isMutating, actionError, abandon } = props.currentPlan;

  if (!plan) {
    return null;
  }

  const exercisePct = Math.round(plan.adherence.exercise_adherence_ratio * 100);
  const setPct = Math.round(plan.adherence.set_adherence_ratio * 100);

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
        {plan.adherence.trained_exercise_count}/
        {plan.adherence.planned_exercise_count} 已练 · 组数依从 {setPct}%
      </p>

      <div style={trackStyle(theme)}>
        <div style={fillStyle(theme, exercisePct)} />
      </div>

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

function cardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: `linear-gradient(180deg, rgba(200,240,53,0.10), rgba(200,240,53,0.04)), ${theme.colors.surf}`,
    border: "1px solid rgba(200,240,53,0.30)",
    borderRadius: theme.radius.card,
    boxShadow: `inset 0 1px 0 rgba(200,240,53,0.12), 0 10px 24px ${theme.colors.sh25}`,
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

function errorStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.red,
    fontSize: 12,
    margin: 0,
  };
}
