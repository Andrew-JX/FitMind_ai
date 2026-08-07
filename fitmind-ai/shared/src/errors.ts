export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "REGISTRATION_CLOSED"
  | "CONSENT_REQUIRED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "AI_QUOTA_EXCEEDED"
  | "AI_PROVIDER_ERROR"
  | "INTERNAL_ERROR";

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown> | undefined;
}
