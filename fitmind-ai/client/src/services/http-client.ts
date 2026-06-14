import type { ApiResponse } from "../../../shared/src/api-response";
import type { ApiError } from "../../../shared/src/errors";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export interface HttpRequestOptions<TBody> {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: TBody;
  token?: string | null | undefined;
  signal?: AbortSignal;
}

export interface HttpClientErrorOptions {
  code: ApiError["code"] | "NETWORK_ERROR" | "INVALID_RESPONSE";
  message: string;
  details?: Record<string, unknown> | undefined;
  status?: number | undefined;
}

export class HttpClientError extends Error {
  public readonly code: HttpClientErrorOptions["code"];
  public readonly details?: Record<string, unknown> | undefined;
  public readonly status?: number | undefined;

  public constructor(options: HttpClientErrorOptions) {
    super(options.message);
    this.name = "HttpClientError";
    this.code = options.code;
    this.details = options.details;
    this.status = options.status;
  }
}

interface ParsedErrorBody {
  ok?: false | undefined;
  error?: ApiError | undefined;
}

/**
 * Sends a JSON request to the FitMind API and returns the unwrapped `data` payload.
 *
 * @param path - API path such as `/api/auth/me`
 * @param options - Request method, body, token, and abort signal
 * @returns The successful response payload
 */
export async function requestJson<TResponse, TBody = undefined>(
  path: string,
  options: HttpRequestOptions<TBody> = {},
): Promise<TResponse> {
  const { method = "GET", body, token, signal } = options;
  const headers = new Headers({
    Accept: "application/json",
  });

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      // Send/receive the HttpOnly auth session cookie on every request.
      credentials: "include",
    });
  } catch (error) {
    throw createNetworkError(error);
  }

  const rawText = await response.text();
  const payload = parseJson<ApiResponse<TResponse> | ParsedErrorBody>(rawText);

  if (!payload) {
    throw new HttpClientError({
      code: "INVALID_RESPONSE",
      message: "The server returned an unreadable response.",
      status: response.status,
    });
  }

  if (!response.ok || payload.ok === false) {
    const apiError = "error" in payload ? payload.error : undefined;

    throw new HttpClientError({
      code: apiError?.code ?? "INVALID_RESPONSE",
      message:
        apiError?.message ??
        getFallbackMessage(response.status) ??
        "The request could not be completed.",
      details: apiError?.details,
      status: response.status,
    });
  }

  if (payload.ok !== true || !("data" in payload)) {
    throw new HttpClientError({
      code: "INVALID_RESPONSE",
      message: "The server response is missing the expected data payload.",
      status: response.status,
    });
  }

  return payload.data;
}

function createNetworkError(error: unknown): HttpClientError {
  if (error instanceof Error && error.name === "AbortError") {
    return new HttpClientError({
      code: "NETWORK_ERROR",
      message: "The request was cancelled before it completed.",
    });
  }

  return new HttpClientError({
    code: "NETWORK_ERROR",
    message: "Unable to reach the server. Check that the FitMind API is running.",
  });
}

function parseJson<TParsed>(rawText: string): TParsed | null {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as TParsed;
  } catch {
    return null;
  }
}

function getFallbackMessage(status: number): string | null {
  if (status === 401) {
    return "Your session is not authorized. Please sign in again.";
  }

  if (status === 403) {
    return "You do not have permission to access this resource.";
  }

  if (status === 404) {
    return "The requested resource could not be found.";
  }

  if (status >= 500) {
    return "The server encountered an error while processing the request.";
  }

  return null;
}
