import { describe, expect, it } from "vitest";

import {
  buildAssistantRequestPayload,
  buildClarificationChoiceMessage,
} from "./assistant-request-payload";

const DEFAULT_RANGE = { end_date: "2026-07-27", start_date: "2026-06-28" };
const STALE_EXERCISE = "11111111-1111-4111-8111-111111111111";
const CHOSEN_EXERCISE = "22222222-2222-4222-8222-222222222222";

describe("buildAssistantRequestPayload", () => {
  it("omits exercise_id for modes that do not need one", () => {
    const payload = buildAssistantRequestPayload({
      defaultRange: DEFAULT_RANGE,
      message: "我今天练什么？",
      mode: "next_training_focus",
      selectedExerciseId: STALE_EXERCISE,
    });

    expect(payload.exercise_id).toBeUndefined();
    expect(payload).toMatchObject({
      end_date: "2026-07-27",
      message: "我今天练什么？",
      mode: "next_training_focus",
      start_date: "2026-06-28",
    });
  });

  it("passes the selected exercise for exercise-scoped modes", () => {
    const payload = buildAssistantRequestPayload({
      defaultRange: DEFAULT_RANGE,
      message: "分析一下进展",
      mode: "exercise_progress",
      selectedExerciseId: STALE_EXERCISE,
    });

    expect(payload.exercise_id).toBe(STALE_EXERCISE);
  });

  it("lets a clarification choice outrank the selected exercise (ER-1D)", () => {
    const payload = buildAssistantRequestPayload({
      choice: {
        kind: "exercise",
        option: { exerciseId: CHOSEN_EXERCISE, exerciseName: "杠铃卧推" },
      },
      defaultRange: DEFAULT_RANGE,
      message: "杠铃卧推",
      mode: "auto",
      selectedExerciseId: STALE_EXERCISE,
    });

    expect(payload.exercise_id).toBe(CHOSEN_EXERCISE);
  });

  it("sends a chosen exercise even in a mode that would not carry one", () => {
    const payload = buildAssistantRequestPayload({
      choice: {
        kind: "exercise",
        option: { exerciseId: CHOSEN_EXERCISE, exerciseName: "杠铃卧推" },
      },
      defaultRange: DEFAULT_RANGE,
      message: "杠铃卧推",
      mode: "auto",
    });

    expect(payload.exercise_id).toBe(CHOSEN_EXERCISE);
  });

  it("uses a date choice's own range instead of the default window", () => {
    const payload = buildAssistantRequestPayload({
      choice: {
        kind: "date_range",
        option: {
          endDate: "2026-07-25",
          label: "上周",
          startDate: "2026-07-19",
        },
      },
      defaultRange: DEFAULT_RANGE,
      message: "上周",
      mode: "auto",
    });

    expect(payload.start_date).toBe("2026-07-19");
    expect(payload.end_date).toBe("2026-07-25");
  });

  it("omits session_id until a session exists", () => {
    const payload = buildAssistantRequestPayload({
      defaultRange: DEFAULT_RANGE,
      message: "你好",
      mode: "auto",
      sessionId: null,
    });

    expect(payload.session_id).toBeUndefined();
  });
});

describe("buildClarificationChoiceMessage", () => {
  it("submits the exercise's display name, matching a typed answer", () => {
    expect(
      buildClarificationChoiceMessage({
        kind: "exercise",
        option: { exerciseId: CHOSEN_EXERCISE, exerciseName: "杠铃卧推" },
      }),
    ).toBe("杠铃卧推");
  });

  it("submits the date option's label", () => {
    expect(
      buildClarificationChoiceMessage({
        kind: "date_range",
        option: {
          endDate: "2026-07-25",
          label: "上周",
          startDate: "2026-07-19",
        },
      }),
    ).toBe("上周");
  });
});
