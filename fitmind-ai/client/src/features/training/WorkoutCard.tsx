import { useMemo, useState } from "react";

import type {
  WorkoutDetailDto,
  WorkoutSetDto,
  WorkoutSummaryDto,
} from "../../../../shared/src/training";

import { Button } from "../../components/Button";
import { IconButton } from "../../components/IconButton";
import { Pill } from "../../components/Pill";
import { useTheme } from "../../theme/ThemeContext";

interface WorkoutExerciseGroup {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSetDto[];
}

export interface WorkoutCardProps {
  detail: WorkoutDetailDto | null;
  exerciseNames: Map<string, string>;
  isDeleting: boolean;
  isExpanded: boolean;
  isLoadingDetail: boolean;
  onDelete: () => Promise<void>;
  onEdit: () => void;
  onEdited?: (() => Promise<void>) | undefined;
  onToggle: () => Promise<void>;
  token: string | null;
  workout: WorkoutSummaryDto;
}

export function WorkoutCard(props: WorkoutCardProps) {
  const { theme } = useTheme();
  const summaryLine = buildSummaryLine(props.workout);
  const notes = props.workout.notes?.trim();
  const groupedSets = useMemo(() => {
    return props.detail ? groupWorkoutSets(props.detail.sets, props.exerciseNames) : [];
  }, [props.detail, props.exerciseNames]);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

  return (
    <article style={cardStyle(theme, props.isExpanded)}>
      <div
        aria-expanded={props.isExpanded}
        onClick={() => void props.onToggle()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void props.onToggle();
          }
        }}
        role="button"
        style={topRowStyle(theme)}
        tabIndex={0}
      >
        <div style={summaryBlockStyle}>
          <p style={dateStyle(theme)}>{formatDateTime(props.workout.performed_at)}</p>
          <p style={summaryStyle(theme)}>
            {summaryLine}
            {notes ? ` · ${truncateNotes(notes)}` : ""}
          </p>
        </div>
        <Button
          onClick={(event) => {
            event.stopPropagation();
            void props.onToggle();
          }}
          type="button"
          variant="secondary"
        >
          {props.isExpanded ? "收起详情" : "查看详情"}
        </Button>
      </div>

      {props.isExpanded ? (
        <div style={detailContainerStyle}>
          {props.isLoadingDetail && !props.detail ? (
            <p style={metaTextStyle(theme)}>正在加载训练详情...</p>
          ) : null}

          {props.detail ? (
            <>
              <div style={detailMetaGridStyle}>
                <div style={detailBlockStyle(theme)}>
                  <span style={detailLabelStyle(theme)}>训练时间</span>
                  <strong style={detailValueStyle(theme)}>
                    {formatWorkoutTime(props.detail)}
                  </strong>
                </div>
                {props.detail.duration_minutes !== null ? (
                  <div style={detailBlockStyle(theme)}>
                    <span style={detailLabelStyle(theme)}>时长</span>
                    <strong style={detailValueStyle(theme)}>
                      {props.detail.duration_minutes} 分钟
                    </strong>
                  </div>
                ) : null}
              </div>

              <div style={noteBlockStyle(theme)}>
                <span style={detailLabelStyle(theme)}>备注</span>
                <p style={detailParagraphStyle(theme)}>
                  {props.detail.notes?.trim() || "本次训练没有备注。"}
                </p>
              </div>

              <div style={actionRowStyle}>
                <Button
                  disabled={!props.token || props.isDeleting}
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onEdit();
                  }}
                  type="button"
                  variant="secondary"
                >
                  编辑训练
                </Button>
              </div>

              <div style={groupListStyle}>
                {groupedSets.map((group) => {
                  const summary = summarizeWorkoutGroup(group);
                  const isGroupExpanded = expandedExerciseId === group.exerciseId;

                  return (
                    <section key={group.exerciseId} style={groupCardStyle(theme, isGroupExpanded)}>
                      <button
                        onClick={() => toggleExerciseGroup(group.exerciseId)}
                        style={groupHeaderButtonStyle}
                        type="button"
                      >
                        <div style={groupTitleRowStyle}>
                          <strong style={{ color: theme.colors.tx, fontSize: 14 }}>
                            {group.exerciseName}
                          </strong>
                          <span style={groupToggleStyle(theme)}>
                            {isGroupExpanded ? "收起组数" : "查看组数"}
                          </span>
                        </div>
                        <p style={summaryTextStyle(theme)}>
                          {summary.setCount} 组 · 总容量 {formatVolume(summary.totalVolumeKg)} 公斤
                        </p>
                      </button>

                      {isGroupExpanded ? (
                        <ul style={setListStyle}>
                          {group.sets.map((setItem) => (
                            <li key={setItem.id} style={setItemStyle(theme)}>
                              <div style={setRowStyle}>
                                <div>
                                  <strong style={{ fontSize: 13 }}>
                                    第 {setItem.set_index} 组
                                  </strong>
                                  <p style={metaTextStyle(theme)}>
                                    {setItem.weight_kg} 公斤 × {setItem.reps} 次
                                  </p>
                                </div>
                                {setItem.rpe !== null ? (
                                  <Pill tone={getRpeTone(setItem.rpe)}>
                                    {getEffortLabel(setItem.rpe)}
                                  </Pill>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </section>
                  );
                })}
              </div>

              <div style={deleteRowStyle}>
                <div onClick={(event) => event.stopPropagation()}>
                  <IconButton
                    disabled={props.isDeleting}
                    icon="trash"
                    label="删除训练"
                    onClick={() => void props.onDelete()}
                    tone="danger"
                  />
                </div>
                <button
                  disabled={props.isDeleting}
                  onClick={(event) => {
                    event.stopPropagation();
                    void props.onDelete();
                  }}
                  style={deleteButtonStyle(theme)}
                  type="button"
                >
                  {props.isDeleting ? "删除中..." : "删除训练"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );

  function toggleExerciseGroup(exerciseId: string): void {
    setExpandedExerciseId((currentValue) => {
      return currentValue === exerciseId ? null : exerciseId;
    });
  }
}

function groupWorkoutSets(
  sets: WorkoutSetDto[],
  exerciseNames: Map<string, string>,
): WorkoutExerciseGroup[] {
  const grouped = new Map<string, WorkoutExerciseGroup>();

  sets.forEach((setItem) => {
    const existingGroup = grouped.get(setItem.exercise_id);

    if (existingGroup) {
      existingGroup.sets.push(setItem);
      return;
    }

    grouped.set(setItem.exercise_id, {
      exerciseId: setItem.exercise_id,
      exerciseName: exerciseNames.get(setItem.exercise_id) ?? "未知动作",
      sets: [setItem],
    });
  });

  return Array.from(grouped.values()).map((group) => ({
    ...group,
    sets: [...group.sets].sort((left, right) => left.set_index - right.set_index),
  }));
}

function buildSummaryLine(workout: WorkoutSummaryDto): string {
  const parts = [`${workout.sets_count} 组`];

  if (workout.duration_minutes !== null) {
    parts.push(`${workout.duration_minutes} 分钟`);
  }

  return parts.join(" · ");
}

function truncateNotes(notes: string): string {
  return notes.length > 24 ? `${notes.slice(0, 24)}...` : notes;
}

function formatWorkoutTime(workout: WorkoutDetailDto): string {
  if (workout.started_at && workout.ended_at) {
    return `${formatDateTime(workout.started_at)} - ${formatTime(workout.ended_at)}`;
  }

  return `${formatDateTime(workout.performed_at)}，暂未记录具体开始/结束时间`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("zh-CN", {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "numeric",
      });
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });
}

function summarizeWorkoutGroup(group: WorkoutExerciseGroup): {
  setCount: number;
  totalVolumeKg: number;
} {
  return {
    setCount: group.sets.length,
    totalVolumeKg: group.sets.reduce((sum, setItem) => {
      return sum + setItem.reps * setItem.weight_kg;
    }, 0),
  };
}

function formatVolume(totalVolumeKg: number): string {
  if (Number.isInteger(totalVolumeKg)) {
    return `${totalVolumeKg}`;
  }

  return totalVolumeKg.toFixed(2);
}

function getRpeTone(rpe: number): "success" | "warning" | "danger" {
  if (rpe >= 9) {
    return "danger";
  }

  if (rpe >= 8) {
    return "warning";
  }

  return "success";
}

function getEffortLabel(rpe: number): string {
  if (rpe >= 9) {
    return "困难";
  }

  if (rpe <= 6) {
    return "轻松";
  }

  return "正常";
}

const detailContainerStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 14,
};

const summaryBlockStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const detailMetaGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const groupListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const groupHeaderButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  display: "grid",
  gap: 6,
  padding: 0,
  textAlign: "left",
  width: "100%",
};

const groupTitleRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 10,
  justifyContent: "space-between",
};

const setListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const setRowStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
};

const deleteRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
};

function cardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isExpanded: boolean,
): React.CSSProperties {
  return {
    backgroundColor: isExpanded ? withAlpha(theme.colors.ac, theme.isDark ? 0.08 : 0.06) : theme.colors.surf2,
    border: `1px solid ${isExpanded ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    padding: 14,
    transition: "background-color 150ms ease, border-color 150ms ease",
  };
}

function topRowStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    alignItems: "flex-start",
    borderRadius: theme.radius.control,
    cursor: "pointer",
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
  };
}

function dateStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 14,
    fontWeight: 700,
    margin: 0,
  };
}

function summaryStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "6px 0 0",
  };
}

function detailBlockStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    display: "grid",
    gap: 4,
    padding: 10,
  };
}

function noteBlockStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    display: "grid",
    gap: 6,
    padding: 10,
  };
}

function detailLabelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
  };
}

function detailValueStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 13,
  };
}

function detailParagraphStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
  };
}

function groupCardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isExpanded: boolean,
): React.CSSProperties {
  return {
    backgroundColor: isExpanded
      ? withAlpha(theme.colors.ac, theme.isDark ? 0.1 : 0.07)
      : theme.colors.surf,
    border: `1px solid ${isExpanded ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    display: "grid",
    gap: 10,
    padding: 12,
  };
}

function groupToggleStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.ac,
    flex: "0 0 auto",
    fontSize: 11,
    fontWeight: 700,
  };
}

function summaryTextStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.5,
    margin: 0,
  };
}

function setItemStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    padding: 10,
  };
}

function metaTextStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.5,
    margin: "4px 0 0",
  };
}

function deleteButtonStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    color: theme.colors.red,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    padding: 0,
  };
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})`;
}
