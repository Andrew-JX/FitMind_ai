import { requestJson } from "../../services/http-client";

export type WorkoutIntakeMatchStatus = "matched" | "ambiguous" | "unresolved";

export interface WorkoutIntakeParseInput {
  duration_min?: number | undefined;
  note?: string | undefined;
  performed_at?: string | undefined;
  text: string;
}

export interface WorkoutIntakeCandidateExercise {
  confidence: number;
  exercise_id: string;
  exercise_name: string;
}

export interface WorkoutIntakeDraftSet {
  intensity_label: string | null;
  reps: number;
  rpe: number | null;
  weight_kg: number;
}

export interface WorkoutIntakeIncompleteSet {
  group_count: number | null;
  message: string;
  missing_fields: Array<"weight_kg" | "reps">;
  reps: number | null;
  weight_kg: number | null;
}

export interface WorkoutIntakeDraftExercise {
  candidate_exercises: WorkoutIntakeCandidateExercise[];
  incomplete_sets: WorkoutIntakeIncompleteSet[];
  input_name: string;
  match_confidence: number;
  match_status: WorkoutIntakeMatchStatus;
  matched_exercise_id: string | null;
  matched_exercise_name: string | null;
  sets: WorkoutIntakeDraftSet[];
}

export interface WorkoutIntakeDraft {
  date_label: string | null;
  date_source: "explicit_text" | "request_performed_at" | "server_default";
  duration_min: number | null;
  exercises: WorkoutIntakeDraftExercise[];
  note: string | null;
  performed_at: string;
}

export interface WorkoutIntakeUnresolvedItem {
  reason: string;
  text: string;
}

export interface WorkoutIntakeEvidence {
  fallback_warnings?: string[] | undefined;
  parser_version: string;
  rules: string[];
  source?:
    | "llm_structured_fallback"
    | "rule_parser"
    | "rule_parser_llm_unavailable"
    | undefined;
}

export interface WorkoutIntakeParseResponse {
  draft: WorkoutIntakeDraft;
  evidence: WorkoutIntakeEvidence;
  unresolved_items: WorkoutIntakeUnresolvedItem[];
  warnings: string[];
}

export async function parseWorkoutIntake(
  token: string,
  input: WorkoutIntakeParseInput,
  signal?: AbortSignal,
): Promise<WorkoutIntakeParseResponse> {
  return requestJson<WorkoutIntakeParseResponse, WorkoutIntakeParseInput>(
    "/api/training/workout-intake/parse",
    {
      body: input,
      method: "POST",
      signal,
      token,
    },
  );
}
