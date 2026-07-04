import { ZodError } from "zod";

import { createToolCallLog } from "../../../db/tool-call-log-repository.js";
import { trainingAiTools } from "./training-tools.js";
import {
  type AiToolValidationError,
  normalizeToolValidationError,
  UnknownAiToolError,
  type AiToolDefinition,
  type AiToolExecutionContext,
} from "./tool-types.js";

const aiToolRegistry = new Map<string, AiToolDefinition<unknown, unknown>>(
  trainingAiTools.map((tool) => [
    tool.name,
    tool as AiToolDefinition<unknown, unknown>,
  ]),
);

export function getAiToolRegistry(): ReadonlyMap<
  string,
  AiToolDefinition<unknown, unknown>
> {
  return aiToolRegistry;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shouldRedactKey(key: string): boolean {
  return /(token|authorization|password|secret|key)/iu.test(key);
}

function isSensitiveString(value: string): boolean {
  const normalizedValue = value.trim();
  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = process.env.JWT_SECRET;

  return (
    /^bearer\s+/iu.test(normalizedValue) ||
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(normalizedValue) ||
    (databaseUrl !== undefined && normalizedValue === databaseUrl) ||
    (jwtSecret !== undefined && normalizedValue === jwtSecret)
  );
}

function sanitizeForToolLog(value: unknown): unknown {
  if (value === null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    if (typeof value === "string" && isSensitiveString(value)) {
      return "[REDACTED]";
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForToolLog(item));
  }

  if (isRecord(value)) {
    const sanitizedEntries = Object.entries(value).map(([key, itemValue]) => [
      key,
      shouldRedactKey(key) ? "[REDACTED]" : sanitizeForToolLog(itemValue),
    ]);

    return Object.fromEntries(sanitizedEntries);
  }

  return String(value);
}

function summarizeTrainingSummaryResult(result: unknown): unknown {
  if (!isRecord(result)) {
    return null;
  }

  const range = result.range;
  const totals = result.totals;
  const byExercise = result.by_exercise;
  const evidence = result.evidence;

  return {
    range: sanitizeForToolLog(range),
    totals: sanitizeForToolLog(totals),
    by_exercise_count: Array.isArray(byExercise) ? byExercise.length : 0,
    evidence_workout_count:
      isRecord(evidence) && Array.isArray(evidence.workout_ids)
        ? evidence.workout_ids.length
        : 0,
  };
}

function summarizeExerciseProgressResult(result: unknown): unknown {
  if (!isRecord(result)) {
    return null;
  }

  const range = result.range;
  const exercise = result.exercise;
  const totals = result.totals;
  const sessions = result.sessions;
  const evidence = result.evidence;

  return {
    range: sanitizeForToolLog(range),
    exercise_id:
      isRecord(exercise) && typeof exercise.exercise_id === "string"
        ? exercise.exercise_id
        : null,
    totals: sanitizeForToolLog(totals),
    session_count: Array.isArray(sessions) ? sessions.length : 0,
    evidence_workout_count:
      isRecord(evidence) && Array.isArray(evidence.workout_ids)
        ? evidence.workout_ids.length
        : 0,
    evidence_set_count:
      isRecord(evidence) && Array.isArray(evidence.set_ids)
        ? evidence.set_ids.length
        : 0,
  };
}

function summarizeRecommendationContextResult(result: unknown): unknown {
  if (!isRecord(result)) {
    return null;
  }

  const range = result.range;
  const summary = result.summary;
  const focusExercises = result.focus_exercises;
  const recentWorkouts = result.recent_workouts;
  const evidence = result.evidence;

  return {
    range: sanitizeForToolLog(range),
    summary: sanitizeForToolLog(summary),
    focus_exercise_count: Array.isArray(focusExercises)
      ? focusExercises.length
      : 0,
    recent_workout_count: Array.isArray(recentWorkouts)
      ? recentWorkouts.length
      : 0,
    evidence_workout_count:
      isRecord(evidence) && Array.isArray(evidence.workout_ids)
        ? evidence.workout_ids.length
        : 0,
    evidence_set_count:
      isRecord(evidence) && Array.isArray(evidence.set_ids)
        ? evidence.set_ids.length
        : 0,
  };
}

function summarizeWeeklyTrainingReportResult(result: unknown): unknown {
  if (!isRecord(result)) {
    return null;
  }

  const range = result.range;
  const status = result.status;
  const totals = result.totals;
  const frequency = result.frequency;
  const topExercises = result.top_exercises;
  const topMuscleGroups = result.top_muscle_groups;
  const lowVolumeMuscleGroups = result.low_volume_muscle_groups;
  const evidence = result.evidence;

  return {
    range: sanitizeForToolLog(range),
    status: sanitizeForToolLog(status),
    totals: sanitizeForToolLog(totals),
    frequency: sanitizeForToolLog(frequency),
    top_exercise_count: Array.isArray(topExercises) ? topExercises.length : 0,
    top_muscle_group_count: Array.isArray(topMuscleGroups)
      ? topMuscleGroups.length
      : 0,
    low_volume_muscle_group_count: Array.isArray(lowVolumeMuscleGroups)
      ? lowVolumeMuscleGroups.length
      : 0,
    evidence_workout_count:
      isRecord(evidence) && Array.isArray(evidence.workout_ids)
        ? evidence.workout_ids.length
        : 0,
    evidence_set_count:
      isRecord(evidence) && Array.isArray(evidence.set_ids)
        ? evidence.set_ids.length
        : 0,
  };
}

function summarizeSuccessfulToolOutput(
  toolName: string,
  result: unknown,
): unknown {
  switch (toolName) {
    case "get_training_summary":
      return summarizeTrainingSummaryResult(result);
    case "get_exercise_progress":
      return summarizeExerciseProgressResult(result);
    case "get_recommendation_context":
      return summarizeRecommendationContextResult(result);
    case "get_weekly_training_report":
      return summarizeWeeklyTrainingReportResult(result);
    default:
      return null;
  }
}

function summarizeValidationError(error: AiToolValidationError): unknown {
  return {
    error_code: error.code,
    issue_count: error.issues.length,
    issue_paths: error.issues.map((issue) => issue.path),
  };
}

async function persistToolCallLog(input: {
  userId: string;
  toolName: string;
  toolInput: unknown;
  toolOutput: unknown;
  durationMs: number;
  status: "success" | "error";
  errorMessage: string | null;
}): Promise<void> {
  try {
    await createToolCallLog({
      messageId: null,
      userId: input.userId,
      toolName: input.toolName,
      toolInput: input.toolInput,
      toolOutput: input.toolOutput,
      durationMs: input.durationMs,
      status: input.status,
      errorMessage: input.errorMessage,
    });
  } catch {
    // Best-effort log persistence must not mask tool execution outcomes.
  }
}

export async function executeAiTool(
  context: AiToolExecutionContext,
  toolName: string,
  rawArgs: unknown,
): Promise<unknown> {
  const startedAt = Date.now();
  const sanitizedInput = sanitizeForToolLog(rawArgs);
  const tool = aiToolRegistry.get(toolName);

  if (tool === undefined) {
    const error = new UnknownAiToolError(toolName);

    await persistToolCallLog({
      userId: context.userId,
      toolName,
      toolInput: sanitizedInput,
      toolOutput: {
        error_code: error.code,
      },
      durationMs: Math.max(0, Date.now() - startedAt),
      status: "error",
      errorMessage: error.message,
    });

    throw error;
  }

  try {
    const parsedArgs = tool.inputSchema.parse(rawArgs);
    const result = await tool.execute(context, parsedArgs);

    await persistToolCallLog({
      userId: context.userId,
      toolName,
      toolInput: sanitizeForToolLog(parsedArgs),
      toolOutput: summarizeSuccessfulToolOutput(toolName, result),
      durationMs: Math.max(0, Date.now() - startedAt),
      status: "success",
      errorMessage: null,
    });

    return result;
  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = normalizeToolValidationError(error);

      await persistToolCallLog({
        userId: context.userId,
        toolName,
        toolInput: sanitizedInput,
        toolOutput: summarizeValidationError(validationError),
        durationMs: Math.max(0, Date.now() - startedAt),
        status: "error",
        errorMessage: validationError.message,
      });

      throw validationError;
    }

    await persistToolCallLog({
      userId: context.userId,
      toolName,
      toolInput: sanitizedInput,
      toolOutput: null,
      durationMs: Math.max(0, Date.now() - startedAt),
      status: "error",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unknown tool execution error.",
    });

    throw error;
  }
}
