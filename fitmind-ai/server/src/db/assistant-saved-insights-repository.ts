import { createDbPool } from "./pool.js";

interface DbPoolLike {
  query: (
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: unknown[]; rowCount?: number | null }>;
  end?: () => Promise<void>;
}

export interface AssistantSavedInsightRow {
  id: string;
  user_id: string;
  message_id: string | null;
  insight_type: "weekly_report" | "plateau_diagnosis" | "next_week_plan";
  title: string;
  summary: string;
  structured_snapshot: unknown;
  share_text: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAssistantSavedInsightInput {
  userId: string;
  messageId?: string | null | undefined;
  insightType: AssistantSavedInsightRow["insight_type"];
  title: string;
  summary: string;
  structuredSnapshot: unknown;
  shareText: string;
}

export async function createAssistantSavedInsight(
  input: CreateAssistantSavedInsightInput,
  pool?: DbPoolLike,
): Promise<AssistantSavedInsightRow> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        INSERT INTO assistant_saved_insights (
          user_id,
          message_id,
          insight_type,
          title,
          summary,
          structured_snapshot,
          share_text
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        ON CONFLICT (message_id) DO UPDATE
        SET
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          structured_snapshot = EXCLUDED.structured_snapshot,
          share_text = EXCLUDED.share_text,
          updated_at = now()
        RETURNING
          id,
          user_id,
          message_id,
          insight_type,
          title,
          summary,
          structured_snapshot,
          share_text,
          created_at,
          updated_at
      `,
      [
        input.userId,
        input.messageId ?? null,
        input.insightType,
        input.title,
        input.summary,
        JSON.stringify(input.structuredSnapshot),
        input.shareText,
      ],
    );

    return result.rows[0] as AssistantSavedInsightRow;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

export async function listAssistantSavedInsightsForUser(
  userId: string,
  pool?: DbPoolLike,
): Promise<AssistantSavedInsightRow[]> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT
          id,
          user_id,
          message_id,
          insight_type,
          title,
          summary,
          structured_snapshot,
          share_text,
          created_at,
          updated_at
        FROM assistant_saved_insights
        WHERE user_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT 50
      `,
      [userId],
    );

    return result.rows as AssistantSavedInsightRow[];
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

export async function findAssistantSavedInsightByIdForUser(
  id: string,
  userId: string,
  pool?: DbPoolLike,
): Promise<AssistantSavedInsightRow | null> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT
          id,
          user_id,
          message_id,
          insight_type,
          title,
          summary,
          structured_snapshot,
          share_text,
          created_at,
          updated_at
        FROM assistant_saved_insights
        WHERE id = $1 AND user_id = $2
        LIMIT 1
      `,
      [id, userId],
    );

    return (result.rows[0] as AssistantSavedInsightRow | undefined) ?? null;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

export async function deleteAssistantSavedInsightByIdForUser(
  id: string,
  userId: string,
  pool?: DbPoolLike,
): Promise<boolean> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        DELETE FROM assistant_saved_insights
        WHERE id = $1 AND user_id = $2
      `,
      [id, userId],
    );

    return (result.rowCount ?? 0) > 0;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}
