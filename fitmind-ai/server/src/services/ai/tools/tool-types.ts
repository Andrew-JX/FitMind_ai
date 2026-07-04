import { ZodError, type ZodType } from "zod";

export interface AiToolExecutionContext {
  userId: string;
}

export interface AiToolDefinition<TArgs, TResult> {
  name: string;
  description: string;
  inputSchema: ZodType<TArgs>;
  execute: (context: AiToolExecutionContext, args: TArgs) => Promise<TResult>;
}

export class UnknownAiToolError extends Error {
  public readonly code = "UNKNOWN_TOOL";

  public constructor(toolName: string) {
    super(`Unknown tool: ${toolName}`);
    this.name = "UnknownAiToolError";
  }
}

export class AiToolValidationError extends Error {
  public readonly code = "VALIDATION_ERROR";
  public readonly issues: Array<{
    path: string;
    message: string;
  }>;

  public constructor(issues: Array<{ path: string; message: string }>) {
    super("Tool argument validation failed.");
    this.name = "AiToolValidationError";
    this.issues = issues;
  }
}

export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }

  const [yearValue, monthValue, dayValue] = value.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

export function normalizeToolValidationError(
  error: ZodError,
): AiToolValidationError {
  return new AiToolValidationError(
    error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  );
}
