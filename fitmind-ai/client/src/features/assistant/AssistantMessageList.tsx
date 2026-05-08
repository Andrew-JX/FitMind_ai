import { StateNotice } from "../../components/StateNotice";
import type { AssistantChatMessage } from "./assistant-types";
import { AssistantMessageBubble } from "./AssistantMessageBubble";

export interface AssistantMessageListProps {
  messages: AssistantChatMessage[];
}

export function AssistantMessageList(props: AssistantMessageListProps) {
  if (props.messages.length === 0) {
    return (
      <StateNotice
        description="你可以先看上面的主动洞察，再继续追问为什么这样判断、今天适合练什么，或者某个动作有没有进步。"
        icon="bot"
        title="从一个训练追问开始"
      />
    );
  }

  return (
    <div style={listStyle}>
      {props.messages.map((message) => (
        <AssistantMessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};
