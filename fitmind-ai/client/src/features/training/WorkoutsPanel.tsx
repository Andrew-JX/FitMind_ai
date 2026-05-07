import { useEffect, useState } from "react";

import type { WorkoutDetailDto, WorkoutSummaryDto } from "../../../../shared/src/training";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { StateNotice } from "../../components/StateNotice";
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
        <Button
          disabled={props.isLoadingList}
          onClick={() => void props.onRefresh()}
          type="button"
          variant="secondary"
        >
          {props.isLoadingList ? "刷新中..." : "刷新"}
        </Button>
      </div>

      {props.listError ? (
        <StateNotice
          description="请确认后端服务已启动，或稍后重试。"
          icon="dumbbell"
          title="数据加载失败"
          tone="error"
        />
      ) : null}

      {!props.listError && props.deleteError ? (
        <div style={{ marginTop: 12 }}>
          <StateNotice
            description={translateError(props.deleteError)}
            title="删除训练失败"
            tone="error"
          />
        </div>
      ) : null}

      {!props.listError && props.detailError ? (
        <div style={{ marginTop: 12 }}>
          <StateNotice
            description={translateError(props.detailError)}
            title="训练详情加载失败"
            tone="error"
          />
        </div>
      ) : null}

      {props.isLoadingList && !props.listError ? (
        <p style={copyStyle(theme)}>正在加载训练日志...</p>
      ) : null}

      {!props.isLoadingList && !props.listError && props.workouts.length === 0 ? (
        <div style={{ marginTop: 14 }}>
          <StateNotice
            description="先记录一次训练，系统会自动生成训练统计和 AI 可用上下文。"
            icon="dumbbell"
            title="暂无训练记录"
          />
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
    .replaceAll("Workout list is unavailable right now.", "数据加载失败，请稍后重试。")
    .replaceAll("Workout detail is unavailable right now.", "数据加载失败，请稍后重试。")
    .replaceAll("Workout deletion is unavailable right now.", "请稍后重试。")
    .replaceAll("You must be signed in to view workouts.", "请先登录后再查看训练日志。")
    .replaceAll("You must be signed in to view workout details.", "请先登录后再查看训练详情。")
    .replaceAll("You must be signed in to delete workouts.", "请先登录后再删除训练记录。");
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
