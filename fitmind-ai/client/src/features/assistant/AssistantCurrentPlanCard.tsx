import { useState } from "react";

import { Card } from "../../components/Card";
import { useToast } from "../../components/ToastProvider";
import { useTheme } from "../../theme/ThemeContext";
import { getToneColors, type SemanticTone } from "../../theme/tokens";
import type {
  PlanAdherenceExercise,
  PlanAdherenceStatus,
} from "./planned-workout-api";
import {
  classifyPlanLifecycle,
  getLocalPlanToday,
} from "./assistant-plan-lifecycle";
import type { CurrentPlanStatus } from "./use-current-plan";
import type { PlannedWorkoutWithAdherence } from "./planned-workout-api";

export interface AssistantCurrentPlanCardProps {
  plan: PlannedWorkoutWithAdherence | null;
  status: CurrentPlanStatus;
  isMutating: boolean;
  actionError: string | null;
  onAbandon: () => Promise<boolean>;
  onArchive: () => Promise<boolean>;
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
 * Persistent weekly-plan card at the top of the assistant page: the active plan
 * plus planned-vs-performed adherence.
 *
 * The design keeps the card collapsed to its one-line summary and puts the
 * exercise rows behind 展开, so the page can open on the insight cards.
 *
 * @param props - The current plan, load status, and archive/abandon actions
 * @returns The plan card (with loading / empty / error states)
 */
export function AssistantCurrentPlanCard(props: AssistantCurrentPlanCardProps) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { plan, status } = props;
  const [isExpanded, setIsExpanded] = useState(false);

  if (status === "loading" && !plan) {
    return (
      <Card>
        <p style={mutedStyle(theme)}>正在加载本周计划…</p>
      </Card>
    );
  }

  if (status === "error" && !plan) {
    return (
      <Card>
        <p style={errorStyle(theme)}>
          {props.actionError ?? "本周计划加载失败，可稍后重试。"}
        </p>
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card>
        <div style={bodyStyle}>
          <h3 style={titleStyle}>本周计划</h3>
          <p style={mutedStyle(theme)}>
            还没有本周计划。让助手生成下周训练草案后，点草案上的「设为本周计划」，这里就会显示目标动作和完成进度。
          </p>
        </div>
      </Card>
    );
  }

  const setAdherencePct = Math.round(plan.adherence.set_adherence_ratio * 100);
  const isExpired =
    classifyPlanLifecycle({
      endDate: plan.endDate,
      today: getLocalPlanToday(),
    }) === "expired";
  const expiredTone = getToneColors(theme, "warning");

  return (
    <Card>
      <div style={bodyStyle}>
        <div style={headerRowStyle}>
          <div style={titleRowStyle}>
            <h3 style={titleStyle}>{isExpired ? "计划回顾" : "本周计划"}</h3>
            {isExpired ? (
              <span
                style={{
                  ...statusChipStyle,
                  backgroundColor: expiredTone.background,
                  borderColor: expiredTone.border,
                  color: expiredTone.text,
                }}
              >
                已过期
              </span>
            ) : null}
          </div>
          <div style={actionRowStyle}>
            {isExpired ? (
              <button
                disabled={props.isMutating}
                onClick={() => {
                  void props.onArchive().then((didArchive) => {
                    showToast(
                      didArchive
                        ? "计划已归档"
                        : "归档失败，请查看卡片中的错误信息。",
                    );
                  });
                }}
                style={archiveButtonStyle(theme, props.isMutating)}
                type="button"
              >
                归档
              </button>
            ) : null}
            <button
              disabled={props.isMutating}
              onClick={() => {
                void props.onAbandon().then((didAbandon) => {
                  showToast(
                    didAbandon
                      ? // Deliberately window-free: this button also serves an
                        // expired plan, which 本周 would misdescribe.
                        "计划已放弃"
                      : "放弃计划失败，请查看卡片中的错误信息。",
                  );
                });
              }}
              style={abandonButtonStyle(theme, props.isMutating)}
              type="button"
            >
              放弃计划
            </button>
            <button
              disabled={props.isMutating}
              onClick={() => setIsExpanded((currentValue) => !currentValue)}
              style={toggleButtonStyle(theme, props.isMutating)}
              type="button"
            >
              {isExpanded ? "收起" : "展开"}
            </button>
          </div>
        </div>

        <span style={metaStyle(theme)}>
          {plan.startDate} ~ {plan.endDate} · 动作{" "}
          {plan.adherence.trained_exercise_count}/
          {plan.adherence.planned_exercise_count} 已练 · 组数依从{" "}
          {setAdherencePct}%
        </span>

        {isExpanded ? (
          <>
            <div style={listStyle}>
              {plan.adherence.exercises.map((exercise, index) => (
                <PlanAdherenceRow
                  exercise={exercise}
                  key={`${exercise.exercise_name}-${index}`}
                />
              ))}
            </div>
            {plan.adherence.extra_exercise_count > 0 ? (
              <span style={metaStyle(theme)}>
                另有 {plan.adherence.extra_exercise_count} 个计划外动作也练了。
              </span>
            ) : null}
          </>
        ) : null}

        {props.actionError ? (
          <p style={errorStyle(theme)}>{props.actionError}</p>
        ) : null}
      </div>
    </Card>
  );
}

function PlanAdherenceRow(props: { exercise: PlanAdherenceExercise }) {
  const { theme } = useTheme();
  const { exercise } = props;
  const tone = getToneColors(theme, STATUS_TONE[exercise.status]);

  return (
    <div style={rowStyle(theme)}>
      <span style={exerciseNameStyle(theme)}>{exercise.exercise_name}</span>
      <div style={rowMetaStyle}>
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
        <span style={setsStyle(theme)}>
          {exercise.performed_sets}/{exercise.planned_sets} 组
        </span>
      </div>
    </div>
  );
}

const bodyStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const headerRowStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
};

const titleRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  minWidth: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "-0.2px",
  margin: 0,
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  flex: "0 0 auto",
  flexWrap: "wrap",
  gap: 6,
  justifyContent: "flex-end",
};

function archiveButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  disabled: boolean,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.ac,
    border: 0,
    borderRadius: 8,
    color: theme.colors.acText,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 11,
    fontWeight: 700,
    opacity: disabled ? 0.5 : 1,
    padding: "5px 10px",
  };
}

function abandonButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  disabled: boolean,
): React.CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${theme.colors.bdr2}`,
    borderRadius: 8,
    color: theme.colors.tx2,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 11,
    opacity: disabled ? 0.5 : 1,
    padding: "5px 10px",
  };
}

function toggleButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  disabled: boolean,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 8,
    color: theme.colors.ac,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 11,
    fontWeight: 700,
    opacity: disabled ? 0.5 : 1,
    padding: "5px 10px",
  };
}

function metaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    lineHeight: 1.6,
  };
}

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

function rowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.soft,
    borderRadius: 12,
    display: "flex",
    gap: 8,
    justifyContent: "space-between",
    padding: "11px 13px",
  };
}

const rowMetaStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flex: "0 0 auto",
  gap: 8,
};

function exerciseNameStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "-0.1px",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

const statusChipStyle: React.CSSProperties = {
  border: "1px solid",
  borderRadius: 6,
  fontSize: 10,
  fontWeight: 700,
  padding: "3px 8px",
};

function setsStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
  };
}

function mutedStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
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
