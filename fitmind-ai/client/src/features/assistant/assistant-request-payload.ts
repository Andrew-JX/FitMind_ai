import type {
  AssistantChatRequestPayload,
  AssistantDateRangeClarificationOption,
  AssistantExerciseClarificationOption,
  AssistantMode,
  AssistantPlanPreferencesWire,
} from "./assistant-types";

/** A clarification option the user just tapped, if any. */
export type AssistantClarificationChoice =
  | { kind: "exercise"; option: AssistantExerciseClarificationOption }
  | { kind: "date_range"; option: AssistantDateRangeClarificationOption };

export interface BuildAssistantRequestInput {
  choice?: AssistantClarificationChoice | undefined;
  message: string;
  mode: AssistantMode;
  selectedExerciseId?: string | null | undefined;
  sessionId?: string | null | undefined;
  planPreferences?: AssistantPlanPreferencesWire | undefined;
  /** IANA zone; defaults to the device's. Injectable for tests. */
  timeZone?: string | undefined;
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
 * ER-2C: the client no longer computes a default window. It sends only what it
 * actually knows — the message, the device's zone, and an explicit range when
 * the user picked one — and the server applies the precedence rules. Sending a
 * client-side default would have outranked the user's own words, because an
 * explicit range is the highest-precedence input: "本周练得怎么样" would have
 * been answered over 30 days.
 *
 * A tapped clarification still sends an explicit range or exercise, which is
 * exactly the precedence the server expects for a continuation. A clarification
 * choice also outranks whatever exercise the analysis tab has selected, so
 * answering "which exercise?" cannot be overridden by a stale id.
 *
 * @param input - Message, mode, zone, and the optional clarification choice
 * @returns The payload to post for this turn
 */
export function buildAssistantRequestPayload(
  input: BuildAssistantRequestInput,
): AssistantChatRequestPayload {
  const choice = input.choice;
  const explicitRange =
    choice?.kind === "date_range"
      ? {
          end_date: choice.option.endDate,
          start_date: choice.option.startDate,
        }
      : undefined;

  const exerciseId =
    choice?.kind === "exercise"
      ? choice.option.exerciseId
      : EXERCISE_MODES.includes(input.mode) || input.mode === "weekly_report"
        ? (input.selectedExerciseId ?? undefined)
        : undefined;

  return {
    message: input.message,
    mode: input.mode,
    timezone: input.timeZone ?? readDeviceTimeZone(),
    ...(explicitRange ?? {}),
    ...(exerciseId === undefined ? {} : { exercise_id: exerciseId }),
    ...(input.sessionId ? { session_id: input.sessionId } : {}),
    ...(input.mode === "next_week_plan" && input.planPreferences
      ? { plan_preferences: input.planPreferences }
      : {}),
  };
}

/**
 * Reads the device's IANA zone.
 *
 * @returns The resolved zone, or UTC when the environment reports none
 */
function readDeviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
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
