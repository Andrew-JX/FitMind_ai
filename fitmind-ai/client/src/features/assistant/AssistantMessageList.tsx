import { StateNotice } from "../../components/StateNotice";
import type { AssistantChatMessage } from "./assistant-types";
import { AssistantMessageBubble } from "./AssistantMessageBubble";

export interface AssistantMessageListProps {
  isMessageSaved?: ((message: AssistantChatMessage) => boolean) | undefined;
  isMessageSaving?: ((message: AssistantChatMessage) => boolean) | undefined;
  isPlanAccepting?: ((message: AssistantChatMessage) => boolean) | undefined;
  isPlanAccepted?: ((message: AssistantChatMessage) => boolean) | undefined;
  messages: AssistantChatMessage[];
  onAcceptPlan?: ((message: AssistantChatMessage) => void) | undefined;
  onCopyInsight?: ((message: AssistantChatMessage) => void) | undefined;
  onSaveInsight?: ((message: AssistantChatMessage) => void) | undefined;
}

export function AssistantMessageList(props: AssistantMessageListProps) {
  if (props.messages.length === 0) {
    return (
      <StateNotice
        description="可以先看上面的训练洞察，再继续追问判断依据、今天适合练什么，或某个动作有没有进步。"
        icon="bot"
        title="从一个训练追问开始"
      />
    );
  }

  return (
    <div style={listStyle}>
      {props.messages.map((message) => (
        <AssistantMessageBubble
          isPlanAccepted={props.isPlanAccepted?.(message)}
          isPlanAccepting={props.isPlanAccepting?.(message)}
          isSaved={props.isMessageSaved?.(message)}
          isSaving={props.isMessageSaving?.(message)}
          key={message.id}
          message={message}
          onAcceptPlan={props.onAcceptPlan}
          onCopyInsight={props.onCopyInsight}
          onSaveInsight={props.onSaveInsight}
        />
      ))}
    </div>
  );
}

/** Design: the thread sits directly on the page, gap 8 between bubbles. */
const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};
