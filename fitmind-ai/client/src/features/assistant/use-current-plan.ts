import { useCallback, useEffect, useState } from "react";

import { HttpClientError } from "../../services/http-client";
import {
  abandonPlannedWorkout,
  acceptPlannedWorkout,
  archivePlannedWorkout,
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
  refresh: () => Promise<boolean>;
  accept: (
    draft: AssistantPlanDraft,
    sourceMessageId?: string | undefined,
  ) => Promise<boolean>;
  abandon: () => Promise<boolean>;
  archive: () => Promise<boolean>;
}

/**
 * Loads and mutates the user's active weekly plan (with adherence) for the
 * persistent plan card.
 *
 * @param token - In-memory auth token
 * @returns The current plan, load status, and accept/abandon/archive/refresh actions
 */
export function useCurrentPlan(token: string | null): UseCurrentPlanResult {
  const [plan, setPlan] = useState<PlannedWorkoutWithAdherence | null>(null);
  const [status, setStatus] = useState<CurrentPlanStatus>("idle");
  const [isMutating, setIsMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (!token) {
      setPlan(null);
      setStatus("idle");
      setActionError(null);
      return true;
    }

    setStatus("loading");
    setActionError(null);

    try {
      const current = await getCurrentPlannedWorkout(token);
      setPlan(current);
      setStatus("ready");
      return true;
    } catch (error) {
      setActionError(
        getReadableErrorMessage(error, "本周计划加载失败，请稍后再试。"),
      );
      setStatus("error");
      return false;
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
        setActionError("当前会话不可用，请重新登录后再试。");
        return false;
      }

      setIsMutating(true);
      setActionError(null);

      try {
        await acceptPlannedWorkout(token, { plan: draft, sourceMessageId });
        return await refresh();
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
      setActionError(
        token
          ? "当前没有可放弃的计划，请刷新后再试。"
          : "当前会话不可用，请重新登录后再试。",
      );
      return false;
    }

    setIsMutating(true);
    setActionError(null);

    try {
      await abandonPlannedWorkout(token, plan.id);
      return await refresh();
    } catch (error) {
      setActionError(
        getReadableErrorMessage(error, "放弃计划失败，请稍后再试。"),
      );
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [token, plan, refresh]);

  const archive = useCallback(async (): Promise<boolean> => {
    if (!token || !plan) {
      setActionError(
        token
          ? "当前没有可归档的计划，请刷新后再试。"
          : "当前会话不可用，请重新登录后再试。",
      );
      return false;
    }

    setIsMutating(true);
    setActionError(null);

    try {
      await archivePlannedWorkout(token, plan.id);
      return await refresh();
    } catch (error) {
      setActionError(
        getReadableErrorMessage(error, "归档计划失败，请稍后再试。"),
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
    archive,
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
