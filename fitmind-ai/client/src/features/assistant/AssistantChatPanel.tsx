import { useState } from "react";

import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import { createDefaultAssistantRange } from "./assistant-date-range";
import { AssistantComposer } from "./AssistantComposer";
import { AssistantMessageList } from "./AssistantMessageList";
import { AssistantQuickPrompts } from "./AssistantQuickPrompts";
import {
  buildAssistantInsightCopyText,
  isAssistantMessageSaveEligible,
} from "./assistant-saved-insights";
import { saveAssistantInsight } from "./assistant-saved-insights-api";
import type {
  AssistantChatMessage,
  AssistantChatRequestPayload,
  AssistantPlanDraft,
  AssistantPromptSuggestion,
} from "./assistant-types";
import type { UseAssistantChatResult } from "./use-assistant-chat";

export interface AssistantChatPanelProps {
  chat: UseAssistantChatResult;
  onAcceptPlan?:
    | ((
        draft: AssistantPlanDraft,
        sourceMessageId?: string | undefined,
      ) => Promise<boolean>)
    | undefined;
  onInsightSaved: () => void;
  onPromptSuggestionChange: (prompt: AssistantPromptSuggestion) => void;
  promptSuggestion?: AssistantPromptSuggestion | null | undefined;
  selectedExerciseId?: string | null | undefined;
  selectedExerciseName?: string | null | undefined;
  token: string | null;
}

/**
 * Assistant tab's conversation half: quick prompts, the message thread, and
 * the composer.
 *
 * The design leaves the thread outside any card so the bubbles sit directly on
 * the page background.
 *
 * @param props - Chat state plus prompt and plan wiring
 * @returns Conversation section
 */
export function AssistantChatPanel(props: AssistantChatPanelProps) {
  const { chat } = props;
  const { theme } = useTheme();
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [savingMessageIds, setSavingMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [insightStatusText, setInsightStatusText] = useState<string | null>(
    null,
  );
  const [acceptingPlanIds, setAcceptingPlanIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [acceptedPlanIds, setAcceptedPlanIds] = useState<Set<string>>(
    () => new Set(),
  );
  const message = props.promptSuggestion?.message ?? "";
  const mode = props.promptSuggestion?.mode ?? "auto";
  const requiresSelectedExercise =
    mode === "exercise_progress" || mode === "plateau_diagnosis";

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (requiresSelectedExercise && !props.selectedExerciseId) {
      return;
    }

    const range = createDefaultAssistantRange();
    const payload: AssistantChatRequestPayload = {
      mode,
      message,
      start_date: range.start_date,
      end_date: range.end_date,
      exercise_id:
        requiresSelectedExercise || mode === "weekly_report"
          ? (props.selectedExerciseId ?? undefined)
          : undefined,
      session_id: chat.sessionId ?? undefined,
    };

    props.onPromptSuggestionChange({
      message: "",
      mode: "auto",
    });

    await chat.sendMessage(payload);
  }

  async function handleSaveInsight(
    assistantMessage: AssistantChatMessage,
  ): Promise<void> {
    if (!props.token || !isAssistantMessageSaveEligible(assistantMessage)) {
      return;
    }

    setSavingMessageIds((currentValues) => {
      const nextValues = new Set(currentValues);
      nextValues.add(assistantMessage.messageId);
      return nextValues;
    });
    setInsightStatusText(null);

    try {
      await saveAssistantInsight(props.token, assistantMessage.messageId);
      setSavedMessageIds((currentValues) => {
        const nextValues = new Set(currentValues);
        nextValues.add(assistantMessage.messageId);
        return nextValues;
      });
      props.onInsightSaved();
      setInsightStatusText("洞察已保存。");
    } catch {
      setInsightStatusText("洞察保存失败。");
    } finally {
      setSavingMessageIds((currentValues) => {
        const nextValues = new Set(currentValues);
        nextValues.delete(assistantMessage.messageId);
        return nextValues;
      });
    }
  }

  async function handleAcceptPlan(
    assistantMessage: AssistantChatMessage,
  ): Promise<void> {
    if (!assistantMessage.plan || !props.onAcceptPlan) {
      return;
    }

    const planKey = assistantMessage.id;
    setAcceptingPlanIds((currentValues) => new Set(currentValues).add(planKey));
    setInsightStatusText(null);

    try {
      const accepted = await props.onAcceptPlan(
        assistantMessage.plan,
        assistantMessage.messageId,
      );

      if (accepted) {
        setAcceptedPlanIds((currentValues) =>
          new Set(currentValues).add(planKey),
        );
        setInsightStatusText("已设为本周计划，可在页面顶部查看完成进度。");
      } else {
        setInsightStatusText("接受计划失败，请稍后再试。");
      }
    } finally {
      setAcceptingPlanIds((currentValues) => {
        const nextValues = new Set(currentValues);
        nextValues.delete(planKey);
        return nextValues;
      });
    }
  }

  async function handleCopyInsight(
    assistantMessage: AssistantChatMessage,
  ): Promise<void> {
    await navigator.clipboard.writeText(
      buildAssistantInsightCopyText(assistantMessage),
    );
    setInsightStatusText("洞察文本已复制。");
  }

  return (
    <section style={panelStyle}>
      <AssistantQuickPrompts
        onSelectPrompt={props.onPromptSuggestionChange}
        selectedExerciseId={props.selectedExerciseId}
        selectedExerciseName={props.selectedExerciseName}
      />

      {requiresSelectedExercise && !props.selectedExerciseId ? (
        <StateNotice
          description="请先在分析页选择一个重点动作，再追问动作进展或平台期诊断。"
          icon="target"
          title="还没有选择重点动作"
          tone="warning"
        />
      ) : null}

      <AssistantMessageList
        isMessageSaved={(assistantMessage) =>
          typeof assistantMessage.messageId === "string" &&
          savedMessageIds.has(assistantMessage.messageId)
        }
        isMessageSaving={(assistantMessage) =>
          typeof assistantMessage.messageId === "string" &&
          savingMessageIds.has(assistantMessage.messageId)
        }
        isPlanAccepted={(assistantMessage) =>
          acceptedPlanIds.has(assistantMessage.id)
        }
        isPlanAccepting={(assistantMessage) =>
          acceptingPlanIds.has(assistantMessage.id)
        }
        messages={chat.messages}
        onAcceptPlan={
          props.onAcceptPlan
            ? (assistantMessage) => void handleAcceptPlan(assistantMessage)
            : undefined
        }
        onCopyInsight={(assistantMessage) =>
          void handleCopyInsight(assistantMessage)
        }
        onSaveInsight={(assistantMessage) =>
          void handleSaveInsight(assistantMessage)
        }
      />

      {insightStatusText ? (
        <p style={insightStatusStyle(theme)}>{insightStatusText}</p>
      ) : null}

      <AssistantComposer
        canRetry={chat.messages.length > 0}
        isStreaming={chat.isStreaming}
        message={message}
        onChangeMessage={(nextMessage) =>
          props.onPromptSuggestionChange({
            // 用户手动改写文本即视为自由提问，重置回 auto 让服务端分类，
            // 避免上一次快捷问题 / 洞察卡片的 mode 粘住、把自由提问误路由。
            message: nextMessage,
            mode: "auto",
          })
        }
        onClear={chat.clearConversation}
        onRetry={() => void chat.retryLast()}
        onStop={chat.abort}
        onSubmit={(event) => void handleSubmit(event)}
      />

      {chat.errorMessage ? (
        <StateNotice
          description={chat.errorMessage}
          title="助手暂时无法回应"
          tone="error"
        />
      ) : null}
    </section>
  );
}

const panelStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

function insightStatusStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 12,
    margin: 0,
    padding: "0 4px",
  };
}
