import { useWorkoutForm } from "./use-workout-form";

export interface WorkoutFormProps {
  onCreated?: (() => Promise<void>) | undefined;
  token: string | null;
}

/**
 * Renders the minimal workout creation form for Phase 1.3.
 *
 * @param props - Current in-memory auth token
 * @returns The workout creation section
 */
export function WorkoutForm(props: WorkoutFormProps) {
  const { onCreated, token } = props;
  const form = useWorkoutForm(token);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const createdWorkout = await form.submitWorkout();

    if (createdWorkout && onCreated) {
      await onCreated();
    }
  }

  return (
    <section>
      <h2>Create Workout</h2>
      <p>This is the MVP workout entry form. List and detail screens land next.</p>
      <form onSubmit={handleSubmit}>
        <label>
          Performed at
          <input
            onChange={(event) => form.setPerformedAt(event.target.value)}
            required
            type="datetime-local"
            value={form.performedAt}
          />
        </label>
        <label>
          Duration (minutes)
          <input
            min="0"
            onChange={(event) => form.setDurationMinutes(event.target.value)}
            type="number"
            value={form.workoutDurationMinutes}
          />
        </label>
        <label>
          Notes
          <textarea
            onChange={(event) => form.setNotes(event.target.value)}
            value={form.workoutNotes}
          />
        </label>
        <h3>Sets</h3>
        {form.setDrafts.map((setDraft, index) => {
          return (
            <section key={`${index}-${setDraft.exerciseId || "draft"}`}>
              <p>Set {index + 1}</p>
              <label>
                Exercise search
                <input
                  onChange={(event) =>
                    form.setSetDraftField(index, "exerciseQuery", event.target.value)
                  }
                  placeholder="Search an exercise"
                  type="text"
                  value={setDraft.exerciseQuery}
                />
              </label>
              <button
                onClick={() => void form.searchExercisesForSet(index)}
                type="button"
              >
                {setDraft.isSearchingExercises ? "Searching..." : "Search"}
              </button>
              <div>
                Selected exercise: {setDraft.exerciseName || "None"}
              </div>
              {setDraft.exerciseResults.length > 0 ? (
                <ul>
                  {setDraft.exerciseResults.map((exercise) => {
                    return (
                      <li key={exercise.id}>
                        <button
                          onClick={() => form.selectExerciseForSet(index, exercise)}
                          type="button"
                        >
                          Select {exercise.name_en}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              <label>
                Reps
                <input
                  min="0"
                  onChange={(event) => form.setSetDraftField(index, "reps", event.target.value)}
                  required
                  type="number"
                  value={setDraft.reps}
                />
              </label>
              <label>
                Weight (kg)
                <input
                  min="0"
                  onChange={(event) =>
                    form.setSetDraftField(index, "weightKg", event.target.value)
                  }
                  required
                  step="0.01"
                  type="number"
                  value={setDraft.weightKg}
                />
              </label>
              <label>
                RPE
                <input
                  max="10"
                  min="1"
                  onChange={(event) => form.setSetDraftField(index, "rpe", event.target.value)}
                  step="0.1"
                  type="number"
                  value={setDraft.rpe}
                />
              </label>
              <label>
                Set notes
                <input
                  onChange={(event) => form.setSetDraftField(index, "notes", event.target.value)}
                  type="text"
                  value={setDraft.notes}
                />
              </label>
              <label>
                Warm-up
                <input
                  checked={setDraft.isWarmup}
                  onChange={(event) =>
                    form.setSetDraftField(index, "isWarmup", event.target.checked)
                  }
                  type="checkbox"
                />
              </label>
              <button
                disabled={form.setDrafts.length === 1}
                onClick={() => form.removeSetDraft(index)}
                type="button"
              >
                Remove set
              </button>
            </section>
          );
        })}
        <button onClick={form.addSetDraft} type="button">
          Add set
        </button>
        <button disabled={form.isSubmitting} type="submit">
          {form.isSubmitting ? "Saving workout..." : "Create workout"}
        </button>
      </form>
      {form.errorMessage ? <p>Error: {form.errorMessage}</p> : null}
      {form.createdWorkout ? (
        <section>
          <p>Created workout: {form.createdWorkout.id}</p>
          <p>Saved sets: {form.createdWorkout.sets.length}</p>
        </section>
      ) : null}
    </section>
  );
}
