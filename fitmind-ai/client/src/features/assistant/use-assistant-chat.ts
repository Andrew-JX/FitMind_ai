import { useEffect, useRef, useState } from "react";

import { HttpClientError } from "../../services/http-client";
import { streamAssistantChat } from "./assistant-stream-api";
import { mergeStructuredOutputIntoMessage } from "./assistant-structured-output";
import type {
  AssistantActiveToolCall,
  AssistantAgentStepKind,
  AssistantAgentStepStatus,
  AssistantAgentTrace,
  AssistantAgentTraceStep,
  AssistantChatMessage,
  AssistantChatRequestPayload,
  AssistantProvider,
  AssistantChatStatus,
  AssistantStreamEvent,
  AssistantStructuredOutput,
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
  const [activeToolCall, setActiveToolCall] =
    useState<AssistantActiveToolCall | null>(null);
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

  async function sendMessage(
    payload: AssistantChatRequestPayload,
  ): Promise<void> {
    if (!token) {
      setStatus("error");
      setErrorMessage("请先登录后再使用训练助手。");
      return;
    }

    const trimmedMessage = payload.message.trim();

    if (trimmedMessage.length === 0) {
      setStatus("error");
      setErrorMessage("请输入想追问的内容。");
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

    if (event.type === "agent_step_started") {
      setStatus("planning");
      setMessages((currentMessages) =>
        upsertAgentStep(currentMessages, assistantMessageId, {
          index: event.index,
          kind: event.kind,
          title: event.title,
          thought: event.thought,
          toolName: event.tool_name,
          status: "running",
        }),
      );
      return;
    }

    if (event.type === "agent_step_finished") {
      setMessages((currentMessages) =>
        patchAgentStep(currentMessages, assistantMessageId, event.index, {
          status: event.status,
          durationMs: event.duration_ms,
          observation: event.observation,
        }),
      );
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

    if (event.type === "structured_output") {
      setMessages((currentMessages) => {
        const merged = mergeStructuredOutputIntoMessage(
          currentMessages,
          assistantMessageId,
          event.output,
        );
        const trace = mapStructuredAgentTrace(event.output);

        if (!trace) {
          return merged;
        }

        return merged.map((message) =>
          message.id === assistantMessageId
            ? { ...message, agentTrace: trace }
            : message,
        );
      });
      return;
    }

    if (event.type === "done") {
      setIsStreaming(false);
      setStatus("done");
      if (event.session_id) {
        setSessionId(event.session_id);
      }
      if (event.message_id) {
        setMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  messageId: event.message_id,
                }
              : message,
          ),
        );
      }
      setActiveToolCall((currentValue) =>
        currentValue?.status === "running" ? null : currentValue,
      );
      activeAbortControllerRef.current = null;
      finalizeAssistantMessage(assistantMessageId);
      return;
    }

    if (event.type === "error") {
      setIsStreaming(false);
      setStatus("error");
      setErrorMessage(event.message);
      setActiveToolCall((currentValue) =>
        currentValue?.status === "running" ? null : currentValue,
      );
      activeAbortControllerRef.current = null;
      finalizeAssistantMessage(assistantMessageId);
      return;
    }

    // Forward-compatible: ignore any event types this client does not know yet.
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

function upsertAgentStep(
  messages: AssistantChatMessage[],
  messageId: string,
  step: AssistantAgentTraceStep,
): AssistantChatMessage[] {
  return messages.map((message) => {
    if (message.id !== messageId) {
      return message;
    }

    const currentSteps = message.agentTrace?.steps ?? [];
    const existingIndex = currentSteps.findIndex(
      (candidate) => candidate.index === step.index,
    );
    const nextSteps =
      existingIndex >= 0
        ? currentSteps.map((candidate, index) =>
            index === existingIndex ? { ...candidate, ...step } : candidate,
          )
        : [...currentSteps, step];

    return {
      ...message,
      agentTrace: {
        ...(message.agentTrace ?? {}),
        steps: nextSteps,
      },
    };
  });
}

function patchAgentStep(
  messages: AssistantChatMessage[],
  messageId: string,
  index: number,
  patch: Partial<AssistantAgentTraceStep>,
): AssistantChatMessage[] {
  return messages.map((message) => {
    if (message.id !== messageId || !message.agentTrace) {
      return message;
    }

    return {
      ...message,
      agentTrace: {
        ...message.agentTrace,
        steps: message.agentTrace.steps.map((step) =>
          step.index === index ? { ...step, ...patch } : step,
        ),
      },
    };
  });
}

function mapStructuredAgentTrace(
  output: AssistantStructuredOutput,
): AssistantAgentTrace | null {
  const trace = output.agent_trace;

  if (!trace || !Array.isArray(trace.steps)) {
    return null;
  }

  const steps: AssistantAgentTraceStep[] = trace.steps.map((step, index) => ({
    index: typeof step.index === "number" ? step.index : index + 1,
    kind: normalizeAgentStepKind(step.kind),
    title: step.title ?? "",
    thought: step.thought ?? "",
    toolName: step.tool_name ?? null,
    observation: step.observation,
    status: normalizeAgentStepStatus(step.status),
    durationMs: step.duration_ms,
  }));

  return {
    goal: trace.goal,
    steps,
    stopReason: trace.stop_reason,
  };
}

function normalizeAgentStepKind(
  value: string | undefined,
): AssistantAgentStepKind {
  if (value === "tool" || value === "retrieval" || value === "synthesis") {
    return value;
  }

  return "tool";
}

function normalizeAgentStepStatus(
  value: string | undefined,
): AssistantAgentStepStatus {
  if (
    value === "running" ||
    value === "success" ||
    value === "error" ||
    value === "skipped"
  ) {
    return value;
  }

  return "success";
}

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    if (error.code === "RATE_LIMITED") {
      const retryAfter = readRetryAfterSeconds(error.details);

      return retryAfter
        ? `AI 请求太频繁了，请约 ${retryAfter} 秒后再试。`
        : "AI 请求太频繁了，请稍等片刻再试。";
    }

    if (error.code === "AI_QUOTA_EXCEEDED") {
      return "今天的 AI 使用次数已用完，明天再来吧。";
    }

    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Assistant chat is unavailable right now.";
}

function readRetryAfterSeconds(
  details: Record<string, unknown> | undefined,
): number | null {
  const value = details?.["retry_after_seconds"];

  return typeof value === "number" && value > 0 ? value : null;
}
