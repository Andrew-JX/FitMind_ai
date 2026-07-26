import { useEffect, useState } from "react";

import { Pill } from "../../components/Pill";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import { ExerciseDetailSheet } from "./ExerciseDetailSheet";
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
  token?: string | null | undefined;
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
    token,
  } = props;
  const { theme } = useTheme();
  const [keyword, setKeyword] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState("");
  const [selectedExercise, setSelectedExercise] =
    useState<DictionaryExercise | null>(null);

  // The design has no explicit search button: typing or switching the muscle
  // filter searches directly, debounced so each keystroke is not a request.
  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void onSearch({ muscle: selectedMuscle, q: keyword });
    }, 250);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [keyword, onSearch, selectedMuscle]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    await onSearch({
      muscle: selectedMuscle,
      q: keyword,
    });
  }

  return (
    <section>
      <form onSubmit={handleSubmit} style={formStyle}>
        <input
          aria-label="搜索动作名称"
          disabled={isLoadingExercises}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索动作名称"
          style={searchInputStyle(theme)}
          type="text"
          value={keyword}
        />
        <select
          aria-label="筛选肌群"
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
                    onClick={() => setSelectedExercise(exercise)}
                    style={resultCardStyle(theme, true)}
                    type="button"
                  >
                    <ExerciseResultContent
                      exercise={exercise}
                      primaryMuscles={primaryMuscles}
                    />
                  </button>
                ) : (
                  <button
                    onClick={() => setSelectedExercise(exercise)}
                    style={resultCardStyle(theme, true)}
                    type="button"
                  >
                    <ExerciseResultContent
                      exercise={exercise}
                      primaryMuscles={primaryMuscles}
                    />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      <ExerciseDetailSheet
        actionLabel="加入本次训练"
        exercise={selectedExercise}
        onClose={() => setSelectedExercise(null)}
        onSelectExercise={
          onSelectExercise
            ? (exercise) => {
                onSelectExercise(exercise);
                setSelectedExercise(null);
              }
            : undefined
        }
        token={token}
      />
    </section>
  );
}

function ExerciseResultContent(props: {
  exercise: DictionaryExercise;
  primaryMuscles: string[];
}) {
  const movementLabel = getMovementPatternLabel(
    props.exercise.movement_pattern,
  );
  const equipmentLabel = getEquipmentLabel(props.exercise.equipment);

  return (
    <>
      <div style={titleRowStyle}>
        <strong
          style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.1px" }}
        >
          {getExerciseDisplayName(props.exercise)}
        </strong>
        <div style={pillRowStyle}>
          {movementLabel ? <Pill tone="analysis">{movementLabel}</Pill> : null}
          {equipmentLabel ? <Pill tone="neutral">{equipmentLabel}</Pill> : null}
          {props.primaryMuscles.map((muscleCode) => (
            <Pill key={muscleCode} tone="accent">
              {getMuscleCodeLabel(muscleCode)}
            </Pill>
          ))}
        </div>
      </div>
      <span aria-hidden="true" style={chevronStyle}>
        ›
      </span>
    </>
  );
}

/** Design: search field + muscle filter share one row (1fr / 110px). */
const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "1fr 110px",
};

/** Design: soft-filled search input inside the library section. */
function searchInputStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.soft,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    color: theme.colors.tx,
    font: "inherit",
    fontSize: 13,
    padding: "9px 10px",
    width: "100%",
  };
}

const resultListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  listStyle: "none",
  margin: "8px 0 0",
  padding: 0,
};

const titleRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const pillRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

/** Design: trailing chevron on each library row. */
const chevronStyle: React.CSSProperties = {
  flex: "0 0 auto",
  opacity: 0.6,
};

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "12px 0 0",
  };
}

function selectStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.divider,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    color: theme.colors.tx,
    font: "inherit",
    fontSize: 13,
    fontWeight: 600,
    padding: "9px 8px",
    width: "100%",
  };
}

function resultCardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isSelectable: boolean,
): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.soft,
    border: "none",
    borderRadius: 14,
    color: theme.colors.tx,
    cursor: isSelectable ? "pointer" : "default",
    display: "flex",
    gap: 8,
    justifyContent: "space-between",
    padding: "12px 13px",
    textAlign: "left",
    width: "100%",
  };
}
