import { useState } from "react";

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

/**
 * Renders the minimal exercise dictionary search UI for Phase 1.3.
 *
 * @param props - Muscle groups, search state, and search handler
 * @returns The exercise search section
 */
export function ExercisePicker(props: ExercisePickerProps) {
  const {
    exercises,
    isLoadingExercises,
    isLoadingMuscleGroups,
    muscleGroups,
    onSearch,
    searchError,
  } = props;
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
      <h2>Exercise Dictionary</h2>
      <p>Search the action dictionary before workout creation lands in the next batch.</p>
      <form onSubmit={handleSubmit}>
        <label>
          Keyword
          <input
            disabled={isLoadingExercises}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="bench, squat, row..."
            type="text"
            value={keyword}
          />
        </label>
        <label>
          Muscle group
          <select
            disabled={isLoadingExercises || isLoadingMuscleGroups}
            onChange={(event) => setSelectedMuscle(event.target.value)}
            value={selectedMuscle}
          >
            <option value="">All muscle groups</option>
            {muscleGroups.map((muscleGroup) => {
              return (
                <option key={muscleGroup.id} value={muscleGroup.code}>
                  {muscleGroup.name_en} ({muscleGroup.code})
                </option>
              );
            })}
          </select>
        </label>
        <button
          disabled={isLoadingExercises || isLoadingMuscleGroups}
          type="submit"
        >
          {isLoadingExercises ? "Searching..." : "Search exercises"}
        </button>
      </form>
      {searchError ? <p>Error: {searchError}</p> : null}
      {isLoadingMuscleGroups ? <p>Loading muscle groups...</p> : null}
      {!isLoadingExercises && exercises.length === 0 ? (
        <p>No exercises loaded yet. Run a search to see results.</p>
      ) : null}
      {exercises.length > 0 ? (
        <ul>
          {exercises.map((exercise) => {
            return (
              <li key={exercise.id}>
                <strong>{exercise.name_en}</strong>
                <div>Code: {exercise.code}</div>
                <div>Chinese name: {exercise.name_zh}</div>
                <div>Equipment: {exercise.equipment ?? "Unknown"}</div>
                <div>
                  Primary muscles:{" "}
                  {exercise.muscles
                    .filter((muscle) => muscle.is_primary)
                    .map((muscle) => muscle.code)
                    .join(", ") || "Unspecified"}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
