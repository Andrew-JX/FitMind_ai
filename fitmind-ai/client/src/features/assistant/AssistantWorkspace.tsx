import { useState } from "react";

import { AssistantChatPanel } from "./AssistantChatPanel";
import { AssistantCurrentPlanCard } from "./AssistantCurrentPlanCard";
import { AssistantHeading } from "./AssistantHeading";
import { AssistantInsightDashboard } from "./AssistantInsightDashboard";
import { AssistantSavedInsightsPanel } from "./AssistantSavedInsightsPanel";
import { AssistantWeeklyReportDigest } from "./AssistantWeeklyReportDigest";
import type { AssistantPromptSuggestion } from "./assistant-types";
import { useAssistantChat } from "./use-assistant-chat";
import type { UseCurrentPlanResult } from "./use-current-plan";

export interface AssistantWorkspaceProps {
  currentPlan: UseCurrentPlanResult;
  refreshSignal: number;
  selectedExerciseId?: string | null | undefined;
  selectedExerciseName?: string | null | undefined;
  token: string | null;
}

/**
 * Assistant tab, in the design's order: heading → 本周计划 → 主动训练洞察 →
 * 已保存洞察 → 快捷问题 → 对话 → 输入框.
 *
 * @param props - Auth token, plan state, refresh signal, and focused exercise
 * @returns Assistant tab element
 */
export function AssistantWorkspace(props: AssistantWorkspaceProps) {
  const chat = useAssistantChat(props.token);
  const currentPlan = props.currentPlan;
  const [promptSuggestion, setPromptSuggestion] =
    useState<AssistantPromptSuggestion>({
      message: "",
      mode: "next_training_focus",
    });
  // Saving a reply happens in the chat panel but is displayed by the saved
  // insights card above it, so the refresh key lives here.
  const [savedInsightsRefreshKey, setSavedInsightsRefreshKey] = useState(0);

  return (
    <section style={workspaceStyle}>
      <AssistantHeading />
      <AssistantWeeklyReportDigest token={props.token} />
      <AssistantCurrentPlanCard
        actionError={currentPlan.actionError}
        isMutating={currentPlan.isMutating}
        onAbandon={currentPlan.abandon}
        onArchive={currentPlan.archive}
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
      <AssistantSavedInsightsPanel
        refreshKey={savedInsightsRefreshKey}
        token={props.token}
      />
      <AssistantChatPanel
        chat={chat}
        onAcceptPlan={currentPlan.accept}
        onInsightSaved={() =>
          setSavedInsightsRefreshKey((currentValue) => currentValue + 1)
        }
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
  gap: 12,
};
