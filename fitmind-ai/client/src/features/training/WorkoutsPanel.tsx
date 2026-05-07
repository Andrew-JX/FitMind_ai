import { useEffect, useState } from "react";

import type { WorkoutDetailDto, WorkoutSummaryDto } from "../../../../shared/src/training";

import { Card } from "../../components/Card";
import { HttpClientError } from "../../services/http-client";
import { useTheme } from "../../theme/ThemeContext";
import { searchExercises } from "./dictionary-api";
import { WorkoutCard } from "./WorkoutCard";

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
  const { theme } = useTheme();
  const exerciseNames = useExerciseNames();

  return (
    <Card>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>训练日志</h2>
          <p style={copyStyle(theme)}>共 {props.workouts.length} 条</p>
        </div>
        <button
          onClick={() => void props.onRefresh()}
          style={refreshButtonStyle(theme)}
          type="button"
        >
          刷新
        </button>
      </div>

      {props.listError ? <p style={errorStyle(theme)}>{translateError(props.listError)}</p> : null}
      {props.deleteError ? (
        <p style={errorStyle(theme)}>{translateError(props.deleteError)}</p>
      ) : null}
      {props.detailError ? (
        <p style={errorStyle(theme)}>{translateError(props.detailError)}</p>
      ) : null}

      {props.isLoadingList ? <p style={copyStyle(theme)}>正在加载训练日志...</p> : null}
      {!props.isLoadingList && props.workouts.length === 0 ? (
        <div style={emptyStateStyle(theme)}>
          <strong style={{ fontSize: 14 }}>还没有训练记录</strong>
          <p style={emptyCopyStyle(theme)}>点击上方「记录训练」添加第一条训练日志</p>
        </div>
      ) : null}

      {props.workouts.length > 0 ? (
        <div style={listStyle}>
          {props.workouts.map((workout) => {
            const isExpanded = props.selectedWorkoutId === workout.id;
            const detail = isExpanded ? props.selectedWorkout : null;

            return (
              <WorkoutCard
                detail={detail}
                exerciseNames={exerciseNames}
                isDeleting={props.deletingWorkoutId === workout.id}
                isExpanded={isExpanded}
                isLoadingDetail={props.isLoadingDetail}
                key={workout.id}
                onDelete={() => handleDeleteWorkout(workout.id)}
                onToggle={() => props.onSelectWorkout(workout.id)}
                workout={workout}
              />
            );
          })}
        </div>
      ) : null}
    </Card>
  );

  async function handleDeleteWorkout(workoutId: string): Promise<void> {
    if (!window.confirm("确认删除这条训练记录及其所有动作组吗？")) {
      return;
    }

    await props.onDeleteWorkout(workoutId);
  }
}

function translateError(message: string): string {
  return message
    .replaceAll("Workout list is unavailable right now.", "训练日志加载失败")
    .replaceAll("Workout detail is unavailable right now.", "训练详情加载失败")
    .replaceAll("Workout deletion is unavailable right now.", "删除训练失败")
    .replaceAll("You must be signed in to view workouts.", "请先登录后查看训练日志。")
    .replaceAll("You must be signed in to view workout details.", "请先登录后查看训练详情。")
    .replaceAll("You must be signed in to delete workouts.", "请先登录后删除训练。");
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

const headerStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 14,
};

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  margin: 0,
};

function copyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "6px 0 0",
  };
}

function refreshButtonStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx2,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    padding: "10px 12px",
  };
}

function errorStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.orange,
    fontSize: 12,
    margin: "12px 0 0",
  };
}

function emptyStateStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    display: "grid",
    gap: 6,
    marginTop: 14,
    padding: 14,
  };
}

function emptyCopyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
  };
}
