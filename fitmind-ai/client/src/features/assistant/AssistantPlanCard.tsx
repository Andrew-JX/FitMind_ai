import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeContext";
import type {
  AssistantPlanDraft,
  AssistantPlanStrategy,
  AssistantPlannedExercise,
} from "./assistant-types";

export interface AssistantPlanCardProps {
  plan: AssistantPlanDraft;
  onAccept?: (() => void) | undefined;
  isAccepting?: boolean | undefined;
  isAccepted?: boolean | undefined;
}

const STRATEGY_LABEL: Record<AssistantPlanStrategy, string> = {
  consolidate: "巩固 / 控制疲劳",
  add_frequency: "可小幅加量",
  maintain: "维持基线",
};

/**
 * Renders the deterministic executable next-week draft (动作 × 组 × 次 × 目标重量)
 * carried on the assistant message's structured output.
 *
 * @param props - The normalized plan draft for one assistant message
 * @returns The plan card, or null when there are no planned exercises
 */
export function AssistantPlanCard(props: AssistantPlanCardProps) {
  const { theme } = useTheme();
  const { plan } = props;

  if (plan.exercises.length === 0) {
    return null;
  }

  return (
    <details open style={containerStyle(theme)}>
      <summary style={summaryStyle(theme)}>
        <Icon name="zap" size={13} />
        <span>下周训练草案 · {plan.exercises.length} 个动作</span>
        <span style={strategyChipStyle(theme)}>
          {STRATEGY_LABEL[plan.strategy]}
        </span>
      </summary>

      <ol style={listStyle}>
        {plan.exercises.map((exercise, index) => (
          <PlanExerciseRow
            exercise={exercise}
            key={`${exercise.exerciseName}-${index}`}
          />
        ))}
      </ol>

      {plan.notes.length > 0 ? (
        <ul style={notesStyle(theme)}>
          {plan.notes.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      ) : null}

      {props.onAccept ? (
        <button
          disabled={props.isAccepting || props.isAccepted}
          onClick={props.onAccept}
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

function PlanExerciseRow(props: { exercise: AssistantPlannedExercise }) {
  const { theme } = useTheme();
  const { exercise } = props;

  return (
    <li style={rowStyle(theme)}>
      <div style={rowHeaderStyle}>
        <span style={exerciseNameStyle(theme)}>{exercise.exerciseName}</span>
        <span
          style={targetWeightStyle(theme, exercise.targetWeightKg !== null)}
        >
          {exercise.targetWeightKg !== null
            ? `目标 ${exercise.targetWeightKg} kg`
            : "沿用上次重量"}
        </span>
      </div>
      <div style={metaRowStyle(theme)}>
        <span style={setsPillStyle(theme)}>
          {exercise.sets} 组 × {exercise.repMin}~{exercise.repMax} 次
        </span>
      </div>
      {exercise.basis ? (
        <p style={basisStyle(theme)}>{exercise.basis}</p>
      ) : null}
    </li>
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
    padding: "10px 12px",
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
    fontWeight: 700,
    padding: "2px 8px",
  };
}

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  listStyle: "none",
  margin: "12px 0 0",
  padding: 0,
};

function rowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 10,
    display: "grid",
    gap: 4,
    padding: "10px 12px",
  };
}

const rowHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  justifyContent: "space-between",
};

function exerciseNameStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 13,
    fontWeight: 700,
  };
}

function targetWeightStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  hasTarget: boolean,
): React.CSSProperties {
  return {
    color: hasTarget ? theme.colors.ac : theme.colors.tx3,
    fontSize: 12,
    fontWeight: 700,
  };
}

function metaRowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  void theme;
  return {
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  };
}

function setsPillStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.pill,
    color: theme.colors.tx2,
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
  };
}

function basisStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    lineHeight: 1.5,
    margin: 0,
  };
}

function notesStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    display: "grid",
    fontSize: 11,
    gap: 4,
    lineHeight: 1.5,
    margin: "10px 0 0",
    paddingLeft: 16,
  };
}

function acceptButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isAccepted: boolean,
): React.CSSProperties {
  return {
    backgroundColor: isAccepted ? theme.colors.surf3 : theme.colors.ac,
    border: "none",
    borderRadius: theme.radius.control,
    color: isAccepted ? theme.colors.tx2 : theme.colors.acText,
    cursor: isAccepted ? "default" : "pointer",
    fontSize: 13,
    fontWeight: 700,
    marginTop: 12,
    padding: "10px 14px",
    width: "100%",
  };
}
