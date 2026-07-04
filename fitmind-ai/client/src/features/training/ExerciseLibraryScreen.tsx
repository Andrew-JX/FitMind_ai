import { useEffect, useMemo, useState } from "react";

import type { ExercisePickerProps } from "./ExercisePicker";
import type { DictionaryExercise } from "./dictionary-api";

import { IconButton } from "../../components/IconButton";
import { Input } from "../../components/Input";
import { Pill } from "../../components/Pill";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import { ExerciseDetailSheet } from "./ExerciseDetailSheet";
import {
  EXERCISE_CATEGORY_LABELS,
  getEquipmentLabel,
  getExerciseCategory,
  getExerciseDisplayName,
  getExerciseSearchText,
  getMovementPatternLabel,
  getMuscleCodeLabel,
  type ExerciseCategory,
} from "./exercise-display";

export interface ExerciseLibraryScreenProps extends ExercisePickerProps {
  isOpen: boolean;
  mode?: "add" | "replace" | undefined;
  onClose: () => void;
  onSelectExercise: (exercise: DictionaryExercise) => void;
}

export function ExerciseLibraryScreen(props: ExerciseLibraryScreenProps) {
  const { theme } = useTheme();
  const {
    exercises,
    isLoadingExercises,
    isOpen,
    mode = "add",
    onClose,
    onSearch,
    onSelectExercise,
    searchError,
  } = props;
  const [keyword, setKeyword] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<ExerciseCategory>("全部");
  const [selectedExercise, setSelectedExercise] =
    useState<DictionaryExercise | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void onSearch({ muscle: "", q: "" });
  }, [isOpen, onSearch]);

  const filteredExercises = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return exercises.filter((exercise) => {
      const category = getExerciseCategory(exercise);
      const categoryMatch =
        selectedCategory === "全部" || category === selectedCategory;

      if (!categoryMatch) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return getExerciseSearchText(exercise).includes(normalizedKeyword);
    });
  }, [exercises, keyword, selectedCategory]);

  if (!isOpen) {
    return null;
  }

  return (
    <section style={screenStyle(theme)}>
      <header style={headerStyle()}>
        <div style={headerRowStyle}>
          <IconButton icon="x" label="关闭动作库" onClick={onClose} />
          <div style={{ flex: 1 }}>
            <h2 style={titleStyle}>选择动作</h2>
            <p style={subtitleStyle(theme)}>
              {mode === "replace"
                ? "选择一个新动作替换当前动作"
                : "从动作库添加本次训练动作"}
            </p>
          </div>
        </div>

        <Input
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索动作名称"
          type="text"
          value={keyword}
        />
      </header>

      <div style={categoryRailStyle}>
        {EXERCISE_CATEGORY_LABELS.map((category) => {
          const isActive = category === selectedCategory;

          return (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              style={categoryButtonStyle(theme, isActive)}
              type="button"
            >
              {category}
            </button>
          );
        })}
      </div>

      <div style={contentStyle}>
        {searchError ? (
          <StateNotice
            description="动作库暂时无法加载，请确认服务已启动，或稍后重试。"
            icon="search"
            title="动作库加载失败"
            tone="error"
          />
        ) : null}

        {!searchError && isLoadingExercises ? (
          <p style={loadingCopyStyle(theme)}>正在加载动作库...</p>
        ) : null}

        {!searchError &&
        !isLoadingExercises &&
        filteredExercises.length === 0 ? (
          <StateNotice
            description={
              selectedCategory === "全部"
                ? "可以换个关键词搜索动作名称。"
                : "这个分类暂时没有动作，可以搜索动作名称或切回全部。"
            }
            icon="search"
            title="没有找到动作"
          />
        ) : null}

        {!searchError && filteredExercises.length > 0 ? (
          <ul style={listStyle}>
            {filteredExercises.map((exercise) => {
              const category = getExerciseCategory(exercise);
              const primaryMuscles = exercise.muscles
                .filter((muscle) => muscle.is_primary)
                .slice(0, 2)
                .map((muscle) => muscle.code);
              const movementLabel = getMovementPatternLabel(
                exercise.movement_pattern,
              );
              const equipmentLabel = getEquipmentLabel(exercise.equipment);

              return (
                <li key={exercise.id} style={{ listStyle: "none" }}>
                  <button
                    onClick={() => setSelectedExercise(exercise)}
                    style={cardStyle(theme)}
                    type="button"
                  >
                    <div style={cardTopRowStyle}>
                      <strong style={{ fontSize: 14 }}>
                        {getExerciseDisplayName(exercise)}
                      </strong>
                      <Pill tone="info">{category}</Pill>
                    </div>
                    <div style={metaRowStyle}>
                      {movementLabel ? (
                        <Pill tone="analysis">{movementLabel}</Pill>
                      ) : null}
                      {equipmentLabel ? (
                        <Pill tone="neutral">{equipmentLabel}</Pill>
                      ) : null}
                      {primaryMuscles.map((muscleCode) => (
                        <Pill key={muscleCode} tone="accent">
                          {getMuscleCodeLabel(muscleCode)}
                        </Pill>
                      ))}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <ExerciseDetailSheet
        actionLabel={mode === "replace" ? "替换为这个动作" : "加入本次训练"}
        exercise={selectedExercise}
        onClose={() => setSelectedExercise(null)}
        onSelectExercise={(exercise) => {
          onSelectExercise(exercise);
          setSelectedExercise(null);
        }}
        token={props.token}
      />
    </section>
  );
}

function screenStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.bg,
    display: "grid",
    gridTemplateRows: "auto auto 1fr",
    inset: 0,
    padding:
      "max(16px, env(safe-area-inset-top, 16px)) 16px calc(16px + env(safe-area-inset-bottom, 0px))",
    position: "absolute",
    zIndex: 260,
  };
}

function headerStyle(): React.CSSProperties {
  return {
    display: "grid",
    gap: 14,
  };
}

const headerRowStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 12,
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  margin: 0,
};

function subtitleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "4px 0 0",
  };
}

const categoryRailStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  margin: "14px 0 0",
  overflowX: "auto",
  paddingBottom: 6,
};

function categoryButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isActive: boolean,
): React.CSSProperties {
  return {
    backgroundColor: isActive ? theme.colors.ac : theme.colors.surf2,
    border: `1px solid ${isActive ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: theme.radius.pill,
    color: isActive ? theme.colors.acText : theme.colors.tx2,
    cursor: "pointer",
    flex: "0 0 auto",
    fontSize: 12,
    fontWeight: 700,
    minHeight: 38,
    minWidth: 44,
    padding: "8px 12px",
    whiteSpace: "nowrap",
  };
}

const contentStyle: React.CSSProperties = {
  marginTop: 12,
  overflowY: "auto",
  paddingBottom: 12,
};

function loadingCopyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
  };
}

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  listStyle: "none",
  margin: 0,
  padding: 0,
};

function cardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    color: theme.colors.tx,
    cursor: "pointer",
    display: "grid",
    gap: 8,
    minHeight: 72,
    padding: 14,
    textAlign: "left",
    width: "100%",
  };
}

const cardTopRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const metaRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};
