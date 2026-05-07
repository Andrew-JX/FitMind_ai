import { useEffect, useMemo, useState } from "react";

import type {
  AddWorkoutSetRequest,
  WorkoutDetailDto,
  WorkoutSetDto,
  WorkoutSummaryDto,
} from "../../../../shared/src/training";

import { Button } from "../../components/Button";
import { IconButton } from "../../components/IconButton";
import { Pill } from "../../components/Pill";
import { useTheme } from "../../theme/ThemeContext";
import { TrainingSessionSetRow } from "./TrainingSessionSetRow";
import {
  createDraftSet,
  isDraftSetValid,
  mapEffortToRpe,
  type DraftSet,
  type EffortLevel,
} from "./training-session-draft";
import {
  addWorkoutSet,
  deleteWorkoutSet,
  updateWorkoutSet,
} from "./workout-api";

interface WorkoutSetDraft extends DraftSet {
  persistedSetId: string | null;
}

interface WorkoutExerciseGroup {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSetDto[];
}

interface WorkoutExerciseDraftGroup {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSetDraft[];
}

export interface WorkoutCardProps {
  detail: WorkoutDetailDto | null;
  exerciseNames: Map<string, string>;
  isDeleting: boolean;
  isExpanded: boolean;
  isLoadingDetail: boolean;
  onDelete: () => Promise<void>;
  onEdited: () => Promise<void>;
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
  const [editError, setEditError] = useState<string | null>(null);
  const [editingGroups, setEditingGroups] = useState<WorkoutExerciseDraftGroup[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSavingEdits, setIsSavingEdits] = useState(false);

  useEffect(() => {
    if (!props.isExpanded) {
      setExpandedExerciseId(null);
      setEditError(null);
      setEditingGroups([]);
      setIsEditMode(false);
      setIsSavingEdits(false);
    }
  }, [props.isExpanded]);

  useEffect(() => {
    if (!props.detail || isEditMode) {
      return;
    }

    setExpandedExerciseId((currentValue) => {
      if (currentValue === null) {
        return groupedSets[0]?.exerciseId ?? null;
      }

      return groupedSets.some((group) => group.exerciseId === currentValue)
        ? currentValue
        : groupedSets[0]?.exerciseId ?? null;
    });
  }, [groupedSets, isEditMode, props.detail]);

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

              {editError ? (
                <div style={errorBannerStyle(theme)}>{editError}</div>
              ) : null}

              <div style={actionRowStyle}>
                <Button
                  disabled={!props.token || props.isDeleting || isSavingEdits}
                  onClick={() => handleToggleEditMode()}
                  type="button"
                  variant="secondary"
                >
                  {isEditMode ? "取消编辑" : "编辑训练"}
                </Button>
                {isEditMode ? (
                  <Button
                    disabled={hasInvalidDrafts(editingGroups) || isSavingEdits}
                    onClick={() => void handleSaveEdits()}
                    type="button"
                  >
                    {isSavingEdits ? "保存中..." : "保存修改"}
                  </Button>
                ) : null}
              </div>

              {isEditMode ? (
                <div style={groupListStyle}>
                  {editingGroups.map((group) => {
                    const summary = summarizeDraftGroup(group);
                    const isGroupExpanded = expandedExerciseId === group.exerciseId;

                    return (
                      <section key={group.exerciseId} style={groupCardStyle(theme, isGroupExpanded)}>
                        <button
                          onClick={() => toggleExerciseGroup(group.exerciseId)}
                          style={groupHeaderButtonStyle}
                          type="button"
                        >
                          <strong style={{ color: theme.colors.tx, fontSize: 14 }}>
                            {group.exerciseName}
                          </strong>
                          <p style={summaryTextStyle(theme)}>
                            {summary.setCount} 组 · 总容量 {formatVolume(summary.totalVolumeKg)} kg
                          </p>
                        </button>

                        {isGroupExpanded ? (
                          <div style={groupEditorStyle}>
                            {group.sets.map((setDraft, index) => (
                              <TrainingSessionSetRow
                                canComplete
                                canDelete={group.sets.length > 1}
                                index={index}
                                key={setDraft.id}
                                onCopy={() => copyDraftSet(group.exerciseId, setDraft.id)}
                                onDelete={() => deleteDraftSet(group.exerciseId, setDraft.id)}
                                onToggleCompleted={() => undefined}
                                onUpdate={(field, value) =>
                                  updateDraftSet(group.exerciseId, setDraft.id, field, value)
                                }
                                setDraft={setDraft}
                                showCompletion={false}
                              />
                            ))}

                            <button
                              onClick={() => addDraftSet(group.exerciseId)}
                              style={addSetButtonStyle(theme)}
                              type="button"
                            >
                              + 新增一组
                            </button>
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              ) : (
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
                          <strong style={{ color: theme.colors.tx, fontSize: 14 }}>
                            {group.exerciseName}
                          </strong>
                          <p style={summaryTextStyle(theme)}>
                            {summary.setCount} 组 · 总容量 {formatVolume(summary.totalVolumeKg)} kg
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
                                      {setItem.reps} × {setItem.weight_kg} kg
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
              )}

              <div style={deleteRowStyle}>
                <div
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <IconButton
                    disabled={props.isDeleting || isSavingEdits}
                    icon="trash"
                    label="删除训练"
                    onClick={() => void props.onDelete()}
                    tone="danger"
                  />
                </div>
                <button
                  disabled={props.isDeleting || isSavingEdits}
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

  function handleToggleEditMode(): void {
    if (isEditMode) {
      setEditError(null);
      setEditingGroups([]);
      setIsEditMode(false);
      return;
    }

    if (!props.detail) {
      return;
    }

    const draftGroups = buildDraftGroups(props.detail.sets, props.exerciseNames);
    setEditingGroups(draftGroups);
    setExpandedExerciseId(draftGroups[0]?.exerciseId ?? null);
    setEditError(null);
    setIsEditMode(true);
  }

  function toggleExerciseGroup(exerciseId: string): void {
    setExpandedExerciseId((currentValue) => {
      return currentValue === exerciseId ? null : exerciseId;
    });
  }

  function addDraftSet(exerciseId: string): void {
    setEditingGroups((currentValue) => {
      return currentValue.map((group) => {
        if (group.exerciseId !== exerciseId) {
          return group;
        }

        return {
          ...group,
          sets: [
            ...group.sets,
            {
              ...createDraftSet(group.sets.at(-1)),
              persistedSetId: null,
            },
          ],
        };
      });
    });
  }

  function copyDraftSet(exerciseId: string, setId: string): void {
    setEditingGroups((currentValue) => {
      return currentValue.map((group) => {
        if (group.exerciseId !== exerciseId) {
          return group;
        }

        const sourceSet = group.sets.find((setDraft) => setDraft.id === setId);

        if (!sourceSet) {
          return group;
        }

        return {
          ...group,
          sets: [
            ...group.sets,
            {
              ...createDraftSet(sourceSet),
              persistedSetId: null,
            },
          ],
        };
      });
    });
  }

  function deleteDraftSet(exerciseId: string, setId: string): void {
    setEditingGroups((currentValue) => {
      return currentValue.map((group) => {
        if (group.exerciseId !== exerciseId) {
          return group;
        }

        if (group.sets.length <= 1) {
          return group;
        }

        return {
          ...group,
          sets: group.sets.filter((setDraft) => setDraft.id !== setId),
        };
      });
    });
  }

  function updateDraftSet<TField extends keyof DraftSet>(
    exerciseId: string,
    setId: string,
    field: TField,
    value: DraftSet[TField],
  ): void {
    setEditingGroups((currentValue) => {
      return currentValue.map((group) => {
        if (group.exerciseId !== exerciseId) {
          return group;
        }

        return {
          ...group,
          sets: group.sets.map((setDraft) => {
            if (setDraft.id !== setId) {
              return setDraft;
            }

            return {
              ...setDraft,
              [field]: value,
            };
          }),
        };
      });
    });
  }

  async function handleSaveEdits(): Promise<void> {
    if (!props.token || !props.detail) {
      return;
    }

    if (hasInvalidDrafts(editingGroups)) {
      setEditError("请先修正所有训练组的重量、次数和体感后再保存。");
      return;
    }

    setIsSavingEdits(true);
    setEditError(null);

    try {
      const originalSetById = new Map(
        props.detail.sets.map((setItem) => [setItem.id, setItem] as const),
      );
      const currentPersistedIds = new Set(
        editingGroups.flatMap((group) => {
          return group.sets
            .map((setDraft) => setDraft.persistedSetId)
            .filter((setId): setId is string => Boolean(setId));
        }),
      );

      const deletedSetIds = props.detail.sets
        .map((setItem) => setItem.id)
        .filter((setId) => !currentPersistedIds.has(setId));

      for (const setId of deletedSetIds) {
        await deleteWorkoutSet(props.token, setId);
      }

      for (const group of editingGroups) {
        for (const [index, setDraft] of group.sets.entries()) {
          const payload = buildSetMutationPayload(group.exerciseId, setDraft, index + 1);

          if (setDraft.persistedSetId) {
            const originalSet = originalSetById.get(setDraft.persistedSetId);

            if (!originalSet) {
              continue;
            }

            if (isSetChanged(originalSet, payload)) {
              await updateWorkoutSet(props.token, setDraft.persistedSetId, {
                reps: payload.reps,
                rpe: payload.rpe,
                set_index: payload.set_index,
                weight_kg: payload.weight_kg,
              });
            }

            continue;
          }

          await addWorkoutSet(props.token, props.detail.id, payload);
        }
      }

      setIsEditMode(false);
      setEditingGroups([]);
      await props.onEdited();
    } catch (error) {
      setEditError(getReadableErrorMessage(error));
    } finally {
      setIsSavingEdits(false);
    }
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

  return Array.from(grouped.values()).map((group) => {
    return {
      ...group,
      sets: [...group.sets].sort((left, right) => left.set_index - right.set_index),
    };
  });
}

function buildDraftGroups(
  sets: WorkoutSetDto[],
  exerciseNames: Map<string, string>,
): WorkoutExerciseDraftGroup[] {
  return groupWorkoutSets(sets, exerciseNames).map((group) => {
    return {
      exerciseId: group.exerciseId,
      exerciseName: group.exerciseName,
      sets: group.sets.map((setItem) => {
        return {
          completed: true,
          effort: mapRpeToEffort(setItem.rpe),
          id: `persisted-${setItem.id}`,
          persistedSetId: setItem.id,
          reps: `${setItem.reps}`,
          weightKg: `${setItem.weight_kg}`,
        };
      }),
    };
  });
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

function summarizeDraftGroup(group: WorkoutExerciseDraftGroup): {
  setCount: number;
  totalVolumeKg: number;
} {
  return {
    setCount: group.sets.length,
    totalVolumeKg: group.sets.reduce((sum, setDraft) => {
      if (!isDraftSetValid(setDraft)) {
        return sum;
      }

      return (
        sum +
        Number.parseInt(setDraft.reps, 10) * Number.parseFloat(setDraft.weightKg)
      );
    }, 0),
  };
}

function mapRpeToEffort(rpe: number | null): EffortLevel {
  if (rpe !== null && rpe >= 9) {
    return "hard";
  }

  if (rpe !== null && rpe <= 6) {
    return "easy";
  }

  return "normal";
}

function buildSetMutationPayload(
  exerciseId: string,
  setDraft: WorkoutSetDraft,
  setIndex: number,
): AddWorkoutSetRequest {
  return {
    exercise_id: exerciseId,
    is_warmup: false,
    reps: Number.parseInt(setDraft.reps, 10),
    rpe: mapEffortToRpe(setDraft.effort),
    set_index: setIndex,
    weight_kg: Number.parseFloat(setDraft.weightKg),
  };
}

function isSetChanged(
  originalSet: WorkoutSetDto,
  nextPayload: AddWorkoutSetRequest,
): boolean {
  return (
    originalSet.reps !== nextPayload.reps ||
    originalSet.weight_kg !== nextPayload.weight_kg ||
    originalSet.set_index !== nextPayload.set_index ||
    (originalSet.rpe ?? null) !== (nextPayload.rpe ?? null)
  );
}

function hasInvalidDrafts(groups: WorkoutExerciseDraftGroup[]): boolean {
  return groups.some((group) => {
    return group.sets.some((setDraft) => !isDraftSetValid(setDraft));
  });
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
    return "简单";
  }

  return "正常";
}

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "训练日志更新暂时不可用，请稍后重试。";
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
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${isExpanded ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    padding: 14,
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
    backgroundColor: theme.colors.surf,
    border: `1px solid ${isExpanded ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    display: "grid",
    gap: 10,
    padding: 12,
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

const groupEditorStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

function addSetButtonStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px dashed ${theme.colors.bdr2}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx2,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    padding: "12px 14px",
  };
}

function errorBannerStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.isDark ? "rgba(255,92,92,0.1)" : "rgba(201,48,48,0.08)",
    border: `1px solid ${theme.colors.red}`,
    borderRadius: theme.radius.control,
    color: theme.colors.red,
    fontSize: 12,
    lineHeight: 1.6,
    padding: "10px 12px",
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
