import { useEffect, useState } from "react";

import type { ExercisePickerProps } from "./ExercisePicker";
import type { DictionaryExercise } from "./dictionary-api";

import { ActionSheet } from "../../components/ActionSheet";
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
import {
  addWorkoutSet,
  createWorkout,
  deleteWorkoutSet,
  updateWorkout,
  updateWorkoutSet,
} from "./workout-api";
import {
  buildWorkoutRequestFromDraft,
  createDraftExercise,
  createDraftSet,
  getCompletedValidSetCount,
  getExerciseLoadType,
  isDraftSetValid,
  type DraftExercise,
  type DraftSet,
  type TrainingSessionInitialDraft,
} from "./training-session-draft";
import {
  getExerciseCategoryLabel as getDisplayExerciseCategoryLabel,
  getExerciseDisplayName,
} from "./exercise-display";
import { buildWorkoutEditPlan } from "./workout-to-session-draft";

export interface TrainingSessionComposerProps {
  exerciseLibraryProps: ExercisePickerProps;
  initialDraft?: TrainingSessionInitialDraft | null | undefined;
  isOpen: boolean;
  mode?: "create_active" | "create_from_intake" | "edit_existing" | undefined;
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
  const [draftDurationMin, setDraftDurationMin] = useState<number | null>(null);
  const [draftEndedAt, setDraftEndedAt] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [draftPerformedAt, setDraftPerformedAt] = useState<string | null>(null);
  const [draftStartedAt, setDraftStartedAt] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTimeEditorOpen, setIsTimeEditorOpen] = useState(false);
  const [pendingExerciseRemovalId, setPendingExerciseRemovalId] = useState<string | null>(
    null,
  );
  const [pendingRestTimerRequest, setPendingRestTimerRequest] = useState<string | null>(null);
  const [replacingDraftExerciseId, setReplacingDraftExerciseId] = useState<string | null>(
    null,
  );
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);
  const mode = props.mode ?? "create_active";
  const isActiveSession = mode === "create_active";

  useEffect(() => {
    if (!props.isOpen || !isActiveSession || !isRunning) {
      return;
    }

    const timerId = window.setInterval(() => {
      setElapsedSeconds((currentValue) => currentValue + 1);
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [isActiveSession, isRunning, props.isOpen]);

  useEffect(() => {
    if (!props.isOpen) {
      resetComposerState();
    }
  }, [props.isOpen]);

  useEffect(() => {
    if (!props.isOpen || !props.initialDraft) {
      return;
    }

    resetComposerState();
    setDraftExercises(props.initialDraft.exercises);
    setElapsedSeconds((props.initialDraft.durationMin ?? 0) * 60);
    setDraftDurationMin(props.initialDraft.durationMin);
    setDraftEndedAt(props.initialDraft.endedAt ?? null);
    setDraftNote(props.initialDraft.note ?? "");
    setDraftPerformedAt(props.initialDraft.performedAt);
    setDraftStartedAt(props.initialDraft.startedAt ?? null);
    setIsRunning(false);
  }, [props.initialDraft, props.isOpen]);

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
            {isActiveSession ? (
              <TrainingSessionTimer
                elapsedSeconds={elapsedSeconds}
                isRunning={isRunning}
                onToggleRunning={handleToggleSessionRunning}
              />
            ) : (
              <button
                onClick={() => setIsTimeEditorOpen(true)}
                style={intakeTimeButtonStyle(theme)}
                type="button"
              >
                <span>{"\u8bad\u7ec3\u65f6\u95f4"}</span>
                <strong>
                  {formatTrainingTimeSummary({
                    durationMin: draftDurationMin,
                    endedAt: draftEndedAt,
                    performedAt: draftPerformedAt,
                    startedAt: draftStartedAt,
                  })}
                </strong>
              </button>
            )}

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

        <main onClick={collapseExpandedExercises} style={bodyStyle(Boolean(restTimer))}>
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
                  onResolveCandidate={handleResolveCandidate}
                  onStartRestTimer={handleOpenRestTimer}
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

          <label onClick={(event) => event.stopPropagation()} style={noteEditorStyle(theme)}>
            {"\u5907\u6ce8"}
            <textarea
              onChange={(event) => setDraftNote(event.target.value)}
              placeholder={"\u672c\u6b21\u8bad\u7ec3\u5907\u6ce8"}
              style={noteTextareaStyle(theme)}
              value={draftNote}
            />
          </label>
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
            onConfirmDuration={handleConfirmRestTimerDuration}
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
                    openRestTimerSelector(pendingRestTimerRequest);
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

        {isTimeEditorOpen ? (
          <TrainingTimeEditor
            endedAt={draftEndedAt}
            onClose={() => setIsTimeEditorOpen(false)}
            onSave={(nextValue) => {
              setDraftStartedAt(nextValue.startedAt);
              setDraftEndedAt(nextValue.endedAt);
              setDraftDurationMin(nextValue.durationMin);
              if (nextValue.startedAt) {
                setDraftPerformedAt(nextValue.startedAt);
              }
              setIsTimeEditorOpen(false);
            }}
            performedAt={draftPerformedAt}
            startedAt={draftStartedAt}
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
            categoryLabel: getDisplayExerciseCategoryLabel(exercise),
            exercise,
            exerciseId: exercise.id,
            loadType: getExerciseLoadType(exercise),
            matchStatus: "matched",
            name: getExerciseDisplayName(exercise),
          };
        });
      }

      const alreadyExists = currentValue.some((item) => item.exerciseId === exercise.id);

      if (alreadyExists) {
        setDuplicateNotice("这个动作已经在本次训练中");
        return currentValue;
      }

      setDuplicateNotice(null);
      return [...currentValue, createDraftExercise(exercise, getDisplayExerciseCategoryLabel(exercise))];
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

  function handleToggleSessionRunning(): void {
    setIsRunning((currentValue) => {
      if (!currentValue && !draftStartedAt) {
        setDraftStartedAt(new Date().toISOString());
      }

      return !currentValue;
    });
  }

  function collapseExpandedExercises(): void {
    setDraftExercises((currentValue) => {
      return currentValue.map((draftExercise) => {
        if (!draftExercise.isExpanded) {
          return draftExercise;
        }

        return {
          ...draftExercise,
          isExpanded: false,
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
              restSeconds:
                field === "weightKg" || field === "reps" ? null : setDraft.restSeconds,
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

            if (!canCompleteSet(setDraft, draftExercise)) {
              return {
                ...setDraft,
                completed: false,
                restSeconds: null,
              };
            }

            return {
              ...setDraft,
              completed: !setDraft.completed,
              restSeconds: setDraft.completed ? null : setDraft.restSeconds,
            };
          }),
        };
      });
    });
  }

  function handleOpenRestTimer(setId: string): void {
    if (
      restTimer &&
      (restTimer.status === "running" ||
        restTimer.status === "paused" ||
        restTimer.status === "selecting") &&
      (restTimer.remainingSeconds > 0 || restTimer.status === "selecting")
    ) {
      setPendingRestTimerRequest(setId);
      return;
    }

    openRestTimerSelector(setId);
  }

  function openRestTimerSelector(setId: string): void {
    setRestTimer({
      isRunning: false,
      remainingSeconds: 0,
      sourceSetId: setId,
      status: "selecting",
      totalSeconds: 0,
    });
  }

  function handleConfirmRestTimerDuration(seconds: number): void {
    const safeSeconds = Math.max(1, Math.floor(seconds));
    const sourceSetId = restTimer?.sourceSetId;

    if (!sourceSetId) {
      return;
    }

    setDraftExercises((currentValue) => {
      return currentValue.map((draftExercise) => {
        return {
          ...draftExercise,
          sets: draftExercise.sets.map((setDraft) => {
            if (setDraft.id !== sourceSetId) {
              return setDraft;
            }

            return {
              ...setDraft,
              completed: true,
              restSeconds: safeSeconds,
            };
          }),
        };
      });
    });

    setRestTimer({
      isRunning: true,
      remainingSeconds: safeSeconds,
      sourceSetId,
      status: "running",
      totalSeconds: safeSeconds,
    });
  }

  function handleToggleRestTimerRunning(): void {
    setRestTimer((currentValue) => {
      if (
        !currentValue ||
        currentValue.status === "finished" ||
        currentValue.status === "selecting"
      ) {
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

    if (mode === "edit_existing") {
      await handleCompleteEdit();
      return;
    }

    const saveTime = new Date();
    const activeStartedAt = draftStartedAt;
    const payload = buildWorkoutRequestFromDraft({
      draftExercises,
      durationMinutes:
        mode === "create_from_intake" ? draftDurationMin : undefined,
      elapsedSeconds,
      endedAt: activeStartedAt ? saveTime.toISOString() : draftEndedAt,
      notes: draftNote,
      performedAt:
        mode === "create_from_intake" && draftPerformedAt
          ? new Date(draftPerformedAt)
          : activeStartedAt
            ? new Date(activeStartedAt)
            : saveTime,
      startedAt: activeStartedAt ?? draftStartedAt,
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

  async function handleCompleteEdit(): Promise<void> {
    if (!props.token || !props.initialDraft?.originalWorkout) {
      setErrorMessage("Please fix the highlighted workout fields and try again.");
      return;
    }

    const editDraft: TrainingSessionInitialDraft = {
      ...props.initialDraft,
      durationMin: draftDurationMin,
      endedAt: draftEndedAt,
      exercises: draftExercises,
      note: draftNote,
      performedAt: draftPerformedAt ?? props.initialDraft.performedAt,
      startedAt: draftStartedAt,
    };
    const plan = buildWorkoutEditPlan(props.initialDraft.originalWorkout, editDraft);

    setDuplicateNotice(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (plan.workoutPatch) {
        await updateWorkout(props.token, props.initialDraft.originalWorkout.id, plan.workoutPatch);
      }

      for (const setId of plan.setDeletes) {
        await deleteWorkoutSet(props.token, setId);
      }

      for (const patch of plan.setPatches) {
        await updateWorkoutSet(props.token, patch.setId, patch.input);
      }

      for (const add of plan.setAdds) {
        await addWorkoutSet(props.token, props.initialDraft.originalWorkout.id, add);
      }

      resetComposerState();
      await props.onCreated?.();
    } catch (error) {
      setErrorMessage(getReadableErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleResolveCandidate(exerciseId: string): void {
    const exercise = props.exerciseLibraryProps.exercises.find(
      (item) => item.id === exerciseId,
    );

    if (!exercise) {
      setDuplicateNotice("\u8bf7\u6253\u5f00\u52a8\u4f5c\u5e93\u91cd\u65b0\u9009\u62e9\u8be5\u52a8\u4f5c\u3002");
      return;
    }

    setDraftExercises((currentValue) => {
      const targetExercise = currentValue.find((draftExercise) =>
        draftExercise.candidateExercises.some(
          (candidate) => candidate.exerciseId === exerciseId,
        ),
      );

      if (!targetExercise) {
        return currentValue;
      }

      const alreadyExists = currentValue.some((draftExercise) => {
        return (
          draftExercise.id !== targetExercise.id &&
          draftExercise.matchStatus === "matched" &&
          draftExercise.exerciseId === exercise.id
        );
      });

      if (alreadyExists) {
        setDuplicateNotice("这个动作已经在本次训练中。");
        return currentValue;
      }

      setDuplicateNotice(null);
      return currentValue.map((draftExercise) => {
        if (draftExercise.id !== targetExercise.id) {
          return draftExercise;
        }

        return {
          ...draftExercise,
          categoryLabel: getDisplayExerciseCategoryLabel(exercise),
          exercise,
          exerciseId: exercise.id,
          loadType: getExerciseLoadType(exercise),
          matchStatus: "matched",
          name: getExerciseDisplayName(exercise),
        };
      });
    });
  }

  function resetComposerState(): void {
    setDraftExercises([]);
    setDuplicateNotice(null);
    setDraftDurationMin(null);
    setDraftEndedAt(null);
    setDraftNote("");
    setDraftPerformedAt(null);
    setDraftStartedAt(null);
    setElapsedSeconds(0);
    setErrorMessage(null);
    setIsLibraryOpen(false);
    setIsRunning(false);
    setIsTimeEditorOpen(false);
    setPendingExerciseRemovalId(null);
    setPendingRestTimerRequest(null);
    setReplacingDraftExerciseId(null);
    setRestTimer(null);
  }
}

function canCompleteSet(setDraft: DraftSet, draftExercise: DraftExercise): boolean {
  return isDraftSetValid(setDraft, draftExercise);
}

function TrainingTimeEditor(props: {
  endedAt: string | null;
  onClose: () => void;
  onSave: (value: {
    durationMin: number | null;
    endedAt: string | null;
    startedAt: string | null;
  }) => void;
  performedAt: string | null;
  startedAt: string | null;
}) {
  const { theme } = useTheme();
  const [startValue, setStartValue] = useState(
    formatDateTimeLocalValue(props.startedAt ?? props.performedAt),
  );
  const [endValue, setEndValue] = useState(formatDateTimeLocalValue(props.endedAt));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const durationMin = getDurationMinutesFromLocalValues(startValue, endValue);

  return (
    <ActionSheet
      description={formatTrainingTimeSummary({
        durationMin,
        endedAt: parseDateTimeLocalValue(endValue),
        performedAt: props.performedAt,
        startedAt: parseDateTimeLocalValue(startValue),
      })}
      footer={
        <div style={confirmActionRowStyle}>
          <Button onClick={props.onClose} type="button" variant="secondary">
            {"\u53d6\u6d88"}
          </Button>
          <Button onClick={handleSave} type="button">
            {"\u4fdd\u5b58\u65f6\u95f4"}
          </Button>
        </div>
      }
      onClose={props.onClose}
      open
      title="训练时间"
    >

        <label style={timeEditorLabelStyle(theme)}>
          {"\u5f00\u59cb\u65f6\u95f4"}
          <input
            onChange={(event) => {
              setStartValue(event.target.value);
              setErrorMessage(null);
            }}
            style={timeEditorInputStyle(theme)}
            type="datetime-local"
            value={startValue}
          />
        </label>

        <label style={timeEditorLabelStyle(theme)}>
          {"\u7ed3\u675f\u65f6\u95f4"}
          <input
            onChange={(event) => {
              setEndValue(event.target.value);
              setErrorMessage(null);
            }}
            style={timeEditorInputStyle(theme)}
            type="datetime-local"
            value={endValue}
          />
        </label>

        <p style={timeEditorSummaryStyle(theme)}>
          {durationMin === null
            ? "\u8bad\u7ec3\u65f6\u957f\uff1a\u672a\u8bbe\u7f6e"
            : `\u8bad\u7ec3\u65f6\u957f\uff1a${durationMin} \u5206\u949f`}
        </p>

        {errorMessage ? (
          <p style={timeEditorErrorStyle(theme)}>{errorMessage}</p>
        ) : null}

    </ActionSheet>
  );

  function handleSave(): void {
    if (!startValue && !endValue) {
      props.onSave({
        durationMin: null,
        endedAt: null,
        startedAt: null,
      });
      return;
    }

    if (!startValue || !endValue) {
      setErrorMessage("\u8bf7\u540c\u65f6\u586b\u5199\u5f00\u59cb\u548c\u7ed3\u675f\u65f6\u95f4\u3002");
      return;
    }

    const startedAt = parseDateTimeLocalValue(startValue);
    const endedAt = parseDateTimeLocalValue(endValue);

    if (!startedAt || !endedAt) {
      setErrorMessage("\u8bf7\u586b\u5199\u6709\u6548\u7684\u8bad\u7ec3\u65f6\u95f4\u3002");
      return;
    }

    const startedAtMs = new Date(startedAt).getTime();
    const endedAtMs = new Date(endedAt).getTime();

    if (startedAtMs >= endedAtMs) {
      setErrorMessage("\u7ed3\u675f\u65f6\u95f4\u5fc5\u987b\u665a\u4e8e\u5f00\u59cb\u65f6\u95f4\u3002");
      return;
    }

    props.onSave({
      durationMin: Math.max(1, Math.round((endedAtMs - startedAtMs) / 60000)),
      endedAt,
      startedAt,
    });
  }
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

function formatTrainingTimeSummary(input: {
  durationMin: number | null;
  endedAt: string | null | undefined;
  performedAt: string | null | undefined;
  startedAt: string | null | undefined;
}): string {
  if (input.startedAt && input.endedAt) {
    return `${formatTimeOnly(input.startedAt)} - ${formatTimeOnly(input.endedAt)}`;
  }

  if (input.durationMin !== null) {
    return `${input.durationMin} \u5206\u949f`;
  }

  if (input.performedAt) {
    return "\u4ec5\u8bb0\u5f55\u4e86\u8bad\u7ec3\u65e5\u671f";
  }

  return "\u672a\u8bbe\u7f6e";
}

function formatTimeOnly(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTimeLocalValue(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getDurationMinutesFromLocalValues(
  startedAtValue: string,
  endedAtValue: string,
): number | null {
  const startedAt = parseDateTimeLocalValue(startedAtValue);
  const endedAt = parseDateTimeLocalValue(endedAtValue);

  if (!startedAt || !endedAt) {
    return null;
  }

  const durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();

  return durationMs > 0 ? Math.max(1, Math.round(durationMs / 60000)) : null;
}

const composerStyle: React.CSSProperties = {
  height: "100dvh",
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
    height: "100%",
    inset: 0,
    overflow: "hidden",
    padding:
      "max(16px, env(safe-area-inset-top, 16px)) 16px calc(24px + env(safe-area-inset-bottom, 0px))",
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

function intakeTimeButtonStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    color: theme.colors.tx,
    cursor: "pointer",
    display: "grid",
    gap: 6,
    padding: 0,
    textAlign: "left",
  };
}

function noteEditorStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    display: "grid",
    fontSize: 12,
    fontWeight: 700,
    gap: 8,
  };
}

function noteTextareaStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx,
    font: "inherit",
    minHeight: 76,
    padding: "10px 12px",
    resize: "vertical",
  };
}

function timeEditorLabelStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    display: "grid",
    fontSize: 12,
    fontWeight: 700,
    gap: 8,
  };
}

function timeEditorInputStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx,
    padding: "10px 12px",
  };
}

function timeEditorSummaryStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "4px 0 0",
  };
}

function timeEditorErrorStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.red,
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
  };
}

function bodyStyle(hasRestTimer: boolean): React.CSSProperties {
  return {
    alignContent: "start",
    display: "grid",
    flex: 1,
    gap: 16,
    minHeight: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
    paddingBottom: hasRestTimer
      ? "calc(176px + env(safe-area-inset-bottom, 0px))"
      : "calc(120px + env(safe-area-inset-bottom, 0px))",
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
  zIndex: 210,
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
