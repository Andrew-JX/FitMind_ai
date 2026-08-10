export type AppTabKey = "training" | "history" | "assistant" | "profile";

export type HistoryViewMode = "history" | "analysis";

/**
 * Maps the visible workspace to the route attached to submitted feedback.
 * History and analysis share one bottom navigation destination, but retain
 * distinct routes so reports still identify the view the user was looking at.
 */
export function getFeedbackSourceRoute(
  activeTab: AppTabKey,
  historyMode: HistoryViewMode,
): string {
  if (activeTab === "history") {
    return historyMode === "analysis" ? "/analysis" : "/history";
  }

  if (activeTab === "assistant") {
    return "/assistant";
  }

  if (activeTab === "profile") {
    return "/profile";
  }

  return "/training";
}
