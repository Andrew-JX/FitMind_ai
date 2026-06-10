import { requestJson } from "../../services/http-client";
import type { FeedbackSubmissionPayload } from "./feedback-form";

export interface ProductFeedback {
  createdAt: string;
  id: string;
  message: string | null;
  rating: number | null;
  sourceRoute: string | null;
}

interface SubmitFeedbackResponse {
  feedback: ProductFeedback;
}

export async function submitFeedback(
  token: string,
  payload: FeedbackSubmissionPayload,
): Promise<ProductFeedback> {
  const response = await requestJson<
    SubmitFeedbackResponse,
    FeedbackSubmissionPayload
  >("/api/feedback", {
    body: payload,
    method: "POST",
    token,
  });

  return response.feedback;
}
