import { z } from "zod";

const isoDatetimeSchema = z.string().datetime({ offset: true });

export const workoutIntakeParseRequestSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  performed_at: isoDatetimeSchema.optional(),
  duration_min: z.number().int().positive().max(600).optional(),
  note: z.string().trim().max(2000).optional(),
});

export const workoutIntakeSetDraftSchema = z.object({
  weight_kg: z.number().nonnegative(),
  reps: z.number().int().positive(),
  rpe: z.number().min(1).max(10).nullable(),
  intensity_label: z.string().nullable(),
});

export const workoutIntakeIncompleteSetDraftSchema = z.object({
  group_count: z.number().int().positive().nullable(),
  weight_kg: z.number().positive().nullable(),
  reps: z.number().int().positive().nullable(),
  missing_fields: z.array(z.enum(["weight_kg", "reps"])).min(1),
  message: z.string().min(1),
});

export const workoutIntakeCandidateExerciseSchema = z.object({
  exercise_id: z.string().uuid(),
  exercise_name: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const workoutIntakeExerciseDraftSchema = z.object({
  input_name: z.string().min(1),
  matched_exercise_id: z.string().uuid().nullable(),
  matched_exercise_name: z.string().min(1).nullable(),
  match_confidence: z.number().min(0).max(1),
  match_status: z.enum(["matched", "ambiguous", "unresolved"]),
  candidate_exercises: z.array(workoutIntakeCandidateExerciseSchema),
  sets: z.array(workoutIntakeSetDraftSchema),
  incomplete_sets: z.array(workoutIntakeIncompleteSetDraftSchema),
});

export const workoutIntakeParseResponseSchema = z.object({
  draft: z.object({
    performed_at: isoDatetimeSchema,
    date_source: z
      .enum(["explicit_text", "request_performed_at", "server_default"])
      .default("server_default"),
    date_label: z.string().nullable().default(null),
    duration_min: z.number().int().positive().max(600).nullable(),
    note: z.string().nullable(),
    exercises: z.array(workoutIntakeExerciseDraftSchema),
  }),
  unresolved_items: z.array(
    z.object({
      text: z.string().min(1),
      reason: z.enum([
        "no_candidates",
        "multiple_candidates",
        "no_sets",
        "incomplete_sets",
      ]),
    }),
  ),
  warnings: z.array(z.string().min(1)),
  evidence: z.object({
    parser_version: z.literal("natural-language-intake-v1"),
    rules: z.array(z.string().min(1)),
    source: z
      .enum([
        "rule_parser",
        "llm_structured_fallback",
        "rule_parser_llm_unavailable",
      ])
      .default("rule_parser"),
    fallback_warnings: z.array(z.string().min(1)).default([]),
  }),
});

export type WorkoutIntakeParseRequest = z.infer<
  typeof workoutIntakeParseRequestSchema
>;

export type WorkoutIntakeParseResponse = z.infer<
  typeof workoutIntakeParseResponseSchema
>;
