import { createDefaultAssistantRange } from "./assistant-date-range";

export type PlanLifecycle = "active" | "expired";

export interface ClassifyPlanLifecycleInput {
  endDate: string;
  today: string;
}

/**
 * Classifies a plan using date-only values, with an inclusive end date.
 *
 * @param input - The plan end date and the injected local calendar date
 * @returns `expired` only when the plan ended before today
 */
export function classifyPlanLifecycle({
  endDate,
  today,
}: ClassifyPlanLifecycleInput): PlanLifecycle {
  return endDate < today ? "expired" : "active";
}

/**
 * Reads today's local calendar date through the assistant's shared formatter.
 *
 * @returns Today's local date as `YYYY-MM-DD`
 */
export function getLocalPlanToday(): string {
  return createDefaultAssistantRange().end_date;
}
