import { useState } from "react";

import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { IconButton } from "../../components/IconButton";
import { StatusPill } from "../../components/StatusPill";
import { useTheme } from "../../theme/ThemeContext";
import { AssistantMessageList } from "./AssistantMessageList";
import { AssistantToolCallCard } from "./AssistantToolCallCard";
import type { AssistantChatRequestPayload, AssistantMode } from "./assistant-types";
import type { UseAssistantChatResult } from "./use-assistant-chat";

export interface AssistantChatPanelProps {
  chat: UseAssistantChatResult;
  selectedExerciseId?: string | null | undefined;
  selectedExerciseName?: string | null | undefined;
  token: string | null;
}

export function AssistantChatPanel(props: AssistantChatPanelProps) {
  const { chat } = props;
  const { theme } = useTheme();
  const [message, setMessage] = useState("展示我的训练总览");
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

  function applyQuickPrompt(nextMode: AssistantMode): void {
    setMode(nextMode);
    setMessage(
      nextMode === "training_overview"
        ? "展示我的训练总览"
        : nextMode === "exercise_progress"
          ? `展示 ${props.selectedExerciseName?.trim() || "当前动作"} 的进展`
          : "构建推荐上下文预览",
    );
  }

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <Card padding="14px">
        <div style={statusBarStyle}>
          <StatusPill status={chat.status} />
          <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
            {chat.activeToolCall ? (
              <Badge tone="info">{chat.activeToolCall.toolName}</Badge>
            ) : null}
            <IconButton
              disabled={chat.isStreaming || chat.messages.length === 0}
              icon="x"
              label="清空对话"
              onClick={chat.clearConversation}
            />
          </div>
        </div>
      </Card>

      <Card padding="14px">
        <h3 style={{ margin: 0 }}>快捷指令</h3>
        <p style={copyStyle(theme)}>
          当前会按固定 mode 触发对应确定性工具，再通过 SSE 流式返回回答。
        </p>
        <div style={quickPromptRowStyle}>
          <Button onClick={() => applyQuickPrompt("training_overview")} type="button" variant="secondary">
            训练总览
          </Button>
          <Button
            disabled={!props.selectedExerciseId}
            onClick={() => applyQuickPrompt("exercise_progress")}
            type="button"
            variant="secondary"
          >
            动作进展
          </Button>
          <Button
            onClick={() => applyQuickPrompt("recommendation_context")}
            type="button"
            variant="secondary"
          >
            推荐上下文
          </Button>
        </div>

        {props.selectedExerciseId ? (
          <p style={helperTextStyle(theme)}>
            当前动作进展目标：
            <strong>{props.selectedExerciseName ?? props.selectedExerciseId}</strong>
          </p>
        ) : (
          <p style={helperTextStyle(theme)}>
            需要先在“分析”页选中一个动作，才能使用“动作进展”快捷指令。
          </p>
        )}
      </Card>

      <Card padding="14px">
        <div style={sectionStyle}>
          <h4 style={{ margin: 0 }}>当前工具调用</h4>
          <AssistantToolCallCard toolCall={chat.activeToolCall} />
        </div>
      </Card>

      {!props.selectedExerciseId ? (
        <div
          style={{
            backgroundColor: theme.isDark
              ? "rgba(255,155,66,0.18)"
              : "rgba(192,96,16,0.12)",
            border: `1px solid ${theme.isDark ? "rgba(255,155,66,0.28)" : "rgba(192,96,16,0.24)"}`,
            borderRadius: 12,
            color: theme.colors.orange,
            fontSize: 11,
            padding: "10px 12px",
          }}
        >
          前往“分析”页选择动作后，可以使用“动作进展”快捷指令。
        </div>
      ) : null}

      <Card padding="14px">
        <section style={sectionStyle}>
          <h4 style={{ margin: 0 }}>对话记录</h4>
          <AssistantMessageList messages={chat.messages} />
        </section>
      </Card>

      <Card padding="12px 14px">
        <form onSubmit={(event) => void handleSubmit(event)} style={inputBarStyle}>
          <div style={{ flex: 1 }}>
            <div style={modeLabelStyle(theme)}>当前模式：{formatMode(mode)}</div>
            <textarea
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              style={textareaStyle(theme)}
              value={message}
            />
          </div>
          <div style={inputActionColumnStyle}>
            <IconButton
              disabled={!chat.isStreaming}
              icon="stop"
              label="停止"
              onClick={chat.abort}
              tone="danger"
            />
            <Button disabled={!props.token || chat.isStreaming} style={{ width: "100%" }} type="submit">
              发送
            </Button>
            <Button
              disabled={chat.isStreaming || chat.messages.length === 0}
              onClick={() => void chat.retryLast()}
              type="button"
              variant="secondary"
            >
              重试
            </Button>
          </div>
        </form>
      </Card>

      {chat.errorMessage ? (
        <p style={{ color: theme.colors.orange, margin: 0 }}>错误：{chat.errorMessage}</p>
      ) : null}
    </section>
  );
}

function createDefaultRange(): { end_date: string; start_date: string } {
  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
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

function formatMode(mode: AssistantMode): string {
  if (mode === "training_overview") {
    return "training_overview";
  }

  if (mode === "exercise_progress") {
    return "exercise_progress";
  }

  return "recommendation_context";
}

const statusBarStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
};

const quickPromptRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
};

const sectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const inputBarStyle: React.CSSProperties = {
  alignItems: "flex-end",
  display: "flex",
  gap: 12,
};

const inputActionColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  width: 88,
};

function copyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 13,
    lineHeight: 1.6,
    marginBottom: 0,
    marginTop: 8,
  };
}

function helperTextStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    marginBottom: 0,
    marginTop: 10,
  };
}

function modeLabelStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    marginBottom: 8,
  };
}

function textareaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    color: theme.colors.tx,
    font: "inherit",
    padding: 12,
    resize: "vertical",
    width: "100%",
  };
}
