import { useEffect, useState } from "react";

import type { WorkoutDetailDto, WorkoutSummaryDto } from "../../../../shared/src/training";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Pill } from "../../components/Pill";
import { HttpClientError } from "../../services/http-client";
import { useTheme } from "../../theme/ThemeContext";
import { searchExercises } from "./dictionary-api";

export interface WorkoutsPanelProps {
  deleteError: string | null;
  deletingWorkoutId: string | null;
  detailError: string | null;
  isLoadingDetail: boolean;
  isLoadingList: boolean;
  listError: string | null;
  onDeleteWorkout: (workoutId: string) => Promise<boolean>;
  onRefresh: () => Promise<void>;
  onSelectWorkout: (workoutId: string) => Promise<void>;
  selectedWorkout: WorkoutDetailDto | null;
  selectedWorkoutId: string | null;
  workouts: WorkoutSummaryDto[];
}

export function WorkoutsPanel(props: WorkoutsPanelProps) {
  const {
    deleteError,
    deletingWorkoutId,
    detailError,
    isLoadingDetail,
    isLoadingList,
    listError,
    onDeleteWorkout,
    onRefresh,
    onSelectWorkout,
    selectedWorkout,
    selectedWorkoutId,
    workouts,
  } = props;
  const { theme } = useTheme();
  const exerciseNames = useExerciseNames();

  return (
    <Card>
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0 }}>最近训练列表</h2>
          <p style={copyStyle(theme)}>
            查看已保存 session，展开详情，并在需要时删除训练记录。
          </p>
        </div>
        <Button disabled={isLoadingList} onClick={() => void onRefresh()} type="button" variant="secondary">
          {isLoadingList ? "刷新中..." : "刷新"}
        </Button>
      </div>

      {listError ? <p style={errorStyle(theme)}>错误：{listError}</p> : null}
      {deleteError ? <p style={errorStyle(theme)}>错误：{deleteError}</p> : null}
      {isLoadingList ? <p style={copyStyle(theme)}>正在加载训练列表...</p> : null}
      {!isLoadingList && workouts.length === 0 ? (
        <p style={copyStyle(theme)}>还没有训练记录。先在上方创建第一条训练。</p>
      ) : null}

      {workouts.length > 0 ? (
        <ul style={workoutListStyle}>
          {workouts.map((workout) => {
            const isDeleting = deletingWorkoutId === workout.id;
            const isSelected = selectedWorkoutId === workout.id;

            return (
              <li key={workout.id} style={workoutItemStyle(theme, isSelected)}>
                <div style={workoutItemTopStyle}>
                  <div>
                    <strong>{formatDateTime(workout.performed_at)}</strong>
                    <div style={metaStyle(theme)}>
                      时长：{formatDuration(workout.duration_minutes)}
                    </div>
                  </div>
                  <Pill tone={isSelected ? "accent" : "neutral"}>
                    {workout.sets_count} 组
                  </Pill>
                </div>

                <div style={metaStyle(theme)}>
                  肌群：{workout.muscle_groups.join("、") || "未知"}
                </div>
                <div style={metaStyle(theme)}>
                  备注：{workout.notes?.trim() || "无备注"}
                </div>

                <div style={actionRowStyle}>
                  <Button onClick={() => void onSelectWorkout(workout.id)} type="button" variant="secondary">
                    {isSelected ? "查看中" : "查看详情"}
                  </Button>
                  <Button
                    disabled={isDeleting}
                    onClick={() => void handleDeleteWorkout(workout.id)}
                    type="button"
                    variant="secondary"
                  >
                    {isDeleting ? "删除中..." : "删除"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {detailError ? <p style={errorStyle(theme)}>错误：{detailError}</p> : null}
      {isLoadingDetail ? <p style={copyStyle(theme)}>正在加载训练详情...</p> : null}
      {!isLoadingDetail && !selectedWorkout && workouts.length > 0 ? (
        <p style={copyStyle(theme)}>选择一条训练记录查看保存的动作组和备注。</p>
      ) : null}

      {selectedWorkout ? (
        <section style={detailSectionStyle(theme)}>
          <h3 style={{ margin: 0 }}>训练详情</h3>
          <p style={copyStyle(theme)}>训练时间：{formatDateTime(selectedWorkout.performed_at)}</p>
          <p style={copyStyle(theme)}>时长：{formatDuration(selectedWorkout.duration_minutes)}</p>
          <p style={copyStyle(theme)}>备注：{selectedWorkout.notes?.trim() || "无备注"}</p>

          <ul style={setListStyle}>
            {selectedWorkout.sets.map((setItem) => {
              const exerciseName =
                exerciseNames.get(setItem.exercise_id) ?? `Exercise ${setItem.exercise_id}`;

              return (
                <li key={setItem.id} style={setItemStyle(theme)}>
                  <strong>{exerciseName}</strong>
                  <div style={metaStyle(theme)}>同动作第 {setItem.set_index} 组</div>
                  <div style={metaStyle(theme)}>
                    {setItem.reps} 次 × {setItem.weight_kg} kg
                  </div>
                  <div style={metaStyle(theme)}>RPE：{setItem.rpe ?? "未记录"}</div>
                  <div style={metaStyle(theme)}>
                    {setItem.is_warmup ? "热身组" : "正式组"}
                  </div>
                  <div style={metaStyle(theme)}>
                    备注：{setItem.notes?.trim() || "无组备注"}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </Card>
  );

  async function handleDeleteWorkout(workoutId: string): Promise<void> {
    if (!window.confirm("确认删除这条训练记录及其所有动作组吗？")) {
      return;
    }

    await onDeleteWorkout(workoutId);
  }
}

function useExerciseNames(): Map<string, string> {
  const [exerciseNames, setExerciseNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let isActive = true;

    async function loadExerciseNames(): Promise<void> {
      try {
        const exercises = await searchExercises({});

        if (!isActive) {
          return;
        }

        setExerciseNames(
          new Map(
            exercises.map((exercise) => {
              return [exercise.id, exercise.name_zh?.trim() || exercise.name_en] as const;
            }),
          ),
        );
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (!(error instanceof HttpClientError)) {
          return;
        }

        setExerciseNames(new Map());
      }
    }

    void loadExerciseNames();

    return () => {
      isActive = false;
    };
  }, []);

  return exerciseNames;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}

function formatDuration(durationMinutes: number | null): string {
  if (durationMinutes === null) {
    return "未记录";
  }

  return `${durationMinutes} 分钟`;
}

const headerStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 16,
  justifyContent: "space-between",
};

const workoutListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  listStyle: "none",
  margin: "16px 0 0",
  padding: 0,
};

const workoutItemTopStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 12,
};

const setListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  listStyle: "none",
  margin: "12px 0 0",
  padding: 0,
};

function copyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 13,
    lineHeight: 1.6,
    margin: "8px 0 0",
  };
}

function errorStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return { color: theme.colors.orange, marginBottom: 0 };
}

function metaStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 12, lineHeight: 1.6 };
}

function workoutItemStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isSelected: boolean,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${isSelected ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: 14,
    padding: 12,
  };
}

function detailSectionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    borderRadius: 14,
    marginTop: 16,
    padding: 12,
  };
}

function setItemStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    padding: 12,
  };
}
