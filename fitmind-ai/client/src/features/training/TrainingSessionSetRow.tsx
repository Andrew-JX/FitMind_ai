import type { DraftSet, EffortLevel } from "./training-session-draft";

import { Input } from "../../components/Input";
import { useTheme } from "../../theme/ThemeContext";
import { accentAlpha } from "../../theme/tokens";

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
  onUpdate: <TField extends keyof DraftSet>(
    field: TField,
    value: DraftSet[TField],
  ) => void;
  setDraft: DraftSet;
  showCompletion?: boolean | undefined;
}

export function TrainingSessionSetRow(props: TrainingSessionSetRowProps) {
  const { theme } = useTheme();
  const showCompletion = props.showCompletion ?? true;
  const restLabel = props.setDraft.restSeconds
    ? formatRestLabel(props.setDraft.restSeconds)
    : null;

  return (
    <div
      style={rowStyle(theme, showCompletion ? props.setDraft.completed : true)}
    >
      <div style={rowHeaderStyle}>
        <span style={rowLabelStyle}>
          <span style={setIndexStyle(theme, props.setDraft.completed)}>
            第 {props.index + 1} 组
          </span>
          <button
            aria-pressed={props.setDraft.isWarmup}
            onClick={() => props.onUpdate("isWarmup", !props.setDraft.isWarmup)}
            style={setTypeToggleStyle(theme, props.setDraft.isWarmup)}
            type="button"
          >
            {props.setDraft.isWarmup ? "热身组" : "正式组"}
          </button>
          {restLabel ? (
            <span style={restInfoStyle(theme)}>{restLabel}</span>
          ) : null}
        </span>
        <span style={rowActionStyle}>
          {props.onStartRestTimer ? (
            <button
              disabled={!props.canComplete}
              onClick={props.onStartRestTimer}
              style={miniActionStyle(theme, !props.canComplete)}
              type="button"
            >
              休息
            </button>
          ) : null}
          <button
            onClick={props.onCopy}
            style={miniActionStyle(theme)}
            title="复制本组"
            type="button"
          >
            复制
          </button>
          {showCompletion ? (
            <button
              disabled={!props.canComplete}
              onClick={props.onToggleCompleted}
              style={doneActionStyle(
                theme,
                props.setDraft.completed,
                !props.canComplete,
              )}
              type="button"
            >
              {props.setDraft.completed ? "✓ 已完成" : "完成"}
            </button>
          ) : null}
          {props.canDelete ? (
            <button
              onClick={props.onDelete}
              style={deleteActionStyle(theme)}
              type="button"
            >
              删除
            </button>
          ) : null}
        </span>
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
    animation: isCompleted
      ? "fmjelly 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)"
      : "none",
    background: isCompleted ? accentAlpha(theme, 0.08) : theme.colors.soft,
    border: `1px solid ${isCompleted ? accentAlpha(theme, 0.35) : theme.colors.bdr}`,
    borderRadius: 12,
    display: "grid",
    gap: 8,
    padding: 10,
    transition:
      "background 300ms ease, border-color 300ms ease, opacity 150ms ease",
  };
}

const rowHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const rowLabelStyle: React.CSSProperties = {
  alignItems: "baseline",
  display: "inline-flex",
  gap: 8,
  minWidth: 0,
};

/**
 * 正式组 / 热身组 toggle (design set-type control). Drop sets (递减组) are a
 * separate backend feature and intentionally not offered here yet.
 *
 * @param theme - Active theme tokens
 * @param isWarmup - Whether this set is currently marked as a warm-up
 * @returns The pill toggle style, tinted blue when warm-up
 */
function setTypeToggleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isWarmup: boolean,
): React.CSSProperties {
  return {
    background: isWarmup ? "rgba(74,158,255,0.14)" : theme.colors.divider,
    border: "none",
    borderRadius: 6,
    color: isWarmup ? theme.colors.blue : theme.colors.tx2,
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 700,
    padding: "3px 7px",
    whiteSpace: "nowrap",
  };
}

const rowActionStyle: React.CSSProperties = {
  alignItems: "center",
  display: "inline-flex",
  flex: "0 0 auto",
  gap: 5,
};

/** Design: compact filled action chip in the set-row header (休息 / 复制). */
function miniActionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  disabled = false,
): React.CSSProperties {
  return {
    background: theme.colors.divider,
    border: "none",
    borderRadius: 8,
    color: theme.colors.tx2,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 11,
    opacity: disabled ? 0.56 : 1,
    padding: "6px 9px",
  };
}

/**
 * Design: the set-completion toggle lives in the header action strip, tinted
 * accent-green once the set is done.
 *
 * @param theme - Active theme tokens
 * @param isCompleted - Whether this set is marked complete
 * @param disabled - Whether completion is currently unavailable
 * @returns The done-chip style
 */
function doneActionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isCompleted: boolean,
  disabled: boolean,
): React.CSSProperties {
  return {
    background: isCompleted ? theme.colors.ac : theme.colors.divider,
    border: "none",
    borderRadius: 8,
    color: isCompleted ? theme.colors.acText : theme.colors.tx2,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 11,
    fontWeight: 700,
    opacity: disabled ? 0.56 : 1,
    padding: "6px 9px",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
  };
}

/** Design: borderless muted delete affordance at the end of the strip. */
function deleteActionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    color: theme.colors.tx3,
    cursor: "pointer",
    fontSize: 11,
    padding: "6px 4px",
  };
}

/** Set index label; turns accent-green when the set is complete (design). */
function setIndexStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isCompleted: boolean,
): React.CSSProperties {
  return {
    color: isCompleted ? theme.colors.ac : theme.colors.tx,
    fontSize: 11,
    fontWeight: 700,
    transition: "color 0.3s ease",
    whiteSpace: "nowrap",
  };
}

const metricGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

/** Design: 10px muted caption stacked above each metric input. */
function labelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    display: "grid",
    fontSize: 10,
    gap: 4,
  };
}

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
    backgroundColor: isActive ? color : theme.colors.soft,
    border: `1px solid ${isActive ? color : theme.colors.bdr}`,
    borderRadius: 8,
    color: isActive ? theme.colors.acText : color,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
    padding: "7px 0",
    transition: "all 0.2s ease",
  };
}

/** Design: rest countdown shown inline in the header, accent-green tabular. */
function restInfoStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.ac,
    fontSize: 11,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  };
}
