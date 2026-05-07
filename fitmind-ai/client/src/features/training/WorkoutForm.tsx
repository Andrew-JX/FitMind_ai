import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { useTheme } from "../../theme/ThemeContext";
import { useWorkoutForm } from "./use-workout-form";

export interface WorkoutFormProps {
  onCreated?: (() => Promise<void>) | undefined;
  token: string | null;
}

export function WorkoutForm(props: WorkoutFormProps) {
  const { onCreated, token } = props;
  const { theme } = useTheme();
  const form = useWorkoutForm(token);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const createdWorkout = await form.submitWorkout();

    if (createdWorkout && onCreated) {
      await onCreated();
    }
  }

  return (
    <Card>
      <h2 style={{ margin: 0 }}>创建训练记录</h2>
      <p style={copyStyle(theme)}>
        填写训练时间、备注和动作组，提交后会写入真实 workout 日志。
      </p>

      <form onSubmit={handleSubmit} style={formStyle}>
        <label style={labelStyle(theme)}>
          训练时间
          <Input
            onChange={(event) => form.setPerformedAt(event.target.value)}
            required
            type="datetime-local"
            value={form.performedAt}
          />
        </label>
        {form.formErrors.performedAt ? (
          <p style={errorStyle(theme)}>{form.formErrors.performedAt}</p>
        ) : null}

        <label style={labelStyle(theme)}>
          时长（分钟）
          <Input
            min="0"
            onChange={(event) => form.setDurationMinutes(event.target.value)}
            type="number"
            value={form.workoutDurationMinutes}
          />
        </label>
        {form.formErrors.workoutDurationMinutes ? (
          <p style={errorStyle(theme)}>{form.formErrors.workoutDurationMinutes}</p>
        ) : null}

        <label style={labelStyle(theme)}>
          备注
          <textarea
            onChange={(event) => form.setNotes(event.target.value)}
            style={textareaStyle(theme)}
            value={form.workoutNotes}
          />
        </label>

        <div style={sectionHeaderStyle}>
          <h3 style={{ margin: 0 }}>动作组</h3>
          <Button onClick={form.addSetDraft} type="button" variant="secondary">
            添加一组
          </Button>
        </div>

        <div style={setListStyle}>
          {form.setDrafts.map((setDraft, index) => (
            <section
              key={`${index}-${setDraft.exerciseId || "draft"}`}
              style={setCardStyle(theme)}
            >
              <div style={setHeaderStyle}>
                <strong>第 {index + 1} 组</strong>
                <button
                  disabled={form.setDrafts.length === 1}
                  onClick={() => form.removeSetDraft(index)}
                  style={textButtonStyle(theme)}
                  type="button"
                >
                  删除
                </button>
              </div>

              <label style={labelStyle(theme)}>
                动作搜索
                <Input
                  onChange={(event) =>
                    form.setSetDraftField(index, "exerciseQuery", event.target.value)
                  }
                  placeholder="bench, squat, row..."
                  type="text"
                  value={setDraft.exerciseQuery}
                />
              </label>

              <div style={inlineActionRowStyle}>
                <Button
                  onClick={() => void form.searchExercisesForSet(index)}
                  type="button"
                  variant="secondary"
                >
                  {setDraft.isSearchingExercises ? "搜索中..." : "搜索动作"}
                </Button>
                <span style={hintTextStyle(theme)}>
                  当前选择：{setDraft.exerciseName || "未选择"}
                </span>
              </div>

              {form.formErrors.setDrafts[index]?.exerciseId ? (
                <p style={errorStyle(theme)}>{form.formErrors.setDrafts[index]?.exerciseId}</p>
              ) : null}

              {setDraft.exerciseResults.length > 0 ? (
                <ul style={resultListStyle}>
                  {setDraft.exerciseResults.map((exercise) => (
                    <li key={exercise.id} style={{ listStyle: "none" }}>
                      <button
                        onClick={() => form.selectExerciseForSet(index, exercise)}
                        style={resultButtonStyle(theme)}
                        type="button"
                      >
                        {exercise.name_zh?.trim()
                          ? `${exercise.name_zh} / ${exercise.name_en}`
                          : exercise.name_en}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div style={setMetricGridStyle}>
                <label style={labelStyle(theme)}>
                  次数
                  <Input
                    min="0"
                    onChange={(event) => form.setSetDraftField(index, "reps", event.target.value)}
                    required
                    type="number"
                    value={setDraft.reps}
                  />
                </label>

                <label style={labelStyle(theme)}>
                  重量（kg）
                  <Input
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

                <label style={labelStyle(theme)}>
                  RPE
                  <Input
                    max="10"
                    min="1"
                    onChange={(event) => form.setSetDraftField(index, "rpe", event.target.value)}
                    step="0.1"
                    type="number"
                    value={setDraft.rpe}
                  />
                </label>
              </div>

              {form.formErrors.setDrafts[index]?.reps ? (
                <p style={errorStyle(theme)}>{form.formErrors.setDrafts[index]?.reps}</p>
              ) : null}
              {form.formErrors.setDrafts[index]?.weightKg ? (
                <p style={errorStyle(theme)}>{form.formErrors.setDrafts[index]?.weightKg}</p>
              ) : null}
              {form.formErrors.setDrafts[index]?.rpe ? (
                <p style={errorStyle(theme)}>{form.formErrors.setDrafts[index]?.rpe}</p>
              ) : null}

              <label style={labelStyle(theme)}>
                组备注
                <Input
                  onChange={(event) => form.setSetDraftField(index, "notes", event.target.value)}
                  type="text"
                  value={setDraft.notes}
                />
              </label>

              <label style={checkboxRowStyle(theme)}>
                <input
                  checked={setDraft.isWarmup}
                  onChange={(event) =>
                    form.setSetDraftField(index, "isWarmup", event.target.checked)
                  }
                  type="checkbox"
                />
                热身组
              </label>
            </section>
          ))}
        </div>

        <Button disabled={form.isSubmitting} type="submit">
          {form.isSubmitting ? "保存中..." : "创建训练记录"}
        </Button>
      </form>

      {form.errorMessage ? <p style={errorStyle(theme)}>错误：{form.errorMessage}</p> : null}
      {form.successMessage ? (
        <p style={successStyle(theme)}>{form.successMessage}</p>
      ) : null}
      {form.createdWorkout ? (
        <section style={{ marginTop: 12 }}>
          <p style={copyStyle(theme)}>已创建 workout：{form.createdWorkout.id}</p>
          <p style={copyStyle(theme)}>已保存动作组：{form.createdWorkout.sets.length}</p>
        </section>
      ) : null}
    </Card>
  );
}

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  marginTop: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
};

const setListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const setHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
};

const setMetricGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};

const inlineActionRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const resultListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  listStyle: "none",
  margin: 0,
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

function textareaStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    color: theme.colors.tx,
    font: "inherit",
    minHeight: 88,
    padding: 12,
    resize: "vertical",
  };
}

function setCardStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 14,
    display: "grid",
    gap: 12,
    padding: 12,
  };
}

function hintTextStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 12,
  };
}

function textButtonStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    color: theme.colors.orange,
    cursor: "pointer",
    fontSize: 12,
    padding: 0,
  };
}

function resultButtonStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    color: theme.colors.tx,
    cursor: "pointer",
    padding: "10px 12px",
    textAlign: "left",
    width: "100%",
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

function errorStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.orange,
    fontSize: 12,
    margin: 0,
  };
}

function successStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.green,
    fontSize: 12,
    marginBottom: 0,
  };
}
