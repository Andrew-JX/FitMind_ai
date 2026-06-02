import { useState } from "react";

import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Pill } from "../../components/Pill";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import {
  type DictionaryExercise,
  type DictionaryMuscleGroup,
} from "./dictionary-api";
import {
  getEquipmentLabel,
  getExerciseDisplayName,
  getMovementPatternLabel,
  getMuscleCodeLabel,
  getMuscleGroupDisplayName,
} from "./exercise-display";

export interface ExercisePickerProps {
  exercises: DictionaryExercise[];
  isLoadingExercises: boolean;
  isLoadingMuscleGroups: boolean;
  muscleGroups: DictionaryMuscleGroup[];
  onSearch: (input: { muscle: string; q: string }) => Promise<void>;
  onSelectExercise?: ((exercise: DictionaryExercise) => void) | undefined;
  searchError: string | null;
}

export function ExercisePicker(props: ExercisePickerProps) {
  const {
    exercises,
    isLoadingExercises,
    isLoadingMuscleGroups,
    muscleGroups,
    onSearch,
    onSelectExercise,
    searchError,
  } = props;
  const { theme } = useTheme();
  const [keyword, setKeyword] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await onSearch({
      muscle: selectedMuscle,
      q: keyword,
    });
  }

  return (
    <section>
      <form onSubmit={handleSubmit} style={formStyle}>
        <label style={labelStyle(theme)}>
          搜索动作
          <Input
            disabled={isLoadingExercises}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="输入动作名称，例如卧推或深蹲"
            type="text"
            value={keyword}
          />
        </label>

        <label style={labelStyle(theme)}>
          筛选肌群
          <select
            disabled={isLoadingExercises || isLoadingMuscleGroups}
            onChange={(event) => setSelectedMuscle(event.target.value)}
            style={selectStyle(theme)}
            value={selectedMuscle}
          >
            <option value="">全部肌群</option>
            {muscleGroups.map((muscleGroup) => (
              <option key={muscleGroup.id} value={muscleGroup.code}>
                {getMuscleGroupDisplayName(muscleGroup)}
              </option>
            ))}
          </select>
        </label>

        <Button disabled={isLoadingExercises || isLoadingMuscleGroups} type="submit">
          {isLoadingExercises ? "搜索中..." : "搜索动作"}
        </Button>
      </form>

      {searchError ? (
        <div style={{ marginTop: 12 }}>
          <StateNotice
            description="动作库暂时无法加载，请确认服务已启动，或稍后重试。"
            icon="search"
            title="动作库加载失败"
            tone="error"
          />
        </div>
      ) : null}

      {isLoadingMuscleGroups ? (
        <p style={copyStyle(theme)}>正在加载肌群列表...</p>
      ) : null}

      {!searchError && !isLoadingExercises && exercises.length === 0 ? (
        <div style={{ marginTop: 12 }}>
          <StateNotice
            description="换个关键词试试，或先切回全部肌群查看可用动作。"
            icon="search"
            title="暂时没有找到动作"
          />
        </div>
      ) : null}

      {exercises.length > 0 ? (
        <ul style={resultListStyle}>
          {exercises.map((exercise) => {
            const primaryMuscles = exercise.muscles
              .filter((muscle) => muscle.is_primary)
              .slice(0, 3)
              .map((muscle) => muscle.code);

            return (
              <li key={exercise.id} style={{ listStyle: "none" }}>
                {onSelectExercise ? (
                  <button
                    onClick={() => onSelectExercise(exercise)}
                    style={resultCardStyle(theme, true)}
                    type="button"
                  >
                    <ExerciseResultContent
                      exercise={exercise}
                      primaryMuscles={primaryMuscles}
                    />
                  </button>
                ) : (
                  <div style={resultCardStyle(theme, false)}>
                    <ExerciseResultContent
                      exercise={exercise}
                      primaryMuscles={primaryMuscles}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function ExerciseResultContent(props: {
  exercise: DictionaryExercise;
  primaryMuscles: string[];
}) {
  const movementLabel = getMovementPatternLabel(props.exercise.movement_pattern);
  const equipmentLabel = getEquipmentLabel(props.exercise.equipment);

  return (
    <>
      <div style={titleRowStyle}>
        <strong style={{ fontSize: 13 }}>
          {getExerciseDisplayName(props.exercise)}
        </strong>
      </div>
      <div style={pillRowStyle}>
        {movementLabel ? <Pill tone="analysis">{movementLabel}</Pill> : null}
        {equipmentLabel ? <Pill tone="neutral">{equipmentLabel}</Pill> : null}
        {props.primaryMuscles.map((muscleCode) => (
          <Pill key={muscleCode} tone="accent">
            {getMuscleCodeLabel(muscleCode)}
          </Pill>
        ))}
      </div>
    </>
  );
}

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const resultListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  listStyle: "none",
  margin: "16px 0 0",
  padding: 0,
};

const titleRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  justifyContent: "space-between",
};

const pillRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 8,
};

function copyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "12px 0 0",
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

function selectStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    color: theme.colors.tx,
    padding: "10px 12px",
  };
}

function resultCardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isSelectable: boolean,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    color: theme.colors.tx,
    cursor: isSelectable ? "pointer" : "default",
    display: "block",
    minHeight: 58,
    padding: 12,
    textAlign: "left",
    width: "100%",
  };
}
