import { Button } from "../../components/Button";
import { useTheme } from "../../theme/ThemeContext";

export interface TrainingSessionTimerProps {
  elapsedSeconds: number;
  isRunning: boolean;
  onToggleRunning: () => void;
}

export function TrainingSessionTimer(props: TrainingSessionTimerProps) {
  const { theme } = useTheme();

  return (
    <div style={timerWrapStyle}>
      <div style={timerLabelStyle(theme)}>训练计时</div>
      <div style={timerValueStyle(theme)}>{formatElapsedTime(props.elapsedSeconds)}</div>
      <Button onClick={props.onToggleRunning} type="button" variant="secondary">
        {props.isRunning ? "暂停" : "开始"}
      </Button>
    </div>
  );
}

function formatElapsedTime(elapsedSeconds: number): string {
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => `${value}`.padStart(2, "0"))
    .join(":");
}

const timerWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  justifyItems: "start",
};

function timerLabelStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };
}

function timerValueStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: "0.04em",
  };
}
