import { useEffect, useRef, useState } from "react";

import { HttpClientError } from "../../services/http-client";
import { streamAssistantChat } from "./assistant-stream-api";
import type {
  AssistantActiveToolCall,
  AssistantChatMessage,
  AssistantChatRequestPayload,
  AssistantProvider,
  AssistantChatStatus,
  AssistantStreamEvent,
} from "./assistant-types";

export interface UseAssistantChatResult {
  abort: () => void;
  activeToolCall: AssistantActiveToolCall | null;
  clearConversation: () => void;
  errorMessage: string | null;
  isStreaming: boolean;
  messages: AssistantChatMessage[];
  provider: AssistantProvider | null;
  retryLast: () => Promise<void>;
  sendMessage: (payload: AssistantChatRequestPayload) => Promise<void>;
  sessionId: string | null;
  status: AssistantChatStatus;
}

/**
 * Maintains the frontend assistant chat state machine over the SSE endpoint.
 *
 * @param token - Current in-memory auth token.
 * @returns Messages, stream status, tool state, and chat actions.
 */
export function useAssistantChat(token: string | null): UseAssistantChatResult {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [status, setStatus] = useState<AssistantChatStatus>("idle");
  const [activeToolCall, setActiveToolCall] = useState<AssistantActiveToolCall | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [provider, setProvider] = useState<AssistantProvider | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastSubmittedPayload, setLastSubmittedPayload] =
    useState<AssistantChatRequestPayload | null>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const activeAssistantMessageIdRef = useRef<string | null>(null);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    if (token) {
      return;
    }

    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;
    activeAssistantMessageIdRef.current = null;
    setMessages([]);
    setStatus("idle");
    setActiveToolCall(null);
    setErrorMessage(null);
    setIsStreaming(false);
    setProvider(null);
    setSessionId(null);
    setLastSubmittedPayload(null);
  }, [token]);

  return {
    abort,
    activeToolCall,
    clearConversation,
    errorMessage,
    isStreaming,
    messages,
    provider,
    retryLast,
    sendMessage,
    sessionId,
    status,
  };

  async function sendMessage(payload: AssistantChatRequestPayload): Promise<void> {
    if (!token) {
      setStatus("error");
      setErrorMessage("You must be signed in to use the assistant.");
      return;
    }

    const trimmedMessage = payload.message.trim();

    if (trimmedMessage.length === 0) {
      setStatus("error");
      setErrorMessage("Assistant message is required.");
      return;
    }

    activeAbortControllerRef.current?.abort();

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    const abortController = new AbortController();
    const assistantMessageId = `assistant-${requestId}`;
    const userMessageId = `user-${requestId}`;
    const requestPayload: AssistantChatRequestPayload = {
      ...payload,
      message: trimmedMessage,
      session_id: sessionId ?? payload.session_id,
    };

    activeAbortControllerRef.current = abortController;
    activeAssistantMessageIdRef.current = assistantMessageId;
    setLastSubmittedPayload(requestPayload);
    setErrorMessage(null);
    setActiveToolCall(null);
    setProvider(null);
    setIsStreaming(true);
    setStatus("thinking");
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: userMessageId,
        role: "user",
        text: trimmedMessage,
      },
      {
        id: assistantMessageId,
        role: "assistant",
        text: "",
        isStreaming: true,
      },
    ]);

    try {
      await streamAssistantChat(requestPayload, {
        token,
        signal: abortController.signal,
        onEvent: (event) => {
          if (requestSequenceRef.current !== requestId) {
            return;
          }

          handleStreamEvent(event, assistantMessageId);
        },
      });

      if (
        requestSequenceRef.current === requestId &&
        status !== "error" &&
        activeAbortControllerRef.current === abortController
      ) {
        activeAbortControllerRef.current = null;
      }
    } catch (error) {
      if (requestSequenceRef.current !== requestId) {
        return;
      }

      activeAbortControllerRef.current = null;
      setIsStreaming(false);
      setActiveToolCall(null);

      if (error instanceof HttpClientError && error.code === "NETWORK_ERROR") {
        if (abortController.signal.aborted) {
          setStatus("idle");
          finalizeAssistantMessage(assistantMessageId);
          return;
        }

        setStatus("error");
        setErrorMessage(error.message);
        finalizeAssistantMessage(assistantMessageId);
        return;
      }

      setStatus("error");
      setErrorMessage(getReadableErrorMessage(error));
      finalizeAssistantMessage(assistantMessageId);
    }
  }

  async function retryLast(): Promise<void> {
    if (!lastSubmittedPayload || isStreaming) {
      return;
    }

    await sendMessage({
      ...lastSubmittedPayload,
      session_id: sessionId ?? lastSubmittedPayload.session_id,
    });
  }

  function abort(): void {
    const controller = activeAbortControllerRef.current;

    if (!controller) {
      return;
    }

    controller.abort();
    activeAbortControllerRef.current = null;
    setIsStreaming(false);
    setStatus("idle");
    setActiveToolCall(null);
  }

  function clearConversation(): void {
    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;
    activeAssistantMessageIdRef.current = null;
    setMessages([]);
    setStatus("idle");
    setActiveToolCall(null);
    setErrorMessage(null);
    setIsStreaming(false);
    setProvider(null);
    setSessionId(null);
    setLastSubmittedPayload(null);
  }

  function handleStreamEvent(
    event: AssistantStreamEvent,
    assistantMessageId: string,
  ): void {
    if (event.type === "state") {
      setStatus(event.state);
      return;
    }

    if (event.type === "provider_selected") {
      setProvider(event.provider);
      return;
    }

    if (event.type === "session") {
      setSessionId(event.session_id);
      return;
    }

    if (event.type === "tool_call_started") {
      setStatus("tool_calling");
      setActiveToolCall({
        toolName: event.tool_name,
        status: "running",
      });
      return;
    }

    if (event.type === "tool_call_finished") {
      setActiveToolCall({
        toolName: event.tool_name,
        status: event.status,
        durationMs: event.duration_ms,
      });
      return;
    }

    if (event.type === "answer_delta") {
      setStatus("answering");
      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                text: `${message.text}${event.text}`,
              }
            : message,
        ),
      );
      return;
    }

    if (event.type === "done") {
      setIsStreaming(false);
      setStatus("done");
      if (event.session_id) {
        setSessionId(event.session_id);
      }
      setActiveToolCall((currentValue) =>
        currentValue?.status === "running" ? null : currentValue,
      );
      activeAbortControllerRef.current = null;
      finalizeAssistantMessage(assistantMessageId);
      return;
    }

    setIsStreaming(false);
    setStatus("error");
    setErrorMessage(event.message);
    setActiveToolCall((currentValue) =>
      currentValue?.status === "running" ? null : currentValue,
    );
    activeAbortControllerRef.current = null;
    finalizeAssistantMessage(assistantMessageId);
  }

  function finalizeAssistantMessage(assistantMessageId: string): void {
    activeAssistantMessageIdRef.current = null;
    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === assistantMessageId
          ? {
              ...message,
              isStreaming: false,
            }
          : message,
      ),
    );
  }
}

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Assistant chat is unavailable right now.";
}
