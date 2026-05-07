import { useEffect, useState } from "react";

import type { ExercisePickerProps } from "./ExercisePicker";
import type { DictionaryExercise } from "./dictionary-api";

import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import { ExerciseLibraryScreen } from "./ExerciseLibraryScreen";
import { TrainingSessionEmptyState } from "./TrainingSessionEmptyState";
import { TrainingSessionExerciseCard } from "./TrainingSessionExerciseCard";
import { TrainingSessionTimer } from "./TrainingSessionTimer";
import { createWorkout } from "./workout-api";
import {
  buildWorkoutRequestFromDraft,
  createDraftExercise,
  createDraftSet,
  getCompletedValidSetCount,
  type DraftExercise,
  type DraftSet,
} from "./training-session-draft";

export interface TrainingSessionComposerProps {
  exerciseLibraryProps: ExercisePickerProps;
  isOpen: boolean;
  onCancel: () => void;
  onCreated?: (() => Promise<void>) | undefined;
  token: string | null;
}

export function TrainingSessionComposer(props: TrainingSessionComposerProps) {
  const { theme } = useTheme();
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!props.isOpen || !isRunning) {
      return;
    }

    const timerId = window.setInterval(() => {
      setElapsedSeconds((currentValue) => currentValue + 1);
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [isRunning, props.isOpen]);

  useEffect(() => {
    if (!props.isOpen) {
      resetComposerState();
    }
  }, [props.isOpen]);

  if (!props.isOpen) {
    return null;
  }

  const completedValidSetCount = getCompletedValidSetCount(draftExercises);

  return (
    <section style={composerStyle}>
      <div style={backdropStyle(theme)} />
      <div style={panelStyle(theme)}>
        <header style={headerStyle}>
          <div style={headerTopRowStyle}>
            <Button disabled={isSubmitting} onClick={handleCancel} type="button" variant="secondary">
              取消
            </Button>
            <Button
              disabled={completedValidSetCount === 0 || isSubmitting}
              onClick={() => void handleComplete()}
              type="button"
            >
              {isSubmitting ? "保存中..." : "完成"}
            </Button>
          </div>

          <div style={headerBodyStyle}>
            <TrainingSessionTimer
              elapsedSeconds={elapsedSeconds}
              isRunning={isRunning}
              onToggleRunning={() => setIsRunning((currentValue) => !currentValue)}
            />

            <div style={statusWrapStyle}>
              <div style={statusPillStyle(theme)}>
                <Icon name={isRunning ? "clock" : "stop"} size={14} />
                <span>{isRunning ? "训练进行中" : "等待开始"}</span>
              </div>
              <p style={statusCopyStyle(theme)}>
                {completedValidSetCount > 0
                  ? `已完成 ${completedValidSetCount} 组，可保存训练`
                  : "请先添加至少一个动作和训练组。"}
              </p>
            </div>
          </div>
        </header>

        <main style={bodyStyle}>
          {duplicateNotice ? (
            <StateNotice
              description={duplicateNotice}
              title="动作已存在"
              tone="warning"
            />
          ) : null}

          {errorMessage ? (
            <StateNotice
              description={translateErrorMessage(errorMessage)}
              title="训练保存失败"
              tone="error"
            />
          ) : null}

          {draftExercises.length === 0 ? (
            <TrainingSessionEmptyState />
          ) : (
            <div style={exerciseListStyle}>
              {draftExercises.map((draftExercise) => (
                <TrainingSessionExerciseCard
                  draftExercise={draftExercise}
                  key={draftExercise.id}
                  onAddSet={() => handleAddSet(draftExercise.id)}
                  onCopySet={(setId) => handleCopySet(draftExercise.id, setId)}
                  onDeleteSet={(setId) => handleDeleteSet(draftExercise.id, setId)}
                  onToggleExpanded={() => handleToggleExpanded(draftExercise.id)}
                  onToggleSetCompleted={(setId) =>
                    handleToggleSetCompleted(draftExercise.id, setId)
                  }
                  onUpdateSet={(setId, field, value) =>
                    handleUpdateSet(draftExercise.id, setId, field, value)
                  }
                />
              ))}
            </div>
          )}
        </main>

        <div style={fabWrapStyle}>
          <button
            aria-label="添加动作"
            onClick={() => void handleOpenLibrary()}
            style={fabStyle(theme)}
            type="button"
          >
            <Icon name="plus" size={24} />
          </button>
        </div>

        {isLibraryOpen ? (
          <ExerciseLibraryScreen
            isOpen={isLibraryOpen}
            onClose={() => setIsLibraryOpen(false)}
            onSelectExercise={handleSelectExercise}
            {...props.exerciseLibraryProps}
          />
        ) : null}
      </div>
    </section>
  );

  function handleCancel(): void {
    if (isSubmitting) {
      return;
    }

    resetComposerState();
    props.onCancel();
  }

  async function handleOpenLibrary(): Promise<void> {
    setDuplicateNotice(null);
    setErrorMessage(null);
    setIsLibraryOpen(true);
  }

  function handleSelectExercise(exercise: DictionaryExercise): void {
    setDraftExercises((currentValue) => {
      const alreadyExists = currentValue.some((item) => item.exerciseId === exercise.id);

      if (alreadyExists) {
        setDuplicateNotice("这个动作已经在本次训练中");
        return currentValue;
      }

      setDuplicateNotice(null);
      return [...currentValue, createDraftExercise(exercise, getExerciseCategoryLabel(exercise))];
    });
    setIsLibraryOpen(false);
  }

  function handleToggleExpanded(exerciseId: string): void {
    setDraftExercises((currentValue) => {
      return currentValue.map((draftExercise) => {
        if (draftExercise.id !== exerciseId) {
          return draftExercise;
        }

        return {
          ...draftExercise,
          isExpanded: !draftExercise.isExpanded,
        };
      });
    });
  }

  function handleAddSet(exerciseId: string): void {
    setDraftExercises((currentValue) => {
      return currentValue.map((draftExercise) => {
        if (draftExercise.id !== exerciseId) {
          return draftExercise;
        }

        return {
          ...draftExercise,
          isExpanded: true,
          sets: [...draftExercise.sets, createDraftSet(draftExercise.sets.at(-1))],
        };
      });
    });
  }

  function handleCopySet(exerciseId: string, setId: string): void {
    setDraftExercises((currentValue) => {
      return currentValue.map((draftExercise) => {
        if (draftExercise.id !== exerciseId) {
          return draftExercise;
        }

        const sourceSet = draftExercise.sets.find((setDraft) => setDraft.id === setId);

        if (!sourceSet) {
          return draftExercise;
        }

        return {
          ...draftExercise,
          sets: [...draftExercise.sets, createDraftSet(sourceSet)],
        };
      });
    });
  }

  function handleDeleteSet(exerciseId: string, setId: string): void {
    setDraftExercises((currentValue) => {
      return currentValue.map((draftExercise) => {
        if (draftExercise.id !== exerciseId) {
          return draftExercise;
        }

        if (draftExercise.sets.length <= 1) {
          return draftExercise;
        }

        return {
          ...draftExercise,
          sets: draftExercise.sets.filter((setDraft) => setDraft.id !== setId),
        };
      });
    });
  }

  function handleUpdateSet<TField extends keyof DraftSet>(
    exerciseId: string,
    setId: string,
    field: TField,
    value: DraftSet[TField],
  ): void {
    setDraftExercises((currentValue) => {
      return currentValue.map((draftExercise) => {
        if (draftExercise.id !== exerciseId) {
          return draftExercise;
        }

        return {
          ...draftExercise,
          sets: draftExercise.sets.map((setDraft) => {
            if (setDraft.id !== setId) {
              return setDraft;
            }

            return {
              ...setDraft,
              completed:
                field === "weightKg" || field === "reps" ? false : setDraft.completed,
              [field]: value,
            };
          }),
        };
      });
    });
  }

  function handleToggleSetCompleted(exerciseId: string, setId: string): void {
    setDraftExercises((currentValue) => {
      return currentValue.map((draftExercise) => {
        if (draftExercise.id !== exerciseId) {
          return draftExercise;
        }

        return {
          ...draftExercise,
          sets: draftExercise.sets.map((setDraft) => {
            if (setDraft.id !== setId) {
              return setDraft;
            }

            if (!canCompleteSet(setDraft)) {
              return {
                ...setDraft,
                completed: false,
              };
            }

            return {
              ...setDraft,
              completed: !setDraft.completed,
            };
          }),
        };
      });
    });
  }

  async function handleComplete(): Promise<void> {
    if (!props.token) {
      setErrorMessage("You must be signed in to create a workout.");
      return;
    }

    const payload = buildWorkoutRequestFromDraft({
      draftExercises,
      elapsedSeconds,
      performedAt: new Date(),
    });

    if (!payload) {
      setErrorMessage("Please fix the highlighted workout fields and try again.");
      return;
    }

    setDuplicateNotice(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await createWorkout(props.token, payload);
      resetComposerState();
      await props.onCreated?.();
    } catch (error) {
      setErrorMessage(getReadableErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetComposerState(): void {
    setDraftExercises([]);
    setDuplicateNotice(null);
    setElapsedSeconds(0);
    setErrorMessage(null);
    setIsLibraryOpen(false);
    setIsRunning(false);
  }
}

function canCompleteSet(setDraft: DraftSet): boolean {
  const weightKg = Number.parseFloat(setDraft.weightKg);
  const reps = Number.parseInt(setDraft.reps, 10);

  return Number.isFinite(weightKg) && weightKg > 0 && Number.isInteger(reps) && reps > 0;
}

function getExerciseCategoryLabel(exercise: DictionaryExercise): string {
  const primaryCodes = exercise.muscles
    .filter((muscle) => muscle.is_primary)
    .map((muscle) => muscle.code.toLowerCase());
  const movementPattern = exercise.movement_pattern?.toLowerCase() ?? "";
  const searchable = `${exercise.name_en} ${exercise.name_zh} ${movementPattern}`.toLowerCase();

  if (primaryCodes.some((code) => code.includes("chest") || code === "pecs")) {
    return "胸";
  }

  if (primaryCodes.some((code) => code.includes("back") || code.includes("lat"))) {
    return "背";
  }

  if (
    primaryCodes.some((code) => {
      return code.includes("quad") || code.includes("hamstring") || code.includes("leg");
    })
  ) {
    return "腿";
  }

  if (primaryCodes.some((code) => code.includes("shoulder") || code.includes("delt"))) {
    return "肩";
  }

  if (primaryCodes.some((code) => code.includes("bicep"))) {
    return "二头";
  }

  if (primaryCodes.some((code) => code.includes("tricep"))) {
    return "三头";
  }

  if (primaryCodes.some((code) => code.includes("calf"))) {
    return "小腿";
  }

  if (primaryCodes.some((code) => code.includes("forearm") || code.includes("grip"))) {
    return "前臂";
  }

  if (primaryCodes.some((code) => code.includes("neck"))) {
    return "颈部";
  }

  if (primaryCodes.some((code) => code.includes("glute"))) {
    return "臀部";
  }

  if (primaryCodes.some((code) => code.includes("core") || code.includes("ab"))) {
    return "核心";
  }

  if (searchable.includes("warm") || searchable.includes("activation")) {
    return "热身";
  }

  if (searchable.includes("stretch") || searchable.includes("mobility")) {
    return "拉伸";
  }

  if (
    movementPattern.includes("carry") ||
    movementPattern.includes("rotation") ||
    movementPattern.includes("gait") ||
    searchable.includes("sled")
  ) {
    return "功能性";
  }

  return "其他";
}

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Workout creation is unavailable right now.";
}

function translateErrorMessage(message: string): string {
  if (message === "You must be signed in to create a workout.") {
    return "请先登录后再创建训练。";
  }

  if (message === "Please fix the highlighted workout fields and try again.") {
    return "请先完成至少一组有效训练数据后再保存。";
  }

  if (message === "Workout creation is unavailable right now.") {
    return "训练保存暂时不可用，请稍后重试。";
  }

  return message;
}

const composerStyle: React.CSSProperties = {
  inset: 0,
  left: "50%",
  maxWidth: 390,
  position: "fixed",
  transform: "translateX(-50%)",
  width: "100%",
  zIndex: 90,
};

function backdropStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    background:
      theme.isDark ? "rgba(9, 11, 18, 0.88)" : "rgba(245, 247, 251, 0.92)",
    inset: 0,
    position: "absolute",
  };
}

function panelStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    background:
      theme.isDark
        ? "linear-gradient(180deg, rgba(17,21,34,0.98) 0%, rgba(10,13,22,0.98) 100%)"
        : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,247,252,0.98) 100%)",
    color: theme.colors.tx,
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    inset: 0,
    overflow: "hidden",
    padding:
      "max(16px, env(safe-area-inset-top, 16px)) 16px calc(112px + env(safe-area-inset-bottom, 0px))",
    position: "relative",
  };
}

const headerStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  paddingBottom: 18,
};

const headerTopRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const headerBodyStyle: React.CSSProperties = {
  alignItems: "end",
  display: "grid",
  gap: 16,
  gridTemplateColumns: "minmax(0, 1fr) auto",
};

const bodyStyle: React.CSSProperties = {
  alignContent: "start",
  display: "grid",
  gap: 16,
  minHeight: 0,
  overflowY: "auto",
  paddingBottom: 96,
};

const exerciseListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  paddingBottom: 8,
};

const statusWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  justifyItems: "end",
};

function statusPillStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.pill,
    color: theme.colors.tx2,
    display: "inline-flex",
    fontSize: 12,
    fontWeight: 700,
    gap: 8,
    padding: "8px 12px",
  };
}

function statusCopyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
    maxWidth: 180,
    textAlign: "right",
  };
}

const fabWrapStyle: React.CSSProperties = {
  bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
  position: "absolute",
  right: 16,
};

function fabStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.ac,
    border: "none",
    borderRadius: 999,
    boxShadow: theme.shadows.card,
    color: theme.colors.acText,
    cursor: "pointer",
    display: "inline-flex",
    height: 56,
    justifyContent: "center",
    width: 56,
  };
}
