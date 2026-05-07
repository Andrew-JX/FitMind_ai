import type { WorkoutDetailDto, WorkoutSummaryDto } from "../../../../shared/src/training";

import { Button } from "../../components/Button";
import { IconButton } from "../../components/IconButton";
import { Pill } from "../../components/Pill";
import { useTheme } from "../../theme/ThemeContext";

export interface WorkoutCardProps {
  detail: WorkoutDetailDto | null;
  exerciseNames: Map<string, string>;
  isDeleting: boolean;
  isExpanded: boolean;
  isLoadingDetail: boolean;
  onDelete: () => Promise<void>;
  onToggle: () => Promise<void>;
  workout: WorkoutSummaryDto;
}

export function WorkoutCard(props: WorkoutCardProps) {
  const { theme } = useTheme();
  const summaryLine = buildSummaryLine(props.workout);
  const notes = props.workout.notes?.trim();

  return (
    <article style={cardStyle(theme, props.isExpanded)}>
      <div style={topRowStyle}>
        <div>
          <p style={dateStyle(theme)}>{formatDateTime(props.workout.performed_at)}</p>
          <p style={summaryStyle(theme)}>
            {summaryLine}
            {notes ? ` · ${truncateNotes(notes)}` : ""}
          </p>
        </div>
        <Button onClick={() => void props.onToggle()} type="button" variant="secondary">
          {props.isExpanded ? "收起" : "展开"}
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
                    {formatDateTime(props.detail.performed_at)}
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

              <ul style={setListStyle}>
                {props.detail.sets.map((setItem, index) => {
                  const exerciseName =
                    props.exerciseNames.get(setItem.exercise_id) ?? "未知动作";

                  return (
                    <li key={setItem.id} style={setItemStyle(theme)}>
                      <div style={setRowStyle}>
                        <div>
                          <strong style={{ fontSize: 13 }}>{exerciseName}</strong>
                          <p style={metaTextStyle(theme)}>
                            第 {index + 1} 组 · 同动作序号 {setItem.set_index}
                          </p>
                        </div>
                        {setItem.rpe !== null ? (
                          <Pill tone={getRpeTone(setItem.rpe)}>RPE {setItem.rpe}</Pill>
                        ) : null}
                      </div>
                      <p style={setValueStyle(theme)}>
                        {setItem.reps} × {setItem.weight_kg} kg
                      </p>
                      {setItem.notes?.trim() ? (
                        <p style={metaTextStyle(theme)}>{setItem.notes}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              <div style={deleteRowStyle}>
                <IconButton
                  disabled={props.isDeleting}
                  icon="trash"
                  label="删除训练"
                  onClick={() => void props.onDelete()}
                  tone="danger"
                />
                <button
                  disabled={props.isDeleting}
                  onClick={() => void props.onDelete()}
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

function getRpeTone(rpe: number): "success" | "warning" | "danger" {
  if (rpe >= 9) {
    return "danger";
  }

  if (rpe >= 8) {
    return "warning";
  }

  return "success";
}

const topRowStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const detailContainerStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 14,
};

const detailMetaGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
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

function cardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isExpanded: boolean,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${isExpanded ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    padding: 14,
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

function setItemStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    padding: 10,
  };
}

function setValueStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 13,
    fontWeight: 700,
    margin: "6px 0 0",
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
