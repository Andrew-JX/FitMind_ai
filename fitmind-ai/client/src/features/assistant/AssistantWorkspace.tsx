import { useState } from "react";

import { AssistantChatPanel } from "./AssistantChatPanel";
import { AssistantInsightDashboard } from "./AssistantInsightDashboard";
import { AssistantIntroCard } from "./AssistantIntroCard";
import type { AssistantPromptSuggestion } from "./assistant-types";
import { useAssistantChat } from "./use-assistant-chat";

export interface AssistantWorkspaceProps {
  refreshSignal: number;
  selectedExerciseId?: string | null | undefined;
  selectedExerciseName?: string | null | undefined;
  token: string | null;
}

export function AssistantWorkspace(props: AssistantWorkspaceProps) {
  const chat = useAssistantChat(props.token);
  const [promptSuggestion, setPromptSuggestion] = useState<AssistantPromptSuggestion>({
    message: "",
    mode: "next_training_focus",
  });

  return (
    <section style={workspaceStyle}>
      <AssistantIntroCard />
      <AssistantInsightDashboard
        onPromptSelect={setPromptSuggestion}
        refreshSignal={props.refreshSignal}
        selectedExerciseId={props.selectedExerciseId}
        selectedExerciseName={props.selectedExerciseName}
        token={props.token}
      />
      <AssistantChatPanel
        chat={chat}
        onPromptSuggestionChange={setPromptSuggestion}
        promptSuggestion={promptSuggestion}
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
