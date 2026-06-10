export interface FeedbackFormState {
  message: string;
  rating: number | null;
  sourceRoute: string;
}

export interface FeedbackSubmissionPayload {
  message?: string | undefined;
  rating?: number | undefined;
  sourceRoute?: string | undefined;
}

export function buildFeedbackSubmission(
  state: FeedbackFormState,
): FeedbackSubmissionPayload | null {
  const message = state.message.trim();
  const sourceRoute = state.sourceRoute.trim();
  const payload: FeedbackSubmissionPayload = {};

  if (state.rating !== null) {
    payload.rating = state.rating;
  }

  if (message.length > 0) {
    payload.message = message;
  }

  if (sourceRoute.length > 0) {
    payload.sourceRoute = sourceRoute;
  }

  return payload.rating === undefined && payload.message === undefined
    ? null
    : payload;
}
