export interface ApiErrorShape {
  code: string;
  message: string;
  details?: Record<string, unknown> | undefined;
}

export interface ApiSuccess<TData> {
  ok: true;
  data: TData;
}

export interface ApiErrorResponse {
  ok: false;
  error: ApiErrorShape;
}

export type ApiResponse<TData> = ApiSuccess<TData> | ApiErrorResponse;

/**
 * Create a successful API response payload.
 *
 * @param data - Successful response data.
 * @returns Response payload with the standard success envelope.
 */
export function createSuccessResponse<TData>(data: TData): ApiSuccess<TData> {
  return {
    ok: true,
    data,
  };
}

/**
 * Create a failed API response payload.
 *
 * @param error - API error details.
 * @returns Response payload with the standard error envelope.
 */
export function createErrorResponse(error: ApiErrorShape): ApiResponse<never> {
  return {
    ok: false,
    error,
  };
}
