import type { DraftExercise, DraftSet } from "./training-session-draft";

import { Pill } from "../../components/Pill";
import { useTheme } from "../../theme/ThemeContext";
import {
  getExerciseSummary,
  isDraftSetValid,
} from "./training-session-draft";
import { TrainingSessionSetRow } from "./TrainingSessionSetRow";

export interface TrainingSessionExerciseCardProps {
  draftExercise: DraftExercise;
  onAddSet: () => void;
  onCopySet: (setId: string) => void;
  onDeleteSet: (setId: string) => void;
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
  const primaryMuscles = props.draftExercise.exercise.muscles
    .filter((muscle) => muscle.is_primary)
    .slice(0, 2)
    .map((muscle) => muscle.code);

  return (
    <section
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          props.onToggleExpanded();
        }
      }}
      style={cardStyle(theme, props.draftExercise.isExpanded)}
    >
      <button onClick={props.onToggleExpanded} style={headerButtonStyle} type="button">
        <div style={titleRowStyle}>
          <div>
            <strong style={{ color: theme.colors.tx, fontSize: 15 }}>
              {props.draftExercise.name}
            </strong>
            {props.draftExercise.exercise.name_zh?.trim() ? (
              <p style={secondaryTextStyle(theme)}>
                {props.draftExercise.exercise.name_zh}
              </p>
            ) : null}
          </div>
          <Pill tone="info">{props.draftExercise.categoryLabel}</Pill>
        </div>

        <p style={statsStyle(theme)}>
          {summary.completedSets} 组 · 总容量 {formatVolume(summary.totalVolumeKg)} kg
        </p>

        <div style={metaRowStyle}>
          {props.draftExercise.exercise.movement_pattern ? (
            <Pill tone="analysis">{props.draftExercise.exercise.movement_pattern}</Pill>
          ) : null}
          {props.draftExercise.exercise.equipment ? (
            <Pill tone="neutral">{props.draftExercise.exercise.equipment}</Pill>
          ) : null}
          {primaryMuscles.map((muscleCode) => (
            <Pill key={muscleCode} tone="accent">
              {muscleCode}
            </Pill>
          ))}
        </div>
      </button>

      {props.draftExercise.isExpanded ? (
        <div onClick={(event) => event.stopPropagation()} style={editorStyle}>
          {props.draftExercise.sets.map((setDraft, index) => (
            <TrainingSessionSetRow
              canComplete={isDraftSetValid(setDraft)}
              canDelete={props.draftExercise.sets.length > 1}
              index={index}
              key={setDraft.id}
              onCopy={() => props.onCopySet(setDraft.id)}
              onDelete={() => props.onDeleteSet(setDraft.id)}
              onToggleCompleted={() => props.onToggleSetCompleted(setDraft.id)}
              onUpdate={(field, value) => props.onUpdateSet(setDraft.id, field, value)}
              setDraft={setDraft}
            />
          ))}

          <button onClick={props.onAddSet} style={addSetButtonStyle(theme)} type="button">
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
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${isExpanded ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    display: "grid",
    gap: 14,
    padding: 16,
    transition: "border-color 150ms ease, transform 150ms ease",
  };
}

const headerButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  display: "grid",
  gap: 10,
  padding: 0,
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

const editorStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

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
