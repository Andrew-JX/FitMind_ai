import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import { SetEditor } from "./SetEditor";
import { useWorkoutForm } from "./use-workout-form";

export interface WorkoutFormProps {
  onCancel?: (() => void) | undefined;
  onCreated?: (() => Promise<void>) | undefined;
  token: string | null;
}

export function WorkoutForm(props: WorkoutFormProps) {
  const { onCancel, onCreated, token } = props;
  const { theme } = useTheme();
  const form = useWorkoutForm(token);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const createdWorkout = await form.submitWorkout();

    if (createdWorkout && onCreated) {
      await onCreated();
    }
  }

  return (
    <Card>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>记录训练</h2>
          <p style={copyStyle(theme)}>
            添加本次训练的动作、重量、次数与主观用力。
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={formStyle}>
        <div style={topGridStyle}>
          <label style={labelStyle(theme)}>
            训练时间
            <input
              onChange={(event) => form.setPerformedAt(event.target.value)}
              required
              style={inputLikeStyle(theme)}
              type="datetime-local"
              value={form.performedAt}
            />
          </label>

          <label style={labelStyle(theme)}>
            时长（分钟）
            <input
              min="0"
              onChange={(event) => form.setDurationMinutes(event.target.value)}
              style={inputLikeStyle(theme)}
              type="number"
              value={form.workoutDurationMinutes}
            />
          </label>
        </div>

        {form.formErrors.performedAt ? (
          <p style={errorStyle(theme)}>{form.formErrors.performedAt}</p>
        ) : null}
        {form.formErrors.workoutDurationMinutes ? (
          <p style={errorStyle(theme)}>
            {form.formErrors.workoutDurationMinutes}
          </p>
        ) : null}

        <label style={labelStyle(theme)}>
          备注
          <textarea
            onChange={(event) => form.setNotes(event.target.value)}
            placeholder="记录训练状态、动作备注或当天体感"
            style={textareaStyle(theme)}
            value={form.workoutNotes}
          />
        </label>

        <div style={setsHeaderStyle}>
          <div>
            <strong style={{ fontSize: 14 }}>训练组</strong>
            <p style={subCopyStyle(theme)}>
              每组需要选择动作，并填写次数和重量。
            </p>
          </div>
          <Button onClick={form.addSetDraft} type="button" variant="secondary">
            添加一组
          </Button>
        </div>

        <div style={setListStyle}>
          {form.setDrafts.map((setDraft, index) => (
            <SetEditor
              errors={form.formErrors.setDrafts[index]}
              index={index}
              isOnlySet={form.setDrafts.length === 1}
              key={`${index}-${setDraft.exerciseId || "draft"}`}
              onFieldChange={(field, value) =>
                form.setSetDraftField(index, field, value)
              }
              onRemove={() => form.removeSetDraft(index)}
              onSearch={() => form.searchExercisesForSet(index)}
              onSelectExercise={(exercise) =>
                form.selectExerciseForSet(index, exercise)
              }
              setDraft={setDraft}
            />
          ))}
        </div>

        <div style={actionRowStyle}>
          {onCancel ? (
            <Button onClick={onCancel} type="button" variant="secondary">
              取消
            </Button>
          ) : null}
          <Button
            disabled={form.isSubmitting}
            style={{ flex: onCancel ? 2 : 1 }}
            type="submit"
          >
            {form.isSubmitting ? "创建中..." : "创建训练"}
          </Button>
        </div>
      </form>

      {form.errorMessage ? (
        <div style={{ marginTop: 12 }}>
          <StateNotice
            description={translateMessage(form.errorMessage)}
            title="训练保存失败"
            tone="error"
          />
        </div>
      ) : null}

      {form.successMessage ? (
        <p style={successStyle(theme)}>
          {translateMessage(form.successMessage)}
        </p>
      ) : null}
    </Card>
  );
}

function translateMessage(message: string): string {
  if (message === "You must be signed in to create a workout.") {
    return "请先登录后再创建训练。";
  }

  if (message === "Please fix the highlighted workout fields and try again.") {
    return "请先修正表单中的错误信息，再重新提交。";
  }

  if (message === "Workout creation is unavailable right now.") {
    return "训练保存失败，请稍后重试。";
  }

  if (message.startsWith("Saved workout with ")) {
    return "训练创建成功，训练记录和分析数据已刷新。";
  }

  return message
    .replaceAll("Workout date and time are required.", "请填写训练时间。")
    .replaceAll("Workout date and time must be valid.", "训练时间格式无效。")
    .replaceAll(
      "Workout duration must be a valid integer.",
      "训练时长必须是整数。",
    )
    .replaceAll("Workout duration must be at least 0.", "训练时长不能小于 0。")
    .replaceAll("must be a valid integer.", "必须是有效整数。")
    .replaceAll("must be a valid number.", "必须是有效数字。")
    .replaceAll("must be at least 0.", "不能小于 0。")
    .replaceAll("must be at least 1.", "不能小于 1。")
    .replaceAll("must be no more than 10.", "不能大于 10。")
    .replaceAll("Set ", "第 ")
    .replaceAll(" reps", " 组次数")
    .replaceAll(" weight", " 组重量")
    .replaceAll(" RPE", " 组主观用力")
    .replaceAll(" needs an exercise selection.", " 组需要先选择动作。");
}

const headerStyle: React.CSSProperties = {
  marginBottom: 16,
};

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  margin: 0,
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const topGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const setsHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const setListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
};

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 13,
    lineHeight: 1.6,
    margin: "6px 0 0",
  };
}

function subCopyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    lineHeight: 1.5,
    margin: "4px 0 0",
  };
}

function labelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    display: "grid",
    fontSize: 12,
    gap: 8,
  };
}

function inputLikeStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx,
    padding: "10px 12px",
    width: "100%",
  };
}

function textareaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx,
    font: "inherit",
    minHeight: 88,
    padding: 12,
  };
}

function errorStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.orange,
    fontSize: 12,
    margin: 0,
  };
}

function successStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.green,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "12px 0 0",
  };
}
