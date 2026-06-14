import { Card } from "../../components/Card";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeContext";
import { getToneColors, type SemanticTone } from "../../theme/tokens";
import type {
  PlanAdherenceExercise,
  PlanAdherenceStatus,
  PlannedWorkoutWithAdherence,
} from "./planned-workout-api";
import type { CurrentPlanStatus } from "./use-current-plan";

export interface AssistantCurrentPlanCardProps {
  plan: PlannedWorkoutWithAdherence | null;
  status: CurrentPlanStatus;
  isMutating: boolean;
  actionError: string | null;
  onAbandon: () => void;
}

const STATUS_LABEL: Record<PlanAdherenceStatus, string> = {
  done: "已完成",
  partial: "部分",
  missed: "未练",
};

const STATUS_TONE: Record<PlanAdherenceStatus, SemanticTone> = {
  done: "success",
  partial: "warning",
  missed: "neutral",
};

/**
 * Persistent weekly-plan card shown at the top of the assistant page: the active
 * plan target plus planned-vs-performed adherence, available on any day.
 *
 * @param props - The current plan, load status, and abandon action
 * @returns The plan card (with loading / empty / error states)
 */
export function AssistantCurrentPlanCard(props: AssistantCurrentPlanCardProps) {
  const { theme } = useTheme();
  const { plan, status } = props;

  if (status === "loading" && !plan) {
    return (
      <Card padding="14px">
        <p style={mutedStyle(theme)}>正在加载本周计划…</p>
      </Card>
    );
  }

  if (status === "error" && !plan) {
    return (
      <Card padding="14px">
        <p style={mutedStyle(theme)}>本周计划加载失败，可稍后重试。</p>
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card padding="14px">
        <div style={headerStyle}>
          <span style={titleStyle(theme)}>
            <Icon name="zap" size={13} /> 本周计划
          </span>
        </div>
        <p style={mutedStyle(theme)}>
          还没有本周计划。让助手生成下周训练草案后，点草案上的「设为本周计划」，这里就会显示目标动作和完成进度。
        </p>
      </Card>
    );
  }

  const exerciseAdherencePct = Math.round(
    plan.adherence.exercise_adherence_ratio * 100,
  );
  const setAdherencePct = Math.round(plan.adherence.set_adherence_ratio * 100);

  return (
    <Card padding="14px">
      <div style={headerStyle}>
        <span style={titleStyle(theme)}>
          <Icon name="zap" size={13} /> 本周计划
        </span>
        <button
          disabled={props.isMutating}
          onClick={props.onAbandon}
          style={abandonButtonStyle(theme, props.isMutating)}
          type="button"
        >
          放弃计划
        </button>
      </div>

      <p style={rangeStyle(theme)}>
        {plan.startDate} ~ {plan.endDate} · 动作 {plan.adherence.trained_exercise_count}/
        {plan.adherence.planned_exercise_count} 已练 · 组数依从 {setAdherencePct}%
      </p>

      <div style={progressTrackStyle(theme)}>
        <div style={progressFillStyle(theme, exerciseAdherencePct)} />
      </div>

      <ul style={listStyle}>
        {plan.adherence.exercises.map((exercise, index) => (
          <PlanAdherenceRow exercise={exercise} key={`${exercise.exercise_name}-${index}`} />
        ))}
      </ul>

      {plan.adherence.extra_exercise_count > 0 ? (
        <p style={mutedStyle(theme)}>
          另有 {plan.adherence.extra_exercise_count} 个计划外动作也练了。
        </p>
      ) : null}

      {props.actionError ? (
        <p style={errorStyle(theme)}>{props.actionError}</p>
      ) : null}
    </Card>
  );
}

function PlanAdherenceRow(props: { exercise: PlanAdherenceExercise }) {
  const { theme } = useTheme();
  const { exercise } = props;
  const tone = getToneColors(theme, STATUS_TONE[exercise.status]);

  return (
    <li style={rowStyle(theme)}>
      <div style={rowMainStyle}>
        <span style={exerciseNameStyle(theme)}>{exercise.exercise_name}</span>
        <span
          style={{
            ...statusChipStyle,
            backgroundColor: tone.background,
            borderColor: tone.border,
            color: tone.text,
          }}
        >
          {STATUS_LABEL[exercise.status]}
        </span>
      </div>
      <span style={setsStyle(theme)}>
        {exercise.performed_sets}/{exercise.planned_sets} 组
      </span>
    </li>
  );
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
    color: theme.colors.tx,
    display: "inline-flex",
    fontSize: 15,
    fontWeight: 700,
    gap: 6,
  };
}

function abandonButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  disabled: boolean,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx2,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12,
    fontWeight: 600,
    opacity: disabled ? 0.5 : 1,
    padding: "4px 10px",
  };
}

function rangeStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    margin: "10px 0 8px",
  };
}

function progressTrackStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    borderRadius: 3,
    height: 6,
    overflow: "hidden",
  };
}

function progressFillStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  percent: number,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.ac,
    height: "100%",
    transition: "width 0.3s",
    width: `${Math.max(0, Math.min(percent, 100))}%`,
  };
}

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  listStyle: "none",
  margin: "12px 0 0",
  padding: 0,
};

function rowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.surf2,
    borderRadius: theme.radius.soft,
    display: "flex",
    gap: 8,
    justifyContent: "space-between",
    padding: "8px 12px",
  };
}

const rowMainStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  minWidth: 0,
};

function exerciseNameStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 13,
    fontWeight: 600,
  };
}

const statusChipStyle: React.CSSProperties = {
  border: "1px solid",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  padding: "2px 8px",
};

function setsStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 600,
  };
}

function mutedStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "10px 0 0",
  };
}

function errorStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.red,
    fontSize: 12,
    margin: "10px 0 0",
  };
}
