import { useEffect, useMemo, useState } from "react";

import type { ExercisePickerProps } from "./ExercisePicker";
import type { DictionaryExercise } from "./dictionary-api";

import { IconButton } from "../../components/IconButton";
import { Input } from "../../components/Input";
import { Pill } from "../../components/Pill";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";

const CATEGORY_LABELS = [
  "全部",
  "胸",
  "背",
  "腿",
  "肩",
  "手臂",
  "核心",
  "热身",
  "拉伸",
  "功能性",
  "其他",
] as const;

type ExerciseCategory = (typeof CATEGORY_LABELS)[number];

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
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory>("全部");

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
      const categoryMatch = selectedCategory === "全部" || category === selectedCategory;

      if (!categoryMatch) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      const searchableFields = [
        exercise.name_en,
        exercise.name_zh,
        category,
        exercise.equipment ?? "",
        exercise.movement_pattern ?? "",
        ...exercise.muscles.map((muscle) => muscle.code),
      ];

      return searchableFields.some((field) => {
        return field.toLowerCase().includes(normalizedKeyword);
      });
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
          placeholder="搜索动作"
          type="text"
          value={keyword}
        />
      </header>

      <div style={categoryRailStyle}>
        {CATEGORY_LABELS.map((category) => {
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

        {!searchError && !isLoadingExercises && filteredExercises.length === 0 ? (
          <StateNotice
            description="这个分类暂时没有匹配动作。可以换个关键词，或切回“全部”查看。"
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

              return (
                <li key={exercise.id} style={{ listStyle: "none" }}>
                  <button
                    onClick={() => onSelectExercise(exercise)}
                    style={cardStyle(theme)}
                    type="button"
                  >
                    <div style={cardTopRowStyle}>
                      <strong style={{ fontSize: 14 }}>
                        {exercise.name_zh?.trim() || exercise.name_en}
                      </strong>
                      <Pill tone="info">{category}</Pill>
                    </div>
                    {exercise.name_zh?.trim() ? (
                      <div style={secondaryTextStyle(theme)}>{exercise.name_en}</div>
                    ) : null}
                    <div style={metaRowStyle}>
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
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function getExerciseCategory(exercise: DictionaryExercise): ExerciseCategory {
  const primaryCodes = exercise.muscles
    .filter((muscle) => muscle.is_primary)
    .map((muscle) => muscle.code.toLowerCase());
  const movementPattern = exercise.movement_pattern?.toLowerCase() ?? "";
  const searchable = `${exercise.name_en} ${exercise.name_zh} ${movementPattern}`.toLowerCase();

  if (primaryCodes.some((code) => code.includes("chest") || code === "pecs")) {
    return "胸";
  }

  if (primaryCodes.some((code) => code.includes("back") || code.includes("lat"))) {
    return "背";
  }

  if (
    primaryCodes.some((code) => {
      return (
        code.includes("quad") ||
        code.includes("hamstring") ||
        code.includes("leg") ||
        code.includes("glute") ||
        code.includes("calf")
      );
    })
  ) {
    return "腿";
  }

  if (primaryCodes.some((code) => code.includes("shoulder") || code.includes("delt"))) {
    return "肩";
  }

  if (
    primaryCodes.some((code) => {
      return code.includes("bicep") || code.includes("tricep") || code.includes("forearm");
    })
  ) {
    return "手臂";
  }

  if (primaryCodes.some((code) => code.includes("core") || code.includes("ab"))) {
    return "核心";
  }

  if (searchable.includes("warm") || searchable.includes("activation")) {
    return "热身";
  }

  if (searchable.includes("stretch") || searchable.includes("mobility")) {
    return "拉伸";
  }

  if (
    movementPattern.includes("carry") ||
    movementPattern.includes("rotation") ||
    movementPattern.includes("gait") ||
    searchable.includes("sled")
  ) {
    return "功能性";
  }

  return "其他";
}

function screenStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
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

function subtitleStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
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
    minHeight: 36,
    padding: "8px 12px",
    whiteSpace: "nowrap",
  };
}

const contentStyle: React.CSSProperties = {
  marginTop: 12,
  overflowY: "auto",
  paddingBottom: 12,
};

function loadingCopyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
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

function cardStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
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

function secondaryTextStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.5,
  };
}

const metaRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};
