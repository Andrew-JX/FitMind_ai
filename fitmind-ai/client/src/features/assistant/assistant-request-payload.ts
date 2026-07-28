import type {
  AssistantChatRequestPayload,
  AssistantDateRangeClarificationOption,
  AssistantExerciseClarificationOption,
  AssistantMode,
} from "./assistant-types";

/** A clarification option the user just tapped, if any. */
export type AssistantClarificationChoice =
  | { kind: "exercise"; option: AssistantExerciseClarificationOption }
  | { kind: "date_range"; option: AssistantDateRangeClarificationOption };

export interface BuildAssistantRequestInput {
  choice?: AssistantClarificationChoice | undefined;
  defaultRange: { end_date: string; start_date: string };
  message: string;
  mode: AssistantMode;
  selectedExerciseId?: string | null | undefined;
  sessionId?: string | null | undefined;
}

/** Modes the server cannot answer without an exercise. */
const EXERCISE_MODES: readonly AssistantMode[] = [
  "exercise_progress",
  "plateau_diagnosis",
];

/**
 * Builds one assistant turn request.
 *
 * @remarks
 * The precedence rule this exists to enforce: a clarification the user just
 * answered outranks whatever exercise the analysis tab happens to have selected.
 * Without it, tapping 「杠铃卧推」 in a candidate list could still send the
 * stale id from a page the user visited earlier, and the assistant would answer
 * about the wrong exercise while looking like it obeyed.
 *
 * @param input - Message, mode, ranges, and the optional clarification choice
 * @returns The payload to post for this turn
 */
export function buildAssistantRequestPayload(
  input: BuildAssistantRequestInput,
): AssistantChatRequestPayload {
  const choice = input.choice;
  const range =
    choice?.kind === "date_range"
      ? {
          end_date: choice.option.endDate,
          start_date: choice.option.startDate,
        }
      : input.defaultRange;

  const exerciseId =
    choice?.kind === "exercise"
      ? choice.option.exerciseId
      : EXERCISE_MODES.includes(input.mode) || input.mode === "weekly_report"
        ? (input.selectedExerciseId ?? undefined)
        : undefined;

  return {
    end_date: range.end_date,
    message: input.message,
    mode: input.mode,
    start_date: range.start_date,
    ...(exerciseId === undefined ? {} : { exercise_id: exerciseId }),
    ...(input.sessionId ? { session_id: input.sessionId } : {}),
  };
}

/**
 * The message text a tapped clarification option submits.
 *
 * Sending the display name (rather than an opaque id alone) keeps the user's
 * transcript readable and matches what typing the full name would have sent,
 * which is the same continuation path on the server.
 *
 * @param choice - The tapped option
 * @returns Text for the next user turn
 */
export function buildClarificationChoiceMessage(
  choice: AssistantClarificationChoice,
): string {
  return choice.kind === "exercise"
    ? choice.option.exerciseName
    : choice.option.label;
}
