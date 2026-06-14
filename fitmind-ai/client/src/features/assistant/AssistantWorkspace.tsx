import { useState } from "react";

import { AssistantChatPanel } from "./AssistantChatPanel";
import { AssistantCurrentPlanCard } from "./AssistantCurrentPlanCard";
import { AssistantInsightDashboard } from "./AssistantInsightDashboard";
import { AssistantIntroCard } from "./AssistantIntroCard";
import type { AssistantPromptSuggestion } from "./assistant-types";
import { useAssistantChat } from "./use-assistant-chat";
import { useCurrentPlan } from "./use-current-plan";

export interface AssistantWorkspaceProps {
  refreshSignal: number;
  selectedExerciseId?: string | null | undefined;
  selectedExerciseName?: string | null | undefined;
  token: string | null;
}

export function AssistantWorkspace(props: AssistantWorkspaceProps) {
  const chat = useAssistantChat(props.token);
  const currentPlan = useCurrentPlan(props.token);
  const [promptSuggestion, setPromptSuggestion] = useState<AssistantPromptSuggestion>({
    message: "",
    mode: "next_training_focus",
  });

  return (
    <section style={workspaceStyle}>
      <AssistantIntroCard />
      <AssistantCurrentPlanCard
        actionError={currentPlan.actionError}
        isMutating={currentPlan.isMutating}
        onAbandon={() => void currentPlan.abandon()}
        plan={currentPlan.plan}
        status={currentPlan.status}
      />
      <AssistantInsightDashboard
        onPromptSelect={setPromptSuggestion}
        refreshSignal={props.refreshSignal}
        selectedExerciseId={props.selectedExerciseId}
        selectedExerciseName={props.selectedExerciseName}
        token={props.token}
      />
      <AssistantChatPanel
        chat={chat}
        onAcceptPlan={currentPlan.accept}
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
