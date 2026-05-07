import { useEffect, useRef, useState } from "react";

import type { ExercisePickerProps } from "./ExercisePicker";
import type { DictionaryExercise } from "./dictionary-api";

import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import { ExerciseLibraryScreen } from "./ExerciseLibraryScreen";
import { TrainingSessionEmptyState } from "./TrainingSessionEmptyState";
import { TrainingSessionExerciseCard } from "./TrainingSessionExerciseCard";
import {
  TrainingSessionRestTimer,
  type RestTimerState,
} from "./TrainingSessionRestTimer";
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
  const bodyRef = useRef<HTMLElement | null>(null);
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingExerciseRemovalId, setPendingExerciseRemovalId] = useState<string | null>(
    null,
  );
  const [pendingRestTimerRequest, setPendingRestTimerRequest] = useState<{
    seconds: number;
    setId: string;
  } | null>(null);
  const [replacingDraftExerciseId, setReplacingDraftExerciseId] = useState<string | null>(
    null,
  );
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);

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

  useEffect(() => {
    if (!props.isOpen || restTimer?.status !== "running") {
      return;
    }

    const timerId = window.setInterval(() => {
      setRestTimer((currentValue) => {
        if (!currentValue || currentValue.status !== "running") {
          return currentValue;
        }

        const nextRemainingSeconds = currentValue.remainingSeconds - 1;

        if (nextRemainingSeconds <= 0) {
          return {
            ...currentValue,
            isRunning: false,
            remainingSeconds: 0,
            status: "finished",
          };
        }

        return {
          ...currentValue,
          remainingSeconds: nextRemainingSeconds,
        };
      });
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [props.isOpen, restTimer?.status]);

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

        <main ref={bodyRef} style={bodyStyle(Boolean(restTimer))}>
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
              {draftExercises.map((draftExercise, index) => (
                <TrainingSessionExerciseCard
                  canMoveDown={index < draftExercises.length - 1}
                  canMoveUp={index > 0}
                  draftExercise={draftExercise}
                  key={draftExercise.id}
                  onAddSet={() => handleAddSet(draftExercise.id)}
                  onCopySet={(setId) => handleCopySet(draftExercise.id, setId)}
                  onDeleteSet={(setId) => handleDeleteSet(draftExercise.id, setId)}
                  onMoveDown={() => handleMoveExercise(draftExercise.id, "down")}
                  onMoveUp={() => handleMoveExercise(draftExercise.id, "up")}
                  onRemove={() => handleRemoveExercise(draftExercise.id)}
                  onReplace={() => handleStartReplaceExercise(draftExercise.id)}
                  onStartRestTimer={(setId, seconds) =>
                    handleStartRestTimer(setId, seconds)
                  }
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

        {restTimer ? (
          <TrainingSessionRestTimer
            onClose={() => setRestTimer(null)}
            onSkip={() => setRestTimer(null)}
            onToggleRunning={handleToggleRestTimerRunning}
            timer={restTimer}
          />
        ) : null}

        {pendingExerciseRemovalId ? (
          <div style={confirmBackdropStyle(theme)}>
            <section style={confirmCardStyle(theme)}>
              <strong style={confirmTitleStyle(theme)}>移除这个动作？</strong>
              <p style={confirmCopyStyle(theme)}>该动作下的训练组也会一起移除。</p>
              <div style={confirmActionRowStyle}>
                <Button
                  onClick={() => setPendingExerciseRemovalId(null)}
                  type="button"
                  variant="secondary"
                >
                  取消
                </Button>
                <Button
                  onClick={() => confirmRemoveExercise(pendingExerciseRemovalId)}
                  style={dangerConfirmButtonStyle(theme)}
                  type="button"
                  variant="secondary"
                >
                  移除
                </Button>
              </div>
            </section>
          </div>
        ) : null}

        {pendingRestTimerRequest ? (
          <div style={confirmBackdropStyle(theme)}>
            <section style={confirmCardStyle(theme)}>
              <strong style={confirmTitleStyle(theme)}>
                已有休息倒计时正在进行，是否替换？
              </strong>
              <div style={confirmActionRowStyle}>
                <Button
                  onClick={() => setPendingRestTimerRequest(null)}
                  type="button"
                  variant="secondary"
                >
                  取消
                </Button>
                <Button
                  onClick={() => {
                    startRestTimer(pendingRestTimerRequest.setId, pendingRestTimerRequest.seconds);
                    setPendingRestTimerRequest(null);
                  }}
                  type="button"
                >
                  替换
                </Button>
              </div>
            </section>
          </div>
        ) : null}

        {isLibraryOpen ? (
          <ExerciseLibraryScreen
            isOpen={isLibraryOpen}
            mode={replacingDraftExerciseId ? "replace" : "add"}
            onClose={() => {
              setIsLibraryOpen(false);
              setReplacingDraftExerciseId(null);
            }}
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
    setReplacingDraftExerciseId(null);
    setIsLibraryOpen(true);
  }

  function handleSelectExercise(exercise: DictionaryExercise): void {
    setDraftExercises((currentValue) => {
      if (replacingDraftExerciseId) {
        const alreadyExists = currentValue.some((item) => {
          return item.id !== replacingDraftExerciseId && item.exerciseId === exercise.id;
        });

        if (alreadyExists) {
          setDuplicateNotice("这个动作已经在本次训练中，不能替换为重复动作。");
          return currentValue;
        }

        setDuplicateNotice(null);
        return currentValue.map((draftExercise) => {
          if (draftExercise.id !== replacingDraftExerciseId) {
            return draftExercise;
          }

          return {
            ...draftExercise,
            categoryLabel: getExerciseCategoryLabel(exercise),
            exercise,
            exerciseId: exercise.id,
            name: exercise.name_en,
          };
        });
      }

      const alreadyExists = currentValue.some((item) => item.exerciseId === exercise.id);

      if (alreadyExists) {
        setDuplicateNotice("这个动作已经在本次训练中");
        return currentValue;
      }

      setDuplicateNotice(null);
      return [...currentValue, createDraftExercise(exercise, getExerciseCategoryLabel(exercise))];
    });
    setIsLibraryOpen(false);
    setReplacingDraftExerciseId(null);
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

  function handleStartReplaceExercise(exerciseId: string): void {
    setDuplicateNotice(null);
    setErrorMessage(null);
    setReplacingDraftExerciseId(exerciseId);
    setIsLibraryOpen(true);
  }

  function handleMoveExercise(exerciseId: string, direction: "up" | "down"): void {
    setDraftExercises((currentValue) => {
      const sourceIndex = currentValue.findIndex((draftExercise) => {
        return draftExercise.id === exerciseId;
      });

      if (sourceIndex < 0) {
        return currentValue;
      }

      const targetIndex = direction === "up" ? sourceIndex - 1 : sourceIndex + 1;

      if (targetIndex < 0 || targetIndex >= currentValue.length) {
        return currentValue;
      }

      const nextValue = [...currentValue];
      const [movedExercise] = nextValue.splice(sourceIndex, 1);

      if (!movedExercise) {
        return currentValue;
      }

      nextValue.splice(targetIndex, 0, movedExercise);
      return nextValue;
    });
  }

  function handleRemoveExercise(exerciseId: string): void {
    const targetExercise = draftExercises.find((draftExercise) => {
      return draftExercise.id === exerciseId;
    });

    if (!targetExercise) {
      return;
    }

    if (targetExercise.sets.length > 0) {
      setPendingExerciseRemovalId(exerciseId);
      return;
    }

    setDraftExercises((currentValue) => {
      return currentValue.filter((draftExercise) => draftExercise.id !== exerciseId);
    });
  }

  function confirmRemoveExercise(exerciseId: string): void {
    setDraftExercises((currentValue) => {
      return currentValue.filter((draftExercise) => draftExercise.id !== exerciseId);
    });
    setPendingExerciseRemovalId(null);
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
    scrollComposerBodyToBottom();
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

  function handleStartRestTimer(setId: string, seconds: number): void {
    const safeSeconds = Math.max(1, Math.floor(seconds));

    if (
      restTimer &&
      (restTimer.status === "running" || restTimer.status === "paused") &&
      restTimer.remainingSeconds > 0
    ) {
      setPendingRestTimerRequest({
        seconds: safeSeconds,
        setId,
      });
      return;
    }

    startRestTimer(setId, safeSeconds);
  }

  function startRestTimer(setId: string, seconds: number): void {
    setRestTimer({
      isRunning: true,
      remainingSeconds: seconds,
      sourceSetId: setId,
      status: "running",
      totalSeconds: seconds,
    });
  }

  function handleToggleRestTimerRunning(): void {
    setRestTimer((currentValue) => {
      if (!currentValue || currentValue.status === "finished") {
        return currentValue;
      }

      if (currentValue.status === "paused") {
        return {
          ...currentValue,
          isRunning: true,
          status: "running",
        };
      }

      return {
        ...currentValue,
        isRunning: false,
        status: "paused",
      };
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
    setPendingExerciseRemovalId(null);
    setPendingRestTimerRequest(null);
    setReplacingDraftExerciseId(null);
    setRestTimer(null);
  }

  function scrollComposerBodyToBottom(): void {
    requestAnimationFrame(() => {
      if (!bodyRef.current) {
        return;
      }

      bodyRef.current.scrollTo({
        behavior: "smooth",
        top: bodyRef.current.scrollHeight,
      });
    });
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
    display: "flex",
    flexDirection: "column",
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

function bodyStyle(hasRestTimer: boolean): React.CSSProperties {
  return {
    alignContent: "start",
    display: "grid",
    flex: 1,
    gap: 16,
    minHeight: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
    paddingBottom: hasRestTimer ? 236 : 180,
    touchAction: "pan-y",
    WebkitOverflowScrolling: "touch",
  };
}

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
  zIndex: 4,
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

function confirmBackdropStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    alignItems: "end",
    backgroundColor: theme.isDark ? "rgba(0,0,0,0.42)" : "rgba(0,0,0,0.24)",
    display: "flex",
    inset: 0,
    padding: "16px 16px calc(24px + env(safe-area-inset-bottom, 0px))",
    position: "absolute",
    zIndex: 230,
  };
}

function confirmCardStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr2}`,
    borderRadius: theme.radius.card,
    boxShadow: theme.shadows.card,
    display: "grid",
    gap: 12,
    padding: 16,
    width: "100%",
  };
}

function confirmTitleStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 15,
  };
}

function confirmCopyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
  };
}

const confirmActionRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

function dangerConfirmButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    borderColor: theme.colors.red,
    color: theme.colors.red,
  };
}
