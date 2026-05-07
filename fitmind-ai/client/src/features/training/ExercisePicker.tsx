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
      <form onSubmit={handleSubmit} style={formStyle}>
        <label style={labelStyle(theme)}>
          搜索动作
          <Input
            disabled={isLoadingExercises}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索动作，例如 Bench Press / Squat"
            type="text"
            value={keyword}
          />
        </label>

        <label style={labelStyle(theme)}>
          肌群筛选
          <select
            disabled={isLoadingExercises || isLoadingMuscleGroups}
            onChange={(event) => setSelectedMuscle(event.target.value)}
            style={selectStyle(theme)}
            value={selectedMuscle}
          >
            <option value="">全部肌群</option>
            {muscleGroups.map((muscleGroup) => (
              <option key={muscleGroup.id} value={muscleGroup.code}>
                {muscleGroup.name_zh?.trim() || muscleGroup.name_en}
              </option>
            ))}
          </select>
        </label>

        <Button disabled={isLoadingExercises || isLoadingMuscleGroups} type="submit">
          {isLoadingExercises ? "搜索中..." : "搜索"}
        </Button>
      </form>

      {searchError ? (
        <div style={{ marginTop: 12 }}>
          <StateNotice
            description="请确认后端服务已启动，或稍后重试。"
            icon="search"
            title="动作词典加载失败"
            tone="error"
          />
        </div>
      ) : null}

      {isLoadingMuscleGroups ? (
        <p style={copyStyle(theme)}>正在加载肌群词典...</p>
      ) : null}

      {!searchError && !isLoadingExercises && exercises.length === 0 ? (
        <div style={{ marginTop: 12 }}>
          <StateNotice
            description="输入关键词或选择肌群后，即可查看系统内置动作。"
            icon="search"
            title="暂无搜索结果"
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
              <li key={exercise.id} style={resultCardStyle(theme)}>
                <div style={titleRowStyle}>
                  <strong style={{ fontSize: 13 }}>{exercise.name_en}</strong>
                  {exercise.name_zh?.trim() ? (
                    <Pill tone="info">{exercise.name_zh}</Pill>
                  ) : null}
                </div>
                <div style={pillRowStyle}>
                  {exercise.movement_pattern ? (
                    <Pill tone="analysis">{exercise.movement_pattern}</Pill>
                  ) : null}
                  {exercise.equipment ? (
                    <Pill tone="neutral">{exercise.equipment}</Pill>
                  ) : null}
                  {primaryMuscles.map((muscleCode) => (
                    <Pill key={muscleCode} tone="accent">
                      {muscleCode}
                    </Pill>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
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

function resultCardStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    padding: 12,
  };
}
