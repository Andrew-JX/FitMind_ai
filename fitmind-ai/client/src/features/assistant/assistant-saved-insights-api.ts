import { requestJson } from "../../services/http-client";
import type { AssistantSavedInsightType } from "./assistant-saved-insights";

export interface AssistantSavedInsight {
  id: string;
  message_id: string | null;
  insight_type: AssistantSavedInsightType;
  title: string;
  summary: string;
  structured_snapshot: unknown;
  share_text: string;
  created_at: string;
  updated_at: string;
}

interface ListAssistantSavedInsightsResponse {
  items: AssistantSavedInsight[];
}

interface DeleteAssistantSavedInsightResponse {
  deleted: true;
  id: string;
}

export async function saveAssistantInsight(
  token: string,
  messageId: string,
): Promise<AssistantSavedInsight> {
  return requestJson<
    AssistantSavedInsight,
    {
      message_id: string;
    }
  >("/api/assistant/insights", {
    method: "POST",
    token,
    body: {
      message_id: messageId,
    },
  });
}

export async function listAssistantSavedInsights(
  token: string,
): Promise<AssistantSavedInsight[]> {
  const response = await requestJson<ListAssistantSavedInsightsResponse>(
    "/api/assistant/insights",
    {
      token,
    },
  );

  return response.items;
}

export async function deleteAssistantSavedInsight(
  token: string,
  id: string,
): Promise<DeleteAssistantSavedInsightResponse> {
  return requestJson<DeleteAssistantSavedInsightResponse>(
    `/api/assistant/insights/${id}`,
    {
      method: "DELETE",
      token,
    },
  );
}
