import { useState } from "react";

import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Input } from "../../components/Input";
import { useTheme } from "../../theme/ThemeContext";

const REST_TIMER_OPTIONS = [30, 60, 90, 120] as const;

export type RestTimerStatus = "selecting" | "running" | "paused" | "finished";

export interface RestTimerState {
  isRunning: boolean;
  remainingSeconds: number;
  sourceSetId?: string | undefined;
  status: RestTimerStatus;
  totalSeconds: number;
}

export interface TrainingSessionRestTimerProps {
  onClose: () => void;
  onConfirmDuration: (seconds: number) => void;
  onToggleRunning: () => void;
  timer: RestTimerState;
}

export function TrainingSessionRestTimer(props: TrainingSessionRestTimerProps) {
  const { theme } = useTheme();
  const [customRestSeconds, setCustomRestSeconds] = useState("150");
  const progress =
    props.timer.totalSeconds > 0
      ? Math.max(0, Math.min(1, props.timer.remainingSeconds / props.timer.totalSeconds))
      : 0;

  return (
    <div onClick={props.onClose} style={backdropStyle(theme)}>
      <section
        onClick={(event) => event.stopPropagation()}
        style={cardStyle(theme)}
      >
        {props.timer.status === "selecting" ? (
          <>
            <header style={headerStyle}>
              <div style={titleWrapStyle}>
                <Icon name="clock" size={18} />
                <strong style={titleStyle(theme)}>设置休息倒计时</strong>
              </div>
              <button
                aria-label="关闭休息倒计时"
                onClick={props.onClose}
                style={closeButtonStyle(theme)}
                type="button"
              >
                ×
              </button>
            </header>

            <div style={optionGridStyle}>
              {REST_TIMER_OPTIONS.map((seconds) => (
                <button
                  key={seconds}
                  onClick={() => props.onConfirmDuration(seconds)}
                  style={optionButtonStyle(theme)}
                  type="button"
                >
                  {seconds} 秒
                </button>
              ))}
            </div>

            <div style={customRowStyle}>
              <Input
                min="1"
                onChange={(event) => setCustomRestSeconds(event.target.value)}
                type="number"
                value={customRestSeconds}
              />
              <Button
                disabled={!isValidRestSeconds(customRestSeconds)}
                onClick={() => props.onConfirmDuration(Number.parseInt(customRestSeconds, 10))}
                type="button"
                variant="secondary"
              >
                自定义
              </Button>
            </div>
          </>
        ) : (
          <>
            <header style={headerStyle}>
              <div style={titleWrapStyle}>
                <Icon name={props.timer.status === "finished" ? "check" : "clock"} size={18} />
                <strong style={titleStyle(theme)}>
                  {props.timer.status === "finished"
                    ? "休息结束，可以开始下一组了"
                    : props.timer.status === "paused"
                      ? "休息已暂停"
                      : "休息中"}
                </strong>
              </div>
              <button
                aria-label="关闭休息倒计时"
                onClick={props.onClose}
                style={closeButtonStyle(theme)}
                type="button"
              >
                ×
              </button>
            </header>

            <div style={countdownWrapStyle}>
              <strong style={countdownStyle(theme)}>
                {formatRestTime(props.timer.remainingSeconds)}
              </strong>
              <div style={progressTrackStyle(theme)}>
                <div style={progressFillStyle(theme, progress)} />
              </div>
            </div>

            <div style={actionRowStyle}>
              {props.timer.status !== "finished" ? (
                <Button onClick={props.onToggleRunning} type="button" variant="secondary">
                  {props.timer.status === "paused" ? "继续" : "暂停"}
                </Button>
              ) : null}
              <Button onClick={props.onClose} type="button" variant="secondary">
                关闭
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function isValidRestSeconds(value: string): boolean {
  const seconds = Number.parseInt(value, 10);

  return Number.isInteger(seconds) && seconds > 0;
}

function formatRestTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function backdropStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.isDark ? "rgba(0, 0, 0, 0.52)" : "rgba(0, 0, 0, 0.28)",
    display: "flex",
    inset: 0,
    justifyContent: "center",
    padding: 20,
    position: "absolute",
    zIndex: 240,
  };
}

function cardStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr2}`,
    borderRadius: theme.radius.card,
    boxShadow: theme.shadows.card,
    display: "grid",
    gap: 16,
    maxWidth: 320,
    padding: 18,
    width: "100%",
  };
}

const headerStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const titleWrapStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 10,
};

function titleStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 15,
    lineHeight: 1.4,
  };
}

function closeButtonStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    color: theme.colors.tx3,
    cursor: "pointer",
    fontSize: 22,
    lineHeight: 1,
    padding: 0,
  };
}

const optionGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

function optionButtonStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    padding: "12px 10px",
  };
}

const customRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "minmax(0, 1fr) auto",
};

const countdownWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

function countdownStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 36,
    lineHeight: 1,
    textAlign: "center",
  };
}

function progressTrackStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
  };
}

function progressFillStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  progress: number,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.orange,
    borderRadius: 999,
    height: "100%",
    transition: "width 180ms ease",
    width: `${progress * 100}%`,
  };
}

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  justifyContent: "flex-end",
};
