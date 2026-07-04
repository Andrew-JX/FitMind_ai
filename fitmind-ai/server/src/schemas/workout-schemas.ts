import { z } from "zod";

const isoDatetimeSchema = z.string().datetime({ offset: true });

const optionalTrimmedStringSchema = z.string().trim().max(2000).optional();

const positiveIntegerSchema = z.number().int().positive();

const nonNegativeNumberSchema = z.number().nonnegative();

const setInputSchema = z.object({
  exercise_id: z.string().uuid(),
  set_index: positiveIntegerSchema,
  reps: z.number().int().nonnegative(),
  weight_kg: nonNegativeNumberSchema,
  rpe: z.number().min(1).max(10).optional(),
  is_warmup: z.boolean(),
  notes: optionalTrimmedStringSchema,
});

export const createWorkoutSchema = z
  .object({
    performed_at: isoDatetimeSchema,
    started_at: isoDatetimeSchema.nullable().optional(),
    ended_at: isoDatetimeSchema.nullable().optional(),
    duration_minutes: positiveIntegerSchema.optional(),
    notes: optionalTrimmedStringSchema,
    sets: z.array(setInputSchema).min(1),
  })
  .refine(hasValidTimeRange, {
    message: "started_at must be before ended_at",
    path: ["ended_at"],
  });

export const updateWorkoutSchema = z
  .object({
    performed_at: isoDatetimeSchema.optional(),
    started_at: isoDatetimeSchema.nullable().optional(),
    ended_at: isoDatetimeSchema.nullable().optional(),
    duration_minutes: positiveIntegerSchema.optional(),
    notes: optionalTrimmedStringSchema,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  })
  .refine(hasValidTimeRange, {
    message: "started_at must be before ended_at",
    path: ["ended_at"],
  });

export const addWorkoutSetSchema = setInputSchema;

export const updateWorkoutSetSchema = z
  .object({
    exercise_id: z.string().uuid().optional(),
    set_index: positiveIntegerSchema.optional(),
    reps: z.number().int().nonnegative().optional(),
    weight_kg: nonNegativeNumberSchema.optional(),
    rpe: z.number().min(1).max(10).optional(),
    is_warmup: z.boolean().optional(),
    notes: optionalTrimmedStringSchema,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const workoutListQuerySchema = z.object({
  from: isoDatetimeSchema.optional(),
  to: isoDatetimeSchema.optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;
export type UpdateWorkoutInput = z.infer<typeof updateWorkoutSchema>;
export type AddWorkoutSetInput = z.infer<typeof addWorkoutSetSchema>;
export type UpdateWorkoutSetInput = z.infer<typeof updateWorkoutSetSchema>;
export type WorkoutListQueryInput = z.infer<typeof workoutListQuerySchema>;

function hasValidTimeRange(value: {
  ended_at?: string | null | undefined;
  started_at?: string | null | undefined;
}): boolean {
  if (!value.started_at || !value.ended_at) {
    return true;
  }

  return (
    new Date(value.started_at).getTime() < new Date(value.ended_at).getTime()
  );
}
