import type { ApiError } from "./errors";

export interface ApiSuccess<TData> {
  ok: true;
  data: TData;
}

export interface ApiErrorResponse {
  ok: false;
  error: ApiError;
}

export type ApiResponse<TData> = ApiSuccess<TData> | ApiErrorResponse;
