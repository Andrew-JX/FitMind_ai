import { Card } from "../../components/Card";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import { createDefaultAssistantRange } from "./assistant-date-range";
import { AssistantComposer } from "./AssistantComposer";
import { AssistantMessageList } from "./AssistantMessageList";
import { AssistantQuickPrompts } from "./AssistantQuickPrompts";
import type {
  AssistantChatRequestPayload,
  AssistantPromptSuggestion,
} from "./assistant-types";
import type { UseAssistantChatResult } from "./use-assistant-chat";

export interface AssistantChatPanelProps {
  chat: UseAssistantChatResult;
  onPromptSuggestionChange: (prompt: AssistantPromptSuggestion) => void;
  promptSuggestion?: AssistantPromptSuggestion | null | undefined;
  selectedExerciseId?: string | null | undefined;
  selectedExerciseName?: string | null | undefined;
  token: string | null;
}

export function AssistantChatPanel(props: AssistantChatPanelProps) {
  const { chat } = props;
  const { theme } = useTheme();
  const message = props.promptSuggestion?.message ?? "";
  const mode = props.promptSuggestion?.mode ?? "auto";

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (mode === "exercise_progress" && !props.selectedExerciseId) {
      return;
    }

    const range = createDefaultAssistantRange();
    const payload: AssistantChatRequestPayload = {
      mode,
      message,
      start_date: range.start_date,
      end_date: range.end_date,
      exercise_id:
        mode === "exercise_progress"
          ? (props.selectedExerciseId ?? undefined)
          : undefined,
      session_id: chat.sessionId ?? undefined,
    };

    await chat.sendMessage(payload);
  }

  function applyQuickPrompt(nextPrompt: AssistantPromptSuggestion): void {
    props.onPromptSuggestionChange(nextPrompt);
  }

  return (
    <section style={panelStyle}>
      <AssistantQuickPrompts
        activeMode={mode}
        onSelectPrompt={applyQuickPrompt}
        selectedExerciseId={props.selectedExerciseId}
        selectedExerciseName={props.selectedExerciseName}
      />

      {mode === "exercise_progress" && !props.selectedExerciseId ? (
        <StateNotice
          description="如果你想继续追问某个动作的估算最大重量、重量变化或最近进展，请先去“分析”页选中对应动作。"
          icon="target"
          title="当前还没有选中动作"
          tone="warning"
        />
      ) : null}

      <Card padding="14px">
        <section style={sectionStyle}>
          <div>
            <h3 style={{ margin: 0 }}>继续追问</h3>
            <p style={copyStyle(theme)}>
              可以直接自然追问训练记录、动作进展或训练知识。上面的按钮只是示例，不是唯一问法。
            </p>
          </div>
          <AssistantMessageList messages={chat.messages} />
        </section>
      </Card>

      <AssistantComposer
        canRetry={chat.messages.length > 0}
        isStreaming={chat.isStreaming}
        message={message}
        onChangeMessage={(nextMessage) =>
          props.onPromptSuggestionChange({
            message: nextMessage,
            mode,
          })
        }
        onClear={chat.clearConversation}
        onRetry={() => void chat.retryLast()}
        onStop={chat.abort}
        onSubmit={(event) => void handleSubmit(event)}
      />

      {chat.errorMessage ? (
        <StateNotice
          description="可以重试这次追问，或先回到训练 / 分析页确认最新记录已经刷新。"
          title="助手响应失败"
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

const sectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 13,
    lineHeight: 1.6,
    margin: "8px 0 0",
  };
}
