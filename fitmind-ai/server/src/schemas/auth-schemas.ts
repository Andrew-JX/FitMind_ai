import { z } from "zod";

const normalizedEmailSchema = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase());

const passwordSchema = z.string().min(8);

const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .transform((value) => value)
  .optional();

export const registerSchema = z.object({
  email: normalizedEmailSchema,
  password: passwordSchema,
  display_name: displayNameSchema,
});

export const loginSchema = z.object({
  email: normalizedEmailSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
