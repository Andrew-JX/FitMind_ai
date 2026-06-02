import type { DraftSet, EffortLevel } from "./training-session-draft";

import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useTheme } from "../../theme/ThemeContext";

const EFFORT_OPTIONS: Array<{
  label: string;
  tone: "easy" | "normal" | "hard";
  value: EffortLevel;
}> = [
  { label: "简单", tone: "easy", value: "easy" },
  { label: "正常", tone: "normal", value: "normal" },
  { label: "困难", tone: "hard", value: "hard" },
];

export interface TrainingSessionSetRowProps {
  canComplete: boolean;
  canDelete: boolean;
  index: number;
  onCopy: () => void;
  onDelete: () => void;
  onStartRestTimer?: (() => void) | undefined;
  onToggleCompleted: () => void;
  onUpdate: <TField extends keyof DraftSet>(field: TField, value: DraftSet[TField]) => void;
  setDraft: DraftSet;
  showCompletion?: boolean | undefined;
}

export function TrainingSessionSetRow(props: TrainingSessionSetRowProps) {
  const { theme } = useTheme();
  const showCompletion = props.showCompletion ?? true;
  const restLabel = props.setDraft.restSeconds ? formatRestLabel(props.setDraft.restSeconds) : null;

  return (
    <div style={rowStyle(theme, showCompletion ? props.setDraft.completed : true)}>
      <div style={rowHeaderStyle}>
        <strong style={{ fontSize: 13 }}>第 {props.index + 1} 组</strong>
        <div style={rowActionStyle}>
          {props.onStartRestTimer ? (
            <button
              disabled={!props.canComplete}
              onClick={props.onStartRestTimer}
              style={miniActionStyle(theme, !props.canComplete)}
              type="button"
            >
              休息倒计时
            </button>
          ) : null}
          <button onClick={props.onCopy} style={miniActionStyle(theme)} type="button">
            复制本组
          </button>
          <button
            disabled={!props.canDelete}
            onClick={props.onDelete}
            style={miniActionStyle(theme, !props.canDelete)}
            type="button"
          >
            删除本组
          </button>
        </div>
      </div>

      <div style={metricGridStyle}>
        <label style={labelStyle(theme)}>
          重量（公斤）
          <Input
            min="0"
            onChange={(event) => props.onUpdate("weightKg", event.target.value)}
            step="0.01"
            type="number"
            value={props.setDraft.weightKg}
          />
        </label>
        <label style={labelStyle(theme)}>
          次数
          <Input
            min="0"
            onChange={(event) => props.onUpdate("reps", event.target.value)}
            type="number"
            value={props.setDraft.reps}
          />
        </label>
      </div>

      <div style={effortWrapStyle}>
        <span style={labelCaptionStyle(theme)}>体感</span>
        <div style={effortRowStyle}>
          {EFFORT_OPTIONS.map((option) => {
            const isActive = option.value === props.setDraft.effort;

            return (
              <button
                key={option.value}
                onClick={() => props.onUpdate("effort", option.value)}
                style={effortButtonStyle(theme, option.tone, isActive)}
                type="button"
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {showCompletion ? (
        <div style={completeRowStyle(Boolean(restLabel))}>
          {restLabel ? <span style={restInfoStyle(theme)}>{restLabel}</span> : <span />}
          <Button
            disabled={!props.canComplete}
            onClick={props.onToggleCompleted}
            style={completeButtonStyle(props.setDraft.completed)}
            type="button"
            variant={props.setDraft.completed ? "primary" : "secondary"}
          >
            {props.setDraft.completed ? "✓ 已完成" : "□ 标记完成"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function formatRestLabel(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `休息 ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function rowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isCompleted: boolean,
): React.CSSProperties {
  return {
    backgroundColor: isCompleted ? theme.colors.surf : theme.colors.surf2,
    border: `1px solid ${isCompleted ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    display: "grid",
    gap: 12,
    padding: 12,
    transition: "border-color 150ms ease, transform 150ms ease, opacity 150ms ease",
  };
}

const rowHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const rowActionStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  justifyContent: "flex-end",
};

function miniActionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  disabled = false,
): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    color: disabled ? theme.colors.tx3 : theme.colors.tx2,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12,
    opacity: disabled ? 0.56 : 1,
    padding: 0,
  };
}

const metricGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

function labelStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    display: "grid",
    fontSize: 12,
    gap: 8,
  };
}

function labelCaptionStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    fontWeight: 600,
  };
}

const effortWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const effortRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};

function effortButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  tone: "easy" | "normal" | "hard",
  isActive: boolean,
): React.CSSProperties {
  const color =
    tone === "easy"
      ? theme.colors.green
      : tone === "hard"
        ? theme.colors.red
        : theme.colors.orange;

  return {
    backgroundColor: isActive
      ? color
      : theme.isDark
        ? "rgba(255,255,255,0.03)"
        : "rgba(0,0,0,0.02)",
    border: `1px solid ${isActive ? color : theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: isActive ? "#ffffff" : color,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    padding: "10px 8px",
  };
}

function completeRowStyle(hasRestLabel: boolean): React.CSSProperties {
  return {
    alignItems: "center",
    display: "flex",
    gap: 12,
    justifyContent: hasRestLabel ? "space-between" : "flex-end",
  };
}

function restInfoStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    fontWeight: 600,
  };
}

function completeButtonStyle(isCompleted: boolean): React.CSSProperties {
  return {
    minWidth: 110,
    transform: isCompleted ? "scale(1.01)" : "scale(1)",
  };
}
