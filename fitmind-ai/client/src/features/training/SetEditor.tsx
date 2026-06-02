import type { WorkoutSetDraft, WorkoutSetDraftErrors } from "./use-workout-form";

import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { IconButton } from "../../components/IconButton";
import { Input } from "../../components/Input";
import { Pill } from "../../components/Pill";
import { useTheme } from "../../theme/ThemeContext";
import {
  getExerciseDisplayName,
  getMovementPatternLabel,
  getMuscleCodeLabel,
} from "./exercise-display";

export interface SetEditorProps {
  errors: WorkoutSetDraftErrors | undefined;
  index: number;
  isOnlySet: boolean;
  onFieldChange: <TField extends keyof WorkoutSetDraft>(
    field: TField,
    value: WorkoutSetDraft[TField],
  ) => void;
  onRemove: () => void;
  onSearch: () => Promise<void>;
  onSelectExercise: (exercise: WorkoutSetDraft["exerciseResults"][number]) => void;
  setDraft: WorkoutSetDraft;
}

export function SetEditor(props: SetEditorProps) {
  const { theme } = useTheme();
  const selectedLabel = props.setDraft.exerciseName || "未选择动作";

  return (
    <section style={setCardStyle(theme)}>
      <div style={setTopRowStyle}>
        <div style={setIndexBubbleStyle(theme)}>{props.index + 1}</div>
        <div style={{ flex: 1 }}>
          <div style={setHeaderRowStyle}>
            <strong style={{ fontSize: 14 }}>动作</strong>
            <Pill tone={props.setDraft.isWarmup ? "warning" : "neutral"}>
              {props.setDraft.isWarmup ? "热身组" : "正式组"}
            </Pill>
          </div>
          <p style={selectedExerciseStyle(theme)}>{selectedLabel}</p>
        </div>
        <IconButton
          disabled={props.isOnlySet}
          icon="trash"
          label="删除这一组"
          onClick={props.onRemove}
          tone="danger"
        />
      </div>

      <label style={labelStyle(theme)}>
        搜索动作
        <Input
          onChange={(event) => props.onFieldChange("exerciseQuery", event.target.value)}
          placeholder="搜索动作，例如卧推或深蹲"
          type="text"
          value={props.setDraft.exerciseQuery}
        />
      </label>

      <div style={searchRowStyle}>
        <Button onClick={() => void props.onSearch()} type="button" variant="secondary">
          {props.setDraft.isSearchingExercises ? "搜索中..." : "搜索动作"}
        </Button>
        {props.setDraft.exerciseName ? <Badge tone="accent">已选动作</Badge> : null}
      </div>

      {props.errors?.exerciseId ? <p style={errorStyle(theme)}>{props.errors.exerciseId}</p> : null}

      {props.setDraft.exerciseResults.length > 0 ? (
        <ul style={resultListStyle}>
          {props.setDraft.exerciseResults.map((exercise) => {
            const muscleTags = exercise.muscles
              .filter((muscle) => muscle.is_primary)
              .slice(0, 2)
              .map((muscle) => muscle.code);

            return (
              <li key={exercise.id} style={{ listStyle: "none" }}>
                <button
                  onClick={() => props.onSelectExercise(exercise)}
                  style={resultButtonStyle(theme)}
                  type="button"
                >
                  <div style={resultTitleRowStyle}>
                    <strong style={{ fontSize: 13 }}>{getExerciseDisplayName(exercise)}</strong>
                  </div>
                  <div style={resultMetaRowStyle}>
                    {getMovementPatternLabel(exercise.movement_pattern) ? (
                      <Pill tone="neutral">
                        {getMovementPatternLabel(exercise.movement_pattern)}
                      </Pill>
                    ) : null}
                    {muscleTags.map((muscleTag) => (
                      <Pill key={muscleTag} tone="analysis">
                        {getMuscleCodeLabel(muscleTag)}
                      </Pill>
                    ))}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div style={metricGridStyle}>
        <label style={labelStyle(theme)}>
          次数
          <Input
            min="0"
            onChange={(event) => props.onFieldChange("reps", event.target.value)}
            required
            type="number"
            value={props.setDraft.reps}
          />
        </label>
        <label style={labelStyle(theme)}>
          重量（公斤）
          <Input
            min="0"
            onChange={(event) => props.onFieldChange("weightKg", event.target.value)}
            required
            step="0.01"
            type="number"
            value={props.setDraft.weightKg}
          />
        </label>
        <label style={labelStyle(theme)}>
          主观用力
          <Input
            max="10"
            min="1"
            onChange={(event) => props.onFieldChange("rpe", event.target.value)}
            step="0.1"
            type="number"
            value={props.setDraft.rpe}
          />
        </label>
      </div>

      {props.errors?.reps ? <p style={errorStyle(theme)}>{props.errors.reps}</p> : null}
      {props.errors?.weightKg ? <p style={errorStyle(theme)}>{props.errors.weightKg}</p> : null}
      {props.errors?.rpe ? <p style={errorStyle(theme)}>{props.errors.rpe}</p> : null}

      <label style={labelStyle(theme)}>
        组备注
        <Input
          onChange={(event) => props.onFieldChange("notes", event.target.value)}
          placeholder="可选，例如最后一组接近力竭"
          type="text"
          value={props.setDraft.notes}
        />
      </label>

      <label style={checkboxRowStyle(theme)}>
        <input
          checked={props.setDraft.isWarmup}
          onChange={(event) => props.onFieldChange("isWarmup", event.target.checked)}
          type="checkbox"
        />
        这是一组热身组
      </label>
    </section>
  );
}

const setTopRowStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 12,
};

const setHeaderRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
};

const searchRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const metricGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};

const resultListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const resultTitleRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  justifyContent: "space-between",
};

const resultMetaRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 8,
};

function setCardStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    display: "grid",
    gap: 12,
    padding: 12,
  };
}

function setIndexBubbleStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.surf3,
    borderRadius: 999,
    color: theme.colors.tx2,
    display: "inline-flex",
    fontSize: 12,
    fontWeight: 700,
    height: 24,
    justifyContent: "center",
    minWidth: 24,
  };
}

function selectedExerciseStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.5,
    margin: "6px 0 0",
  };
}

function labelStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    display: "grid",
    fontSize: 12,
    gap: 8,
  };
}

function checkboxRowStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    alignItems: "center",
    color: theme.colors.tx2,
    display: "flex",
    gap: 8,
    fontSize: 12,
  };
}

function resultButtonStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx,
    cursor: "pointer",
    padding: "10px 12px",
    textAlign: "left",
    width: "100%",
  };
}

function errorStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.orange,
    fontSize: 12,
    margin: 0,
  };
}
