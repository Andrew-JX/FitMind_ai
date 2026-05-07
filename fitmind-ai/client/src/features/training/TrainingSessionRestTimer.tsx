import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeContext";

export type RestTimerStatus = "running" | "paused" | "finished";

export interface RestTimerState {
  isRunning: boolean;
  remainingSeconds: number;
  sourceSetId?: string | undefined;
  status: RestTimerStatus;
  totalSeconds: number;
}

export interface TrainingSessionRestTimerProps {
  onClose: () => void;
  onSkip: () => void;
  onToggleRunning: () => void;
  timer: RestTimerState;
}

export function TrainingSessionRestTimer(props: TrainingSessionRestTimerProps) {
  const { theme } = useTheme();
  const progress =
    props.timer.totalSeconds > 0
      ? Math.max(0, Math.min(1, props.timer.remainingSeconds / props.timer.totalSeconds))
      : 0;

  if (props.timer.status === "finished") {
    return (
      <aside style={timerBarStyle(theme, "finished")}>
        <div style={timerMainStyle}>
          <Icon name="check" size={16} />
          <strong style={timerTitleStyle(theme)}>休息结束，可以开始下一组了</strong>
        </div>
        <Button onClick={props.onClose} style={timerActionButtonStyle} type="button" variant="secondary">
          关闭
        </Button>
      </aside>
    );
  }

  return (
    <aside style={timerBarStyle(theme, props.timer.status)}>
      <div style={timerTextWrapStyle}>
        <div style={timerMainStyle}>
          <Icon name="clock" size={16} />
          <strong style={timerTitleStyle(theme)}>
            {props.timer.status === "paused" ? "休息已暂停" : "休息中"}{" "}
            {formatRestTime(props.timer.remainingSeconds)}
          </strong>
        </div>
        <div style={progressTrackStyle(theme)}>
          <div style={progressFillStyle(theme, progress)} />
        </div>
      </div>
      <div style={timerActionsStyle}>
        <Button onClick={props.onToggleRunning} style={timerActionButtonStyle} type="button" variant="secondary">
          {props.timer.status === "paused" ? "继续" : "暂停"}
        </Button>
        <Button onClick={props.onSkip} style={timerActionButtonStyle} type="button" variant="secondary">
          跳过
        </Button>
      </div>
    </aside>
  );
}

function formatRestTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function timerBarStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  status: RestTimerStatus,
): React.CSSProperties {
  const semanticColor = status === "finished" ? theme.colors.green : theme.colors.orange;

  return {
    alignItems: "center",
    backgroundColor: theme.colors.surf,
    border: `1px solid ${semanticColor}`,
    borderRadius: theme.radius.card,
    boxShadow: theme.shadows.card,
    color: theme.colors.tx,
    display: "grid",
    gap: 12,
    gridTemplateColumns: status === "finished" ? "minmax(0, 1fr) auto" : "minmax(0, 1fr) auto",
    left: 16,
    padding: 12,
    position: "absolute",
    right: 16,
    bottom: "calc(88px + env(safe-area-inset-bottom, 0px))",
    zIndex: 5,
  };
}

const timerTextWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const timerMainStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  minWidth: 0,
};

function timerTitleStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 13,
    lineHeight: 1.35,
  };
}

function progressTrackStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    borderRadius: 3,
    height: 6,
    overflow: "hidden",
  };
}

function progressFillStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  progress: number,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.orange,
    borderRadius: 3,
    height: "100%",
    transition: "width 180ms ease",
    width: `${progress * 100}%`,
  };
}

const timerActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
};

const timerActionButtonStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "8px 10px",
};
