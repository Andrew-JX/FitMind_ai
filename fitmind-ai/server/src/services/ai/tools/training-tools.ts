import { z } from "zod";

import {
  getUserExerciseProgress,
  type ExerciseProgressResponseData,
} from "../../training/exercise-progress-service.js";
import {
  getUserRecommendationContext,
  type RecommendationContextResponseData,
} from "../../training/recommendation-context-service.js";
import {
  getUserTrainingSummary,
  type TrainingSummaryResponseData,
} from "../../training/training-summary-service.js";
import {
  getUserWeeklyTrainingReport,
  type WeeklyTrainingReportResponseData,
} from "../../training/weekly-training-report-service.js";
import { isValidDateOnly, type AiToolDefinition } from "./tool-types.js";

const dateRangeSchema = z
  .object({
    start_date: z
      .string()
      .refine(isValidDateOnly, "start_date must use YYYY-MM-DD."),
    end_date: z
      .string()
      .refine(isValidDateOnly, "end_date must use YYYY-MM-DD."),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.start_date > value.end_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: "end_date must be on or after start_date.",
      });
    }
  });

const trainingSummaryArgsSchema = dateRangeSchema;
const recommendationContextArgsSchema = dateRangeSchema;
const weeklyTrainingReportArgsSchema = dateRangeSchema
  .extend({
    exercise_id: z.string().uuid().optional(),
  })
  .strict();
const exerciseProgressArgsSchema = dateRangeSchema
  .extend({
    exercise_id: z.string().uuid(),
  })
  .strict();

export type GetTrainingSummaryArgs = z.infer<typeof trainingSummaryArgsSchema>;
export type GetExerciseProgressArgs = z.infer<
  typeof exerciseProgressArgsSchema
>;
export type GetRecommendationContextArgs = z.infer<
  typeof recommendationContextArgsSchema
>;
export type GetWeeklyTrainingReportArgs = z.infer<
  typeof weeklyTrainingReportArgsSchema
>;

export const trainingAiTools = [
  {
    name: "get_training_summary",
    description:
      "Return the authenticated user's deterministic training summary for one inclusive YYYY-MM-DD date range.",
    inputSchema: trainingSummaryArgsSchema,
    execute: (context, args) => getUserTrainingSummary(context.userId, args),
  } satisfies AiToolDefinition<
    GetTrainingSummaryArgs,
    TrainingSummaryResponseData
  >,
  {
    name: "get_exercise_progress",
    description:
      "Return the authenticated user's deterministic progress view for one exercise_id and one inclusive YYYY-MM-DD date range.",
    inputSchema: exerciseProgressArgsSchema,
    execute: (context, args) =>
      getUserExerciseProgress(context.userId, args.exercise_id, {
        start_date: args.start_date,
        end_date: args.end_date,
      }),
  } satisfies AiToolDefinition<
    GetExerciseProgressArgs,
    ExerciseProgressResponseData
  >,
  {
    name: "get_recommendation_context",
    description:
      "Return the authenticated user's deterministic recommendation context package for one inclusive YYYY-MM-DD date range.",
    inputSchema: recommendationContextArgsSchema,
    execute: (context, args) =>
      getUserRecommendationContext(context.userId, args),
  } satisfies AiToolDefinition<
    GetRecommendationContextArgs,
    RecommendationContextResponseData
  >,
  {
    name: "get_weekly_training_report",
    description:
      "Return the authenticated user's deterministic weekly training coach report for one inclusive YYYY-MM-DD date range and optional exercise_id.",
    inputSchema: weeklyTrainingReportArgsSchema,
    execute: (context, args) =>
      getUserWeeklyTrainingReport(context.userId, args),
  } satisfies AiToolDefinition<
    GetWeeklyTrainingReportArgs,
    WeeklyTrainingReportResponseData
  >,
] as const;
