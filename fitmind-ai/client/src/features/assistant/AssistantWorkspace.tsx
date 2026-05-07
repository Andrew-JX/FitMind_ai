import { AssistantChatPanel } from "./AssistantChatPanel";
import { AssistantIntroCard } from "./AssistantIntroCard";
import { AssistantStatusRail } from "./AssistantStatusRail";
import { useAssistantChat } from "./use-assistant-chat";

export interface AssistantWorkspaceProps {
  selectedExerciseId?: string | null | undefined;
  selectedExerciseName?: string | null | undefined;
  token: string | null;
}

export function AssistantWorkspace(props: AssistantWorkspaceProps) {
  const chat = useAssistantChat(props.token);

  return (
    <section style={workspaceStyle}>
      <AssistantIntroCard />
      <AssistantStatusRail
        provider={chat.provider}
        sessionId={chat.sessionId}
        status={chat.status}
      />
      <AssistantChatPanel
        chat={chat}
        selectedExerciseId={props.selectedExerciseId}
        selectedExerciseName={props.selectedExerciseName}
        token={props.token}
      />
    </section>
  );
}

const workspaceStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};
