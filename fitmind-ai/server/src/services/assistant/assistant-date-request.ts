import {
  computeAssistantDefaultRange,
  resolveAssistantDateRange,
  type AssistantDateOption,
  type AssistantDateRange,
} from "./assistant-date-resolver.js";

/** Where the range a turn ran against actually came from. */
export type AssistantDateRangeSource = "explicit" | "term" | "default";

export type AssistantDateRequestOutcome =
  | {
      status: "range";
      range: AssistantDateRange;
      source: AssistantDateRangeSource;
      /** Present only for `term`; the vocabulary word the user actually used. */
      label?: string | undefined;
    }
  | { status: "ambiguous"; options: AssistantDateOption[] };

/** Inclusive default window when a turn names no supported period. */
export const ASSISTANT_DEFAULT_RANGE_DAYS = 30;

export interface AssistantDateRequestInput {
  end_date?: string | undefined;
  message: string;
  now?: Date | undefined;
  start_date?: string | undefined;
  timeZone: string;
}

/**
 * Applies the arc's fixed date precedence to one turn.
 *
 * The order is explicit range, then one supported time term, then the server
 * default. A caller-supplied range wins outright: it is how a tapped date
 * clarification continues, and it is also how any older client that still sends
 * its own window keeps working unchanged.
 *
 * Time language is only consulted when no explicit range was sent, so a
 * message that both carries a range and mentions a period cannot have its
 * range silently rewritten underneath it.
 *
 * @param input - Optional explicit range, message, zone, reference instant
 * @returns The range to run against, or an ambiguity for the caller to ask about
 */
export function resolveAssistantDateRequest(
  input: AssistantDateRequestInput,
): AssistantDateRequestOutcome {
  if (input.start_date !== undefined && input.end_date !== undefined) {
    return {
      range: { end_date: input.end_date, start_date: input.start_date },
      source: "explicit",
      status: "range",
    };
  }

  const resolution = resolveAssistantDateRange({
    message: input.message,
    now: input.now,
    timeZone: input.timeZone,
  });

  if (resolution.status === "ambiguous") {
    return { options: resolution.options, status: "ambiguous" };
  }

  if (resolution.status === "resolved") {
    return {
      label: resolution.option.label,
      range: {
        end_date: resolution.option.end_date,
        start_date: resolution.option.start_date,
      },
      source: "term",
      status: "range",
    };
  }

  return {
    range: computeAssistantDefaultRange({
      days: ASSISTANT_DEFAULT_RANGE_DAYS,
      now: input.now,
      timeZone: input.timeZone,
    }),
    source: "default",
    status: "range",
  };
}
