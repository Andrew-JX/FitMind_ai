import { useCallback, useEffect, useState } from "react";

import { HttpClientError } from "../../services/http-client";
import {
  abandonPlannedWorkout,
  acceptPlannedWorkout,
  getCurrentPlannedWorkout,
  type PlannedWorkoutWithAdherence,
} from "./planned-workout-api";
import type { AssistantPlanDraft } from "./assistant-types";

export type CurrentPlanStatus = "idle" | "loading" | "ready" | "error";

export interface UseCurrentPlanResult {
  plan: PlannedWorkoutWithAdherence | null;
  status: CurrentPlanStatus;
  isMutating: boolean;
  actionError: string | null;
  refresh: () => Promise<void>;
  accept: (
    draft: AssistantPlanDraft,
    sourceMessageId?: string | undefined,
  ) => Promise<boolean>;
  abandon: () => Promise<boolean>;
}

/**
 * Loads and mutates the user's active weekly plan (with adherence) for the
 * persistent plan card.
 *
 * @param token - In-memory auth token
 * @returns The current plan, load status, and accept/abandon/refresh actions
 */
export function useCurrentPlan(token: string | null): UseCurrentPlanResult {
  const [plan, setPlan] = useState<PlannedWorkoutWithAdherence | null>(null);
  const [status, setStatus] = useState<CurrentPlanStatus>("idle");
  const [isMutating, setIsMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!token) {
      setPlan(null);
      setStatus("idle");
      setActionError(null);
      return;
    }

    setStatus("loading");
    setActionError(null);

    try {
      const current = await getCurrentPlannedWorkout(token);
      setPlan(current);
      setStatus("ready");
    } catch (error) {
      setActionError(
        getReadableErrorMessage(error, "本周计划加载失败，请稍后再试。"),
      );
      setStatus("error");
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accept = useCallback(
    async (
      draft: AssistantPlanDraft,
      sourceMessageId?: string | undefined,
    ): Promise<boolean> => {
      if (!token) {
        return false;
      }

      setIsMutating(true);
      setActionError(null);

      try {
        await acceptPlannedWorkout(token, { plan: draft, sourceMessageId });
        await refresh();
        return true;
      } catch (error) {
        setActionError(
          getReadableErrorMessage(error, "接受计划失败，请稍后再试。"),
        );
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [token, refresh],
  );

  const abandon = useCallback(async (): Promise<boolean> => {
    if (!token || !plan) {
      return false;
    }

    setIsMutating(true);
    setActionError(null);

    try {
      await abandonPlannedWorkout(token, plan.id);
      await refresh();
      return true;
    } catch (error) {
      setActionError(
        getReadableErrorMessage(error, "放弃计划失败，请稍后再试。"),
      );
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [token, plan, refresh]);

  return {
    plan,
    status,
    isMutating,
    actionError,
    refresh,
    accept,
    abandon,
  };
}

function getReadableErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  if (error instanceof HttpClientError) {
    return typeof error.status === "number"
      ? `请求失败（HTTP ${error.status}）：${error.message}`
      : error.message;
  }

  return fallbackMessage;
}
