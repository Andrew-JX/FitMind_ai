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
        description="你可以询问最近训练量、某个动作进展，或让助手解释推荐上下文。"
        icon="bot"
        title="从一个训练问题开始"
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
