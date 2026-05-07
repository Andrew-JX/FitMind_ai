import { useState } from "react";

import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useTheme } from "../../theme/ThemeContext";
import {
  type DictionaryExercise,
  type DictionaryMuscleGroup,
} from "./dictionary-api";

export interface ExercisePickerProps {
  exercises: DictionaryExercise[];
  isLoadingExercises: boolean;
  isLoadingMuscleGroups: boolean;
  muscleGroups: DictionaryMuscleGroup[];
  onSearch: (input: { muscle: string; q: string }) => Promise<void>;
  searchError: string | null;
}

export function ExercisePicker(props: ExercisePickerProps) {
  const {
    exercises,
    isLoadingExercises,
    isLoadingMuscleGroups,
    muscleGroups,
    onSearch,
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
      <h2 style={{ margin: 0 }}>动作词典</h2>
      <p style={copyStyle(theme)}>
        搜索动作基础词典，用于辅助录入训练动作名称和肌群信息。
      </p>

      <form onSubmit={handleSubmit} style={formStyle}>
        <label style={labelStyle(theme)}>
          关键词
          <Input
            disabled={isLoadingExercises}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="bench, squat, row..."
            type="text"
            value={keyword}
          />
        </label>

        <label style={labelStyle(theme)}>
          肌群
          <select
            disabled={isLoadingExercises || isLoadingMuscleGroups}
            onChange={(event) => setSelectedMuscle(event.target.value)}
            style={selectStyle(theme)}
            value={selectedMuscle}
          >
            <option value="">全部肌群</option>
            {muscleGroups.map((muscleGroup) => (
              <option key={muscleGroup.id} value={muscleGroup.code}>
                {muscleGroup.name_zh?.trim() || muscleGroup.name_en} ({muscleGroup.code})
              </option>
            ))}
          </select>
        </label>

        <Button
          disabled={isLoadingExercises || isLoadingMuscleGroups}
          type="submit"
        >
          {isLoadingExercises ? "搜索中..." : "搜索动作"}
        </Button>
      </form>

      {searchError ? <p style={errorStyle(theme)}>错误：{searchError}</p> : null}
      {isLoadingMuscleGroups ? <p style={copyStyle(theme)}>正在加载肌群词典...</p> : null}
      {!isLoadingExercises && exercises.length === 0 ? (
        <p style={copyStyle(theme)}>还没有动作结果，先执行一次搜索。</p>
      ) : null}

      {exercises.length > 0 ? (
        <ul style={resultListStyle}>
          {exercises.map((exercise) => (
            <li key={exercise.id} style={resultCardStyle(theme)}>
              <strong>
                {exercise.name_zh?.trim()
                  ? `${exercise.name_zh} / ${exercise.name_en}`
                  : exercise.name_en}
              </strong>
              <div style={metaStyle(theme)}>Code: {exercise.code}</div>
              <div style={metaStyle(theme)}>
                器械：{exercise.equipment ?? "未知"}
              </div>
              <div style={metaStyle(theme)}>
                主要肌群：
                {exercise.muscles
                  .filter((muscle) => muscle.is_primary)
                  .map((muscle) => muscle.code)
                  .join(", ") || "未标注"}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 16,
};

const resultListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  listStyle: "none",
  margin: "16px 0 0",
  padding: 0,
};

function copyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 13,
    lineHeight: 1.6,
    margin: "8px 0 0",
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

function errorStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.orange,
    fontSize: 12,
    marginBottom: 0,
    marginTop: 12,
  };
}

function resultCardStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    padding: 12,
  };
}

function metaStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    marginTop: 4,
  };
}
