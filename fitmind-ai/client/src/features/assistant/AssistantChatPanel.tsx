import { useState } from "react";

import { AssistantMessageList } from "./AssistantMessageList";
import { AssistantToolCallCard } from "./AssistantToolCallCard";
import type {
  AssistantChatRequestPayload,
  AssistantMode,
} from "./assistant-types";
import type { UseAssistantChatResult } from "./use-assistant-chat";

export interface AssistantChatPanelProps {
  chat: UseAssistantChatResult;
  selectedExerciseId?: string | null | undefined;
  selectedExerciseName?: string | null | undefined;
  token: string | null;
}

/**
 * Renders the assistant controls and streamed conversation inside the workspace.
 *
 * @param props - Assistant state, auth token, and current selected exercise context.
 * @returns Chat controls plus streamed assistant output.
 */
export function AssistantChatPanel(props: AssistantChatPanelProps) {
  const { chat } = props;
  const [message, setMessage] = useState("show me my training overview");
  const [mode, setMode] = useState<AssistantMode>("training_overview");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (mode === "exercise_progress" && !props.selectedExerciseId) {
      return;
    }

    const payload: AssistantChatRequestPayload = {
      mode,
      message,
      start_date: createDefaultRange().start_date,
      end_date: createDefaultRange().end_date,
      exercise_id:
        mode === "exercise_progress"
          ? props.selectedExerciseId ?? undefined
          : undefined,
      session_id: chat.sessionId ?? undefined,
    };

    await chat.sendMessage(payload);
  }

  return (
    <section style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <h3 style={titleStyle}>Assistant Controls</h3>
          <p style={copyStyle}>
            Use these demo prompts to stream a deterministic assistant answer through
            the current SSE pipeline.
          </p>
        </div>
        <div style={statusPillStyle(chat.status)}>{formatStatus(chat.status)}</div>
      </div>
      <p style={subtleStyle}>
        Requests use the same rolling 30-day window as the existing deterministic
        training panels.
      </p>
      <div style={quickPromptSectionStyle}>
        <div style={quickPromptHeaderStyle}>
          <h4 style={subsectionTitleStyle}>Quick Prompts</h4>
          <p style={helperTextStyle}>Pick a demo path that maps to a deterministic tool.</p>
        </div>
        <div style={quickPromptRowStyle}>
          <button
            onClick={() => applyQuickPrompt("training_overview")}
            style={quickPromptButtonStyle}
            type="button"
          >
            Training overview
          </button>
          <button
            disabled={!props.selectedExerciseId}
            onClick={() => applyQuickPrompt("exercise_progress")}
            style={quickPromptButtonStyle}
            type="button"
          >
            Exercise progress
          </button>
          <button
            onClick={() => applyQuickPrompt("recommendation_context")}
            style={quickPromptButtonStyle}
            type="button"
          >
            Recommendation context
          </button>
        </div>
        {props.selectedExerciseId ? (
          <p style={helperTextStyle}>
            Exercise progress prompt target:{" "}
            <strong>{props.selectedExerciseName ?? props.selectedExerciseId}</strong>
          </p>
        ) : (
          <p style={helperTextStyle}>
            Exercise progress stays disabled until you select an exercise from the
            existing training summary panel.
          </p>
        )}
      </div>
      <form onSubmit={(event) => void handleSubmit(event)} style={formStyle}>
        <label style={labelStyle}>
          Ask the assistant ({mode})
          <textarea
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            style={textareaStyle}
            value={message}
          />
        </label>
        <div style={buttonRowStyle}>
          <button
            disabled={!props.token || chat.isStreaming}
            style={primaryButtonStyle}
            type="submit"
          >
            {chat.isStreaming ? "Streaming..." : "Send"}
          </button>
          <button
            disabled={!chat.isStreaming}
            onClick={chat.abort}
            style={secondaryButtonStyle}
            type="button"
          >
            Stop
          </button>
          <button
            disabled={chat.isStreaming || chat.messages.length === 0}
            onClick={() => void chat.retryLast()}
            style={secondaryButtonStyle}
            type="button"
          >
            Retry
          </button>
          <button
            disabled={chat.isStreaming || chat.messages.length === 0}
            onClick={chat.clearConversation}
            style={secondaryButtonStyle}
            type="button"
          >
            Clear conversation
          </button>
        </div>
      </form>
      {chat.errorMessage ? <p style={errorStyle}>Error: {chat.errorMessage}</p> : null}
      <div style={contentGridStyle}>
        <section style={sectionStyle}>
          <h4 style={subsectionTitleStyle}>Active Tool Call</h4>
          <AssistantToolCallCard toolCall={chat.activeToolCall} />
        </section>
        <section style={sectionStyle}>
          <h4 style={subsectionTitleStyle}>Assistant Answer</h4>
          <AssistantMessageList messages={chat.messages} />
        </section>
      </div>
    </section>
  );

  function applyQuickPrompt(nextMode: AssistantMode): void {
    setMode(nextMode);
    setMessage(
      nextMode === "training_overview"
        ? "show me my training overview"
        : nextMode === "exercise_progress"
          ? `show me ${
              props.selectedExerciseName?.trim() || "this exercise"
            } progress`
          : "build deterministic recommendation context",
    );
  }
}

function createDefaultRange(): { end_date: string; start_date: string } {
  const today = new Date();
  const endDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startDate = new Date(endDate);

  startDate.setDate(startDate.getDate() - 29);

  return {
    end_date: formatDateOnly(endDate),
    start_date: formatDateOnly(startDate),
  };
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatStatus(status: UseAssistantChatResult["status"]): string {
  return status.replace("_", " ");
}

const panelStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 16,
  padding: 20,
};

const headerStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 16,
  justifyContent: "space-between",
  marginBottom: 8,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
};

const copyStyle: React.CSSProperties = {
  color: "#334155",
  marginBottom: 0,
  marginTop: 6,
};

const subtleStyle: React.CSSProperties = {
  color: "#64748b",
  marginBottom: 16,
  marginTop: 0,
};

const quickPromptSectionStyle: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  marginBottom: 16,
  padding: 14,
};

const quickPromptHeaderStyle: React.CSSProperties = {
  marginBottom: 10,
};

const subsectionTitleStyle: React.CSSProperties = {
  margin: 0,
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  marginBottom: 16,
};

const quickPromptRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 8,
};

const quickPromptButtonStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  color: "#0f172a",
  cursor: "pointer",
  padding: "8px 12px",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  fontWeight: 600,
  gap: 8,
};

const textareaStyle: React.CSSProperties = {
  border: "1px solid #94a3b8",
  borderRadius: 12,
  font: "inherit",
  padding: 12,
  resize: "vertical",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: "#0f172a",
  border: "none",
  borderRadius: 10,
  color: "#ffffff",
  cursor: "pointer",
  padding: "10px 14px",
};

const secondaryButtonStyle: React.CSSProperties = {
  backgroundColor: "#e2e8f0",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  color: "#0f172a",
  cursor: "pointer",
  padding: "10px 14px",
};

const errorStyle: React.CSSProperties = {
  color: "#b91c1c",
  marginBottom: 16,
};

const helperTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  marginBottom: 0,
  marginTop: 0,
};

const contentGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const sectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

function statusPillStyle(status: UseAssistantChatResult["status"]): React.CSSProperties {
  return {
    backgroundColor:
      status === "error"
        ? "#fee2e2"
        : status === "done"
          ? "#dcfce7"
          : "#e0f2fe",
    borderRadius: 999,
    color:
      status === "error"
        ? "#991b1b"
        : status === "done"
          ? "#166534"
          : "#0f172a",
    fontSize: 12,
    fontWeight: 700,
    padding: "6px 10px",
    textTransform: "uppercase",
  };
}
