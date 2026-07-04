import { useEffect, useState } from "react";

import { ActionSheet } from "../../components/ActionSheet";
import { Button } from "../../components/Button";
import { Pill } from "../../components/Pill";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import type { DictionaryExercise } from "./dictionary-api";
import {
  getEquipmentLabel,
  getExerciseDisplayName,
  getMovementPatternLabel,
  getMuscleCodeLabel,
} from "./exercise-display";
import {
  getExerciseProgress,
  type ExerciseProgress,
} from "./exercise-progress-api";

export interface ExerciseDetailSheetProps {
  actionLabel?: string | undefined;
  exercise: DictionaryExercise | null;
  onClose: () => void;
  onSelectExercise?: ((exercise: DictionaryExercise) => void) | undefined;
  token?: string | null | undefined;
}

export function ExerciseDetailSheet(props: ExerciseDetailSheetProps) {
  const { theme } = useTheme();
  const [progress, setProgress] = useState<ExerciseProgress | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const exercise = props.exercise;
  const [range] = useState(createDefaultRange);

  useEffect(() => {
    if (!exercise || !props.token) {
      return;
    }

    let isActive = true;
    const timerId = window.setTimeout(() => {
      setIsLoadingProgress(true);
      setProgressError(null);

      getExerciseProgress(props.token ?? "", {
        endDate: range.end_date,
        exerciseId: exercise.id,
        startDate: range.start_date,
      })
        .then((nextProgress) => {
          if (isActive) {
            setProgress(nextProgress);
          }
        })
        .catch((error: unknown) => {
          if (isActive) {
            setProgress(null);
            setProgressError(getReadableProgressError(error));
          }
        })
        .finally(() => {
          if (isActive) {
            setIsLoadingProgress(false);
          }
        });
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timerId);
    };
  }, [exercise, props.token, range.end_date, range.start_date]);

  if (!exercise) {
    return null;
  }

  const primaryMuscles = exercise.muscles.filter((muscle) => muscle.is_primary);
  const secondaryMuscles = exercise.muscles.filter(
    (muscle) => !muscle.is_primary,
  );
  const movementLabel = getMovementPatternLabel(exercise.movement_pattern);
  const equipmentLabel = getEquipmentLabel(exercise.equipment);

  return (
    <ActionSheet
      description={movementLabel ?? "查看动作要点和最近训练记录。"}
      footer={
        props.onSelectExercise ? (
          <Button
            onClick={() => props.onSelectExercise?.(exercise)}
            type="button"
          >
            {props.actionLabel ?? "加入本次训练"}
          </Button>
        ) : undefined
      }
      onClose={props.onClose}
      open
      title={getExerciseDisplayName(exercise)}
    >
      <section style={sectionStyle}>
        <div style={pillRowStyle}>
          {equipmentLabel ? <Pill tone="neutral">{equipmentLabel}</Pill> : null}
          {movementLabel ? <Pill tone="analysis">{movementLabel}</Pill> : null}
        </div>
        <DetailList
          emptyText="这个动作的要点还在整理中，先保持标准动作和可控节奏。"
          items={exercise.technique_cues_zh}
          title="动作要点"
        />
        <DetailList
          emptyText="暂时没有更多错误提醒，训练时优先避免借力和失控。"
          items={exercise.common_mistakes_zh}
          title="常见错误"
        />
        <InfoBlock
          title="主要肌群"
          value={formatMuscleList(primaryMuscles.map((muscle) => muscle.code))}
        />
        <InfoBlock
          title="辅助肌群"
          value={formatMuscleList(
            secondaryMuscles.map((muscle) => muscle.code),
          )}
        />
        <InfoBlock
          title="器械说明"
          value={
            exercise.equipment_notes_zh?.trim() ||
            "请根据动作需要选择合适器械，并确认训练环境安全。"
          }
        />
      </section>

      <section style={sectionStyle}>
        <h3 style={sectionTitleStyle(theme)}>最近训练记录</h3>
        <ExerciseHistorySummary
          isLoading={isLoadingProgress}
          progress={
            progress?.exercise.exercise_id === exercise.id ? progress : null
          }
          progressError={progressError}
          token={props.token}
        />
      </section>
    </ActionSheet>
  );
}

function DetailList(props: {
  emptyText: string;
  items: string[];
  title: string;
}) {
  const { theme } = useTheme();
  const items = props.items.map((item) => item.trim()).filter(Boolean);

  return (
    <div style={infoBlockStyle}>
      <h3 style={sectionTitleStyle(theme)}>{props.title}</h3>
      {items.length > 0 ? (
        <ul style={detailListStyle}>
          {items.map((item) => (
            <li key={item} style={detailItemStyle(theme)}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p style={copyStyle(theme)}>{props.emptyText}</p>
      )}
    </div>
  );
}

function InfoBlock(props: { title: string; value: string }) {
  const { theme } = useTheme();

  return (
    <div style={infoBlockStyle}>
      <h3 style={sectionTitleStyle(theme)}>{props.title}</h3>
      <p style={copyStyle(theme)}>{props.value}</p>
    </div>
  );
}

function ExerciseHistorySummary(props: {
  isLoading: boolean;
  progress: ExerciseProgress | null;
  progressError: string | null;
  token?: string | null | undefined;
}) {
  const { theme } = useTheme();

  if (!props.token) {
    return (
      <StateNotice
        description="登录后可以看到这个动作的最近训练记录。"
        icon="chart"
        title="暂无训练历史"
      />
    );
  }

  if (props.isLoading) {
    return <p style={copyStyle(theme)}>正在读取最近训练记录...</p>;
  }

  if (props.progressError) {
    return (
      <StateNotice
        description={props.progressError}
        icon="chart"
        title="训练记录暂时不可用"
        tone="error"
      />
    );
  }

  if (!props.progress || props.progress.totals.workout_count === 0) {
    return (
      <StateNotice
        description="记录几次这个动作后，这里会显示最近表现和最高记录。"
        icon="chart"
        title="最近 30 天还没有记录"
      />
    );
  }

  const recentSessions = props.progress.sessions.slice(-3).reverse();
  const latestSession = recentSessions[0] ?? null;

  return (
    <div style={historyWrapStyle}>
      <div style={metricGridStyle}>
        <MetricCell
          label="最近一次"
          value={
            latestSession
              ? formatDisplayDate(latestSession.performed_at)
              : "暂无"
          }
        />
        <MetricCell
          label="最高重量"
          value={formatNullableWeight(props.progress.totals.max_weight_kg)}
        />
        <MetricCell
          label="最高次数"
          value={formatNullableReps(props.progress.totals.max_reps)}
        />
      </div>

      <ul style={sessionListStyle}>
        {recentSessions.map((session) => (
          <li key={session.workout_id} style={sessionItemStyle(theme)}>
            <strong>{formatDisplayDate(session.performed_at)}</strong>
            <span>
              {session.set_count} 组 · {session.total_reps} 次 · 最高{" "}
              {formatNullableWeight(session.max_weight_kg)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetricCell(props: { label: string; value: string }) {
  const { theme } = useTheme();

  return (
    <div style={metricCellStyle(theme)}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function createDefaultRange(): { end_date: string; start_date: string } {
  const today = new Date();
  const endDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 29);

  return {
    end_date: formatDateOnly(endDate),
    start_date: formatDateOnly(startDate),
  };
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("zh-CN", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatMuscleList(codes: string[]): string {
  if (codes.length === 0) {
    return "其他肌群";
  }

  return codes.map((code) => getMuscleCodeLabel(code)).join("、");
}

function formatNullableWeight(value: number | null): string {
  return value === null ? "暂无" : `${formatCompactNumber(value)} 公斤`;
}

function formatNullableReps(value: number | null): string {
  return value === null ? "暂无" : `${value} 次`;
}

function formatCompactNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function getReadableProgressError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "请稍后重试。";
}

const sectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const pillRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const infoBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

function sectionTitleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 13,
    margin: 0,
  };
}

const detailListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  margin: 0,
  paddingLeft: 18,
};

function detailItemStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
  };
}

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
  };
}

const historyWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const metricGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};

function metricCellStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    display: "grid",
    gap: 4,
    minWidth: 0,
    padding: 10,
  };
}

const sessionListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  listStyle: "none",
  margin: 0,
  padding: 0,
};

function sessionItemStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    color: theme.colors.tx2,
    display: "grid",
    fontSize: 12,
    gap: 4,
    lineHeight: 1.5,
    padding: 10,
  };
}
