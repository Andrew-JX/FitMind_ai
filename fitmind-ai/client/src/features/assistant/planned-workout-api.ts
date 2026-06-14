import { requestJson } from "../../services/http-client";
import type { AssistantPlanDraft } from "./assistant-types";

export type PlanAdherenceStatus = "done" | "partial" | "missed";

export interface PlanAdherenceExercise {
  exercise_name: string;
  planned_sets: number;
  performed_sets: number;
  status: PlanAdherenceStatus;
  set_completion_ratio: number;
}

export interface PlanAdherence {
  planned_exercise_count: number;
  trained_exercise_count: number;
  extra_exercise_count: number;
  exercise_adherence_ratio: number;
  set_adherence_ratio: number;
  exercises: PlanAdherenceExercise[];
}

/** Wire-shape plan snapshot stored on a planned workout (snake_case). */
export interface PlannedWorkoutPlan {
  strategy: string;
  exercises: Array<{
    exercise_name: string;
    sets: number;
    rep_min: number;
    rep_max: number;
    target_weight_kg: number | null;
    basis: string;
  }>;
  notes: string[];
}

export interface PlannedWorkout {
  id: string;
  status: "active" | "completed" | "abandoned";
  startDate: string;
  endDate: string;
  plan: PlannedWorkoutPlan;
  sourceMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlannedWorkoutWithAdherence extends PlannedWorkout {
  adherence: PlanAdherence;
}

interface AcceptPlanBody {
  startDate: string;
  endDate: string;
  plan: PlannedWorkoutPlan;
  sourceMessageId?: string | undefined;
}

/** Length (in days) of the forward target window opened when accepting a plan. */
const PLAN_WINDOW_DAYS = 7;

/**
 * Converts the normalized client plan draft back into the server wire shape.
 *
 * @param plan - The normalized assistant plan draft
 * @returns The snake_case plan snapshot accepted by the API
 */
export function denormalizePlanDraft(plan: AssistantPlanDraft): PlannedWorkoutPlan {
  return {
    strategy: plan.strategy,
    exercises: plan.exercises.map((exercise) => ({
      exercise_name: exercise.exerciseName,
      sets: exercise.sets,
      rep_min: exercise.repMin,
      rep_max: exercise.repMax,
      target_weight_kg: exercise.targetWeightKg,
      basis: exercise.basis,
    })),
    notes: plan.notes,
  };
}

/**
 * Builds the inclusive forward week window (today .. today + 6) for a new plan.
 *
 * @param today - Reference date (defaults to now); injectable for tests
 * @returns The start and end date-only strings
 */
export function createForwardWeekRange(today: Date = new Date()): {
  startDate: string;
  endDate: string;
} {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + (PLAN_WINDOW_DAYS - 1));

  return {
    startDate: formatDateOnly(start),
    endDate: formatDateOnly(end),
  };
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Loads the user's active plan with adherence, or null when none exists.
 *
 * @param token - In-memory auth token
 * @returns The active planned workout with adherence, or null
 */
export async function getCurrentPlannedWorkout(
  token: string | null,
): Promise<PlannedWorkoutWithAdherence | null> {
  const data = await requestJson<{
    plannedWorkout: PlannedWorkoutWithAdherence | null;
  }>("/api/planned-workouts/current", { token });

  return data.plannedWorkout;
}

/**
 * Accepts a generated plan draft as the user's active weekly plan.
 *
 * @param token - In-memory auth token
 * @param input - The plan draft and optional source message id
 * @returns The persisted planned workout
 */
export async function acceptPlannedWorkout(
  token: string | null,
  input: { plan: AssistantPlanDraft; sourceMessageId?: string | undefined },
): Promise<PlannedWorkout> {
  const range = createForwardWeekRange();
  const body: AcceptPlanBody = {
    startDate: range.startDate,
    endDate: range.endDate,
    plan: denormalizePlanDraft(input.plan),
    ...(input.sourceMessageId ? { sourceMessageId: input.sourceMessageId } : {}),
  };

  const data = await requestJson<{ plannedWorkout: PlannedWorkout }, AcceptPlanBody>(
    "/api/planned-workouts",
    { method: "POST", body, token },
  );

  return data.plannedWorkout;
}

/**
 * Marks a planned workout as abandoned.
 *
 * @param token - In-memory auth token
 * @param planId - The plan id to abandon
 * @returns The updated planned workout
 */
export async function abandonPlannedWorkout(
  token: string | null,
  planId: string,
): Promise<PlannedWorkout> {
  const data = await requestJson<
    { plannedWorkout: PlannedWorkout },
    { status: "abandoned" }
  >(`/api/planned-workouts/${planId}`, {
    method: "PATCH",
    body: { status: "abandoned" },
    token,
  });

  return data.plannedWorkout;
}
