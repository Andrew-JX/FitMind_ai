import { useEffect, useRef, useState } from "react";

import type { DraftExercise, DraftSet } from "./training-session-draft";

import { Pill } from "../../components/Pill";
import { useTheme } from "../../theme/ThemeContext";
import {
  getExerciseSummary,
  isDraftSetValid,
} from "./training-session-draft";
import {
  formatWeight,
  getEquipmentLabel,
  getExerciseDisplayName,
  getMovementPatternLabel,
  getMuscleCodeLabel,
} from "./exercise-display";
import { TrainingSessionExerciseActions } from "./TrainingSessionExerciseActions";
import { TrainingSessionSetRow } from "./TrainingSessionSetRow";

export interface TrainingSessionExerciseCardProps {
  draftExercise: DraftExercise;
  canMoveDown: boolean;
  canMoveUp: boolean;
  onAddSet: () => void;
  onCopySet: (setId: string) => void;
  onDeleteSet: (setId: string) => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
  onReplace: () => void;
  onResolveCandidate: (exerciseId: string) => void;
  onStartRestTimer: (setId: string) => void;
  onToggleExpanded: () => void;
  onToggleSetCompleted: (setId: string) => void;
  onUpdateSet: <TField extends keyof DraftSet>(
    setId: string,
    field: TField,
    value: DraftSet[TField],
  ) => void;
}

export function TrainingSessionExerciseCard(props: TrainingSessionExerciseCardProps) {
  const { theme } = useTheme();
  const summary = getExerciseSummary(props.draftExercise);
  const primaryMuscles = (props.draftExercise.exercise?.muscles ?? [])
    .filter((muscle) => muscle.is_primary)
    .slice(0, 2)
    .map((muscle) => muscle.code);
  const movementLabel = getMovementPatternLabel(
    props.draftExercise.exercise?.movement_pattern,
  );
  const equipmentLabel = getEquipmentLabel(props.draftExercise.exercise?.equipment);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [isActionLayerOpen, setIsActionLayerOpen] = useState(false);
  const editorScrollerRef = useRef<HTMLDivElement | null>(null);
  const visibleActiveSetId = props.draftExercise.sets.some((setDraft) => {
    return setDraft.id === activeSetId;
  })
    ? activeSetId
    : (props.draftExercise.sets.at(-1)?.id ?? null);

  useEffect(() => {
    if (!props.draftExercise.isExpanded || !editorScrollerRef.current) {
      return;
    }

    editorScrollerRef.current.scrollTo({
      behavior: "smooth",
      top: editorScrollerRef.current.scrollHeight,
    });
  }, [props.draftExercise.isExpanded, props.draftExercise.sets.length]);

  return (
    <section
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) {
          props.onToggleExpanded();
        }
      }}
      style={cardStyle(theme, props.draftExercise.isExpanded, isActionLayerOpen)}
    >
      <TrainingSessionExerciseActions
        canMoveDown={props.canMoveDown}
        canMoveUp={props.canMoveUp}
        draftExercise={props.draftExercise}
        onMoveDown={props.onMoveDown}
        onMoveUp={props.onMoveUp}
        onOpenChange={setIsActionLayerOpen}
        onRemove={props.onRemove}
        onReplace={props.onReplace}
      />

      <button onClick={props.onToggleExpanded} style={headerButtonStyle} type="button">
        <div style={titleRowStyle}>
          <div>
            <strong style={{ color: theme.colors.tx, fontSize: 15 }}>
              {props.draftExercise.name}
            </strong>
            {props.draftExercise.exercise ? (
              <p style={secondaryTextStyle(theme)}>
                {getExerciseDisplayName(props.draftExercise.exercise)}
              </p>
            ) : null}
            {props.draftExercise.inputName &&
            props.draftExercise.matchStatus !== "matched" ? (
              <p style={secondaryTextStyle(theme)}>
                {props.draftExercise.inputName}
              </p>
            ) : null}
          </div>
          <Pill tone={props.draftExercise.matchStatus === "matched" ? "info" : "warning"}>
            {props.draftExercise.matchStatus === "matched"
              ? props.draftExercise.categoryLabel
              : "\u9700\u8981\u786e\u8ba4"}
          </Pill>
        </div>

        <p style={statsStyle(theme)}>
          {summary.completedSets} 组 · 总容量 {formatWeight(formatVolume(summary.totalVolumeKg))}
        </p>

        <div style={metaRowStyle}>
          {movementLabel ? <Pill tone="analysis">{movementLabel}</Pill> : null}
          {equipmentLabel ? <Pill tone="neutral">{equipmentLabel}</Pill> : null}
          {primaryMuscles.map((muscleCode) => (
            <Pill key={muscleCode} tone="accent">
              {getMuscleCodeLabel(muscleCode)}
            </Pill>
          ))}
        </div>
      </button>

      {props.draftExercise.isExpanded ? (
        <div onClick={(event) => event.stopPropagation()} style={editorShellStyle}>
          {props.draftExercise.matchStatus !== "matched" ? (
            <div style={resolutionPanelStyle(theme)}>
              <p style={resolutionCopyStyle(theme)}>
                {props.draftExercise.matchStatus === "ambiguous"
                  ? "\u8fd9\u4e2a\u52a8\u4f5c\u9700\u8981\u5148\u786e\u8ba4\u5019\u9009\u3002"
                  : "\u672a\u8bc6\u522b\u52a8\u4f5c\uff0c\u8bf7\u4ece\u52a8\u4f5c\u5e93\u9009\u62e9\u6807\u51c6\u52a8\u4f5c\u6216\u5220\u9664\u3002"}
              </p>
              {props.draftExercise.candidateExercises.length > 0 ? (
                <div style={candidateRowStyle}>
                  {props.draftExercise.candidateExercises.map((candidate) => (
                    <button
                      key={candidate.exerciseId}
                      onClick={() => props.onResolveCandidate(candidate.exerciseId)}
                      style={candidateButtonStyle(theme)}
                      type="button"
                    >
                      {candidate.exerciseName}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div ref={editorScrollerRef} style={editorScrollerStyle()}>
            {props.draftExercise.sets.map((setDraft, index) => {
              const isActive = setDraft.id === visibleActiveSetId;

              if (!isActive) {
                return (
                  <button
                    key={setDraft.id}
                    onClick={() => setActiveSetId(setDraft.id)}
                    style={collapsedSetStyle(theme, setDraft.completed)}
                    type="button"
                  >
                    <strong style={{ fontSize: 12 }}>第 {index + 1} 组</strong>
                    <span style={collapsedMetaStyle(theme)}>
                      {setDraft.weightKg || "--"} 公斤 · {setDraft.reps || "--"} 次
                    </span>
                    {setDraft.completed ? (
                      <span style={completedBadgeStyle(theme)}>已完成</span>
                    ) : (
                      <span style={collapsedHintStyle(theme)}>点击展开</span>
                    )}
                  </button>
                );
              }

              return (
                <TrainingSessionSetRow
                  canComplete={isDraftSetValid(setDraft, props.draftExercise)}
                  canDelete={props.draftExercise.sets.length > 1}
                  index={index}
                  key={setDraft.id}
                  onCopy={() => props.onCopySet(setDraft.id)}
                  onDelete={() => props.onDeleteSet(setDraft.id)}
                  onStartRestTimer={() => props.onStartRestTimer(setDraft.id)}
                  onToggleCompleted={() => props.onToggleSetCompleted(setDraft.id)}
                  onUpdate={(field, value) => props.onUpdateSet(setDraft.id, field, value)}
                  setDraft={setDraft}
                />
              );
            })}
          </div>

          <button
            onClick={() => {
              props.onAddSet();
              setActiveSetId(null);
            }}
            style={addSetButtonStyle(theme)}
            type="button"
          >
            + 新增一组
          </button>
        </div>
      ) : null}
    </section>
  );
}

function formatVolume(totalVolumeKg: number): string {
  if (Number.isInteger(totalVolumeKg)) {
    return `${totalVolumeKg}`;
  }

  return totalVolumeKg.toFixed(2);
}

function cardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isExpanded: boolean,
  isActionLayerOpen: boolean,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${isExpanded ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    display: "grid",
    gap: 14,
    padding: 16,
    position: "relative",
    transition: "border-color 150ms ease, transform 150ms ease",
    zIndex: isActionLayerOpen ? 30 : "auto",
  };
}

const headerButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  display: "grid",
  gap: 10,
  padding: "0 42px 0 0",
  textAlign: "left",
  width: "100%",
};

const titleRowStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

function secondaryTextStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "6px 0 0",
  };
}

function statsStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 13,
    lineHeight: 1.6,
    margin: 0,
  };
}

const metaRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const editorShellStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

function resolutionPanelStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.orange}`,
    borderRadius: theme.radius.control,
    display: "grid",
    gap: 10,
    padding: 12,
  };
}

function resolutionCopyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
  };
}

const candidateRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

function candidateButtonStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    padding: "8px 10px",
  };
}

function editorScrollerStyle(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    maxHeight: "min(48vh, 420px)",
    overflowY: "auto",
    overscrollBehavior: "contain",
    paddingRight: 4,
    WebkitOverflowScrolling: "touch",
  };
}

function collapsedSetStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isCompleted: boolean,
): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: isCompleted
      ? theme.isDark
        ? "rgba(200, 240, 53, 0.12)"
        : "rgba(74, 140, 0, 0.12)"
      : theme.colors.surf2,
    border: `1px solid ${isCompleted ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx,
    cursor: "pointer",
    display: "grid",
    gap: 6,
    gridTemplateColumns: "80px 1fr auto",
    padding: "10px 12px",
    textAlign: "left",
    width: "100%",
  };
}

function collapsedMetaStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
  };
}

function completedBadgeStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.ac,
    fontSize: 11,
    fontWeight: 700,
  };
}

function collapsedHintStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
  };
}

function addSetButtonStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px dashed ${theme.colors.bdr2}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx2,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    padding: "12px 14px",
  };
}
