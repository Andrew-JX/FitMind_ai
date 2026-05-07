import { useState } from "react";

import { Card } from "../../components/Card";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import { AssistantComposer } from "./AssistantComposer";
import { AssistantMessageList } from "./AssistantMessageList";
import { AssistantQuickPrompts } from "./AssistantQuickPrompts";
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
  const [message, setMessage] = useState("看看我最近的训练总览。");
  const [mode, setMode] = useState<AssistantMode>("training_overview");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (mode === "exercise_progress" && !props.selectedExerciseId) {
      return;
    }

    const range = createDefaultRange();
    const payload: AssistantChatRequestPayload = {
      mode,
      message,
      start_date: range.start_date,
      end_date: range.end_date,
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
        ? "看看我最近的训练总览。"
        : nextMode === "exercise_progress"
          ? `分析一下 ${props.selectedExerciseName?.trim() || "当前动作"} 的进展。`
          : "预览这次回答会读取哪些推荐上下文。",
    );
  }

  return (
    <section style={panelStyle}>
      <AssistantQuickPrompts
        activeMode={mode}
        onSelectMode={applyQuickPrompt}
        selectedExerciseId={props.selectedExerciseId}
        selectedExerciseName={props.selectedExerciseName}
      />

      <Card padding="14px">
        <div style={sectionStyle}>
          <h3 style={{ margin: 0 }}>工具调用状态</h3>
          <AssistantToolCallCard toolCall={chat.activeToolCall} />
        </div>
      </Card>

      {!props.selectedExerciseId ? (
        <StateNotice
          description="前往“分析”选择动作后，可使用“动作进展”快捷问题。"
          icon="target"
          title="动作进展暂未就绪"
          tone="warning"
        />
      ) : null}

      <Card padding="14px">
        <section style={sectionStyle}>
          <div>
            <h3 style={{ margin: 0 }}>对话消息</h3>
            <p style={copyStyle(theme)}>
              仅展示提问、工具阶段和增量回答，不默认显示 raw debug JSON。
            </p>
          </div>
          <AssistantMessageList messages={chat.messages} />
        </section>
      </Card>

      <div style={modeMetaStyle(theme)}>当前模式：{formatMode(mode)}</div>

      <AssistantComposer
        canRetry={chat.messages.length > 0}
        isStreaming={chat.isStreaming}
        message={message}
        onChangeMessage={setMessage}
        onClear={chat.clearConversation}
        onRetry={() => void chat.retryLast()}
        onStop={chat.abort}
        onSubmit={(event) => void handleSubmit(event)}
      />

      {chat.errorMessage ? (
        <StateNotice
          description="可以重试本次问题，或检查 assistant provider 配置。"
          title="助手响应失败"
          tone="error"
        />
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

const panelStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const sectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

function copyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 13,
    lineHeight: 1.6,
    margin: "8px 0 0",
  };
}

function modeMetaStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    marginTop: -2,
  };
}
