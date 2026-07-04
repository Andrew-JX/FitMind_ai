import type { ApiResponse } from "../../../../shared/src/api-response";
import type { ApiError } from "../../../../shared/src/errors";
import { HttpClientError } from "../../services/http-client";
import type {
  AssistantChatRequestPayload,
  AssistantStreamEvent,
} from "./assistant-types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

interface ParsedErrorBody {
  ok?: false | undefined;
  error?: ApiError | undefined;
}

export interface StreamAssistantChatOptions {
  onEvent: (event: AssistantStreamEvent) => void;
  signal?: AbortSignal | undefined;
  token: string;
}

/**
 * Opens one assistant SSE request and emits parsed project-owned events.
 *
 * @param payload - Backend stream-turn request payload.
 * @param options - Auth token, abort signal, and event callback.
 * @returns Resolves when the SSE response stream has completed.
 */
export async function streamAssistantChat(
  payload: AssistantChatRequestPayload,
  options: StreamAssistantChatOptions,
): Promise<void> {
  const headers = new Headers({
    Accept: "text/event-stream",
    "Content-Type": "application/json",
    Authorization: `Bearer ${options.token}`,
  });

  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}/api/assistant/stream-turn`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: options.signal,
      // Send the HttpOnly auth session cookie alongside the bearer fallback.
      credentials: "include",
    });
  } catch (error) {
    throw createNetworkError(error);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok || !contentType.includes("text/event-stream")) {
    const rawText = await response.text();
    const parsed = parseJson<ApiResponse<unknown> | ParsedErrorBody>(rawText);
    const apiError = parsed && "error" in parsed ? parsed.error : undefined;

    throw new HttpClientError({
      code: apiError?.code ?? "INVALID_RESPONSE",
      message:
        apiError?.message ??
        getFallbackMessage(response.status) ??
        "The assistant stream could not be opened.",
      details: apiError?.details,
      status: response.status,
    });
  }

  const body = response.body;

  if (!body) {
    throw new HttpClientError({
      code: "INVALID_RESPONSE",
      message: "The assistant stream returned no response body.",
      status: response.status,
    });
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      buffer = flushSseFrames(buffer, options.onEvent);
    }

    buffer += decoder.decode();
    flushSseFrames(buffer, options.onEvent);
  } finally {
    reader.releaseLock();
  }
}

function flushSseFrames(
  input: string,
  onEvent: (event: AssistantStreamEvent) => void,
): string {
  let buffer = input;

  while (true) {
    const separatorIndex = buffer.indexOf("\n\n");

    if (separatorIndex === -1) {
      return buffer;
    }

    const frame = buffer.slice(0, separatorIndex).trim();
    buffer = buffer.slice(separatorIndex + 2);

    if (frame.length === 0) {
      continue;
    }

    onEvent(parseSseFrame(frame));
  }
}

function parseSseFrame(frame: string): AssistantStreamEvent {
  const lines = frame.split("\n");
  const eventLine = lines.find((line) => line.startsWith("event: "));
  const dataLines = lines
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice("data: ".length));

  if (!eventLine || dataLines.length === 0) {
    throw new HttpClientError({
      code: "INVALID_RESPONSE",
      message: "The assistant stream returned a malformed SSE frame.",
    });
  }

  const payload = parseJson<AssistantStreamEvent>(dataLines.join("\n"));

  if (!payload) {
    throw new HttpClientError({
      code: "INVALID_RESPONSE",
      message: "The assistant stream returned unreadable event data.",
    });
  }

  const eventType = eventLine.slice("event: ".length);

  if (payload.type !== eventType) {
    throw new HttpClientError({
      code: "INVALID_RESPONSE",
      message: "The assistant stream returned mismatched event metadata.",
    });
  }

  return payload;
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
    message:
      "Unable to reach the server. Check that the FitMind API is running.",
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
    return "登录状态已失效，请重新登录。";
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
