import { useEffect, useState } from "react";

import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import { TrainingSessionEmptyState } from "./TrainingSessionEmptyState";
import { TrainingSessionTimer } from "./TrainingSessionTimer";
import { useWorkoutForm } from "./use-workout-form";

export interface TrainingSessionComposerProps {
  isOpen: boolean;
  onCancel: () => void;
  onCreated?: (() => Promise<void>) | undefined;
  token: string | null;
}

export function TrainingSessionComposer(props: TrainingSessionComposerProps) {
  const { theme } = useTheme();
  const form = useWorkoutForm(props.token);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

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
      setElapsedSeconds(0);
      setIsRunning(false);
    }
  }, [props.isOpen]);

  if (!props.isOpen) {
    return null;
  }

  const hasValidSetDraft = form.setDrafts.some((setDraft) => {
    return Boolean(
      setDraft.exerciseId.trim() &&
        setDraft.reps.trim() &&
        setDraft.weightKg.trim(),
    );
  });

  return (
    <section style={composerStyle}>
      <div style={backdropStyle(theme)} />
      <div style={panelStyle(theme)}>
        <header style={headerStyle}>
          <div style={headerTopRowStyle}>
            <Button onClick={handleCancel} type="button" variant="secondary">
              取消
            </Button>
            <Button
              disabled={!hasValidSetDraft || form.isSubmitting}
              onClick={() => void handleComplete()}
              type="button"
            >
              {form.isSubmitting ? "保存中..." : "完成"}
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
              {!hasValidSetDraft ? (
                <p style={statusCopyStyle(theme)}>请先添加至少一个动作和训练组。</p>
              ) : null}
            </div>
          </div>
        </header>

        <main style={bodyStyle}>
          <TrainingSessionEmptyState />

          <div style={placeholderBlockStyle(theme)}>
            <strong style={{ fontSize: 14 }}>Batch 1 说明</strong>
            <p style={placeholderCopyStyle(theme)}>
              本批先切换为全屏训练会话壳层，添加动作入口会在后续批次接入真实动作库与训练组编辑。
            </p>
          </div>

          {form.errorMessage ? (
            <StateNotice
              description={translateMessage(form.errorMessage)}
              title="训练保存失败"
              tone="error"
            />
          ) : null}
        </main>

        <div style={fabWrapStyle}>
          <button
            aria-label="添加动作（即将上线）"
            disabled
            style={fabStyle(theme)}
            type="button"
          >
            <Icon name="plus" size={24} />
          </button>
        </div>
      </div>
    </section>
  );

  function handleCancel(): void {
    setElapsedSeconds(0);
    setIsRunning(false);
    props.onCancel();
  }

  async function handleComplete(): Promise<void> {
    if (!hasValidSetDraft) {
      return;
    }

    form.setDurationMinutes(`${Math.floor(elapsedSeconds / 60)}`);
    const createdWorkout = await form.submitWorkout();

    if (createdWorkout && props.onCreated) {
      setElapsedSeconds(0);
      setIsRunning(false);
      await props.onCreated();
    }
  }
}

function translateMessage(message: string): string {
  if (message === "You must be signed in to create a workout.") {
    return "请先登录后再创建训练。";
  }

  if (message === "Please fix the highlighted workout fields and try again.") {
    return "请先修正训练内容后再保存。";
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
    gridTemplateRows: "auto 1fr",
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
  alignContent: "center",
  display: "grid",
  gap: 16,
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
    maxWidth: 160,
    textAlign: "right",
  };
}

function placeholderBlockStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    display: "grid",
    gap: 8,
    padding: 16,
  };
}

function placeholderCopyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.7,
    margin: 0,
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
    cursor: "not-allowed",
    display: "inline-flex",
    height: 56,
    justifyContent: "center",
    opacity: 0.56,
    width: 56,
  };
}
