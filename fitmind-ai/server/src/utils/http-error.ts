type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "REGISTRATION_CLOSED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "AI_QUOTA_EXCEEDED"
  | "AI_PROVIDER_ERROR"
  | "INTERNAL_ERROR";

interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown> | undefined;
}

/**
 * Application error carrying an HTTP status and API error payload metadata.
 */
export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown> | undefined;

  /**
   * Create an HTTP-aware application error.
   *
   * @param statusCode - HTTP status code.
   * @param code - Stable API error code.
   * @param message - Human-readable error message.
   * @param details - Optional structured error details.
   */
  public constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown> | undefined,
  ) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  /**
   * Convert the error into the API contract shape.
   *
   * @returns Structured API error payload.
   */
  public toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * Narrow an unknown error value to HttpError.
 *
 * @param error - Unknown thrown value.
 * @returns True when the value is an HttpError instance.
 */
export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}
