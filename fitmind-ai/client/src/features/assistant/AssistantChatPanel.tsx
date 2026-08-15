import { useState } from "react";

import { StateNotice } from "../../components/StateNotice";
import { useToast } from "../../components/ToastProvider";
import { AssistantComposer } from "./AssistantComposer";
import { AssistantMessageList } from "./AssistantMessageList";
import { AssistantQuickPrompts } from "./AssistantQuickPrompts";
import {
  buildAssistantRequestPayload,
  buildClarificationChoiceMessage,
  type AssistantClarificationChoice,
} from "./assistant-request-payload";
import {
  buildAssistantInsightCopyText,
  isAssistantMessageSaveEligible,
} from "./assistant-saved-insights";
import { saveAssistantInsight } from "./assistant-saved-insights-api";
import type {
  AssistantChatMessage,
  AssistantPlanDraft,
  AssistantPlanPreferencesWire,
  AssistantPromptSuggestion,
} from "./assistant-types";
import type { UseAssistantChatResult } from "./use-assistant-chat";
import { WeeklyPlanSetup } from "./WeeklyPlanSetup";
import {
  isWeeklyPlanCreationRequest,
  WEEKLY_PLAN_GENERATION_MESSAGE,
} from "./assistant-weekly-plan-entry";
import { useTheme } from "../../theme/ThemeContext";
import { BRAND_NEON } from "../../theme/tokens";

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
  const { showToast } = useToast();
  const { theme } = useTheme();
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [savingMessageIds, setSavingMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [acceptingPlanIds, setAcceptingPlanIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [acceptedPlanIds, setAcceptedPlanIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [planPreferences, setPlanPreferences] =
    useState<AssistantPlanPreferencesWire>({
      weekly_days: 3,
      session_duration_minutes: 60,
      available_equipment: ["bodyweight"],
      readiness: "ready",
      focus_areas: [],
    });
  const message = props.promptSuggestion?.message ?? "";
  const mode = props.promptSuggestion?.mode ?? "auto";
  const requiresSelectedExercise =
    mode === "exercise_progress" || mode === "plateau_diagnosis";

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (mode === "auto" && isWeeklyPlanCreationRequest(message)) {
      props.onPromptSuggestionChange({ message: "", mode: "next_week_plan" });
      return;
    }

    if (requiresSelectedExercise && !props.selectedExerciseId) {
      return;
    }

    const requestMessage =
      mode === "next_week_plan" ? WEEKLY_PLAN_GENERATION_MESSAGE : message;

    const payload = buildAssistantRequestPayload({
      message: requestMessage,
      mode,
      selectedExerciseId: props.selectedExerciseId,
      sessionId: chat.sessionId,
      planPreferences,
    });

    if (mode !== "next_week_plan") {
      props.onPromptSuggestionChange({ message: "", mode: "auto" });
    }

    await chat.sendMessage(payload);

    if (mode === "next_week_plan") {
      props.onPromptSuggestionChange({ message: "", mode: "auto" });
    }
  }

  /**
   * Answers a pending clarification by submitting the tapped option.
   *
   * The choice is passed straight to the payload builder, which is what makes
   * it outrank any exercise the analysis tab still has selected — otherwise
   * tapping a candidate could send a stale id and the assistant would answer
   * about a different exercise than the one the user just picked.
   */
  async function handleClarificationChoice(
    choice: AssistantClarificationChoice,
  ): Promise<void> {
    if (chat.isStreaming) {
      return;
    }

    const payload = buildAssistantRequestPayload({
      choice,
      message: buildClarificationChoiceMessage(choice),
      // The clarification carries the entity, not the intent: let the server
      // re-route the continuation the same way it would a typed answer.
      mode: "auto",
      selectedExerciseId: props.selectedExerciseId,
      sessionId: chat.sessionId,
    });

    props.onPromptSuggestionChange({ message: "", mode: "auto" });

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

    try {
      await saveAssistantInsight(props.token, assistantMessage.messageId);
      setSavedMessageIds((currentValues) => {
        const nextValues = new Set(currentValues);
        nextValues.add(assistantMessage.messageId);
        return nextValues;
      });
      props.onInsightSaved();
      showToast("洞察已保存");
    } catch {
      showToast("洞察保存失败");
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
    editedPlan: AssistantPlanDraft,
  ): Promise<void> {
    if (!assistantMessage.plan || !props.onAcceptPlan) {
      return;
    }

    const planKey = assistantMessage.id;
    setAcceptingPlanIds((currentValues) => new Set(currentValues).add(planKey));

    try {
      const accepted = await props.onAcceptPlan(
        editedPlan,
        assistantMessage.messageId,
      );

      if (accepted) {
        setAcceptedPlanIds((currentValues) =>
          new Set(currentValues).add(planKey),
        );
        showToast("已设为本周计划");
      } else {
        showToast("接受计划失败，请稍后再试");
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
    showToast("洞察文本已复制");
  }

  return (
    <section style={panelStyle}>
      <AssistantQuickPrompts
        onSelectPrompt={props.onPromptSuggestionChange}
        selectedExerciseId={props.selectedExerciseId}
        selectedExerciseName={props.selectedExerciseName}
      />

      {mode === "next_week_plan" ? (
        <WeeklyPlanSetup
          disabled={chat.isStreaming}
          onChange={setPlanPreferences}
          token={props.token}
          value={planPreferences}
        />
      ) : null}

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
        isSending={chat.isStreaming}
        messages={chat.messages}
        onAcceptPlan={
          props.onAcceptPlan
            ? (assistantMessage, editedPlan) =>
                void handleAcceptPlan(assistantMessage, editedPlan)
            : undefined
        }
        onClarificationChoice={(choice) =>
          void handleClarificationChoice(choice)
        }
        onCopyInsight={(assistantMessage) =>
          void handleCopyInsight(assistantMessage)
        }
        onSaveInsight={(assistantMessage) =>
          void handleSaveInsight(assistantMessage)
        }
      />

      {mode === "next_week_plan" ? (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          style={planActionStyle(theme)}
        >
          <button
            disabled={chat.isStreaming}
            style={planSubmitStyle(chat.isStreaming)}
            type="submit"
          >
            {chat.isStreaming ? "正在生成计划…" : "按以上设置生成计划"}
          </button>
          <button
            disabled={chat.isStreaming}
            onClick={() =>
              props.onPromptSuggestionChange({ message: "", mode: "auto" })
            }
            style={planCancelStyle(theme, chat.isStreaming)}
            type="button"
          >
            取消
          </button>
        </form>
      ) : (
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
      )}

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

function planActionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: `${theme.gradients.card}, ${theme.colors.surf}`,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    boxShadow: theme.shadows.card,
    display: "grid",
    gap: 8,
    gridTemplateColumns: "2fr 1fr",
    padding: 14,
  };
}

function planSubmitStyle(disabled: boolean): React.CSSProperties {
  return {
    background: BRAND_NEON,
    border: "none",
    borderRadius: 12,
    color: "#0f0f0f",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 800,
    opacity: disabled ? 0.55 : 1,
    padding: "12px 14px",
  };
}

function planCancelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  disabled: boolean,
): React.CSSProperties {
  return {
    background: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    color: theme.colors.tx2,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 700,
    opacity: disabled ? 0.55 : 1,
    padding: "12px 14px",
  };
}
