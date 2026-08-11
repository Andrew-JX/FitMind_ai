import { createDbPool } from "./pool.js";

interface DbPoolLike {
  query: (
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: unknown[] }>;
  end?: () => Promise<void>;
}

export interface ToolCallLogStatus {
  status: "success" | "error" | "timeout";
}

export interface CreateToolCallLogInput extends ToolCallLogStatus {
  messageId: string | null;
  userId: string;
  toolName: string;
  toolInput: unknown;
  toolOutput: unknown;
  durationMs: number | null;
  errorMessage: string | null;
}

export interface ToolCallLogRow extends ToolCallLogStatus {
  id: string;
  message_id: string | null;
  user_id: string;
  tool_name: string;
  tool_input: unknown;
  tool_output: unknown;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export interface ListToolCallLogsFilters {
  userId: string;
  toolName?: string | undefined;
  limit?: number | undefined;
}

/**
 * Insert one tool execution log row.
 *
 * @param input - Persisted tool execution fields.
 * @param pool - Optional shared database pool.
 * @returns Inserted log row.
 */
export async function createToolCallLog(
  input: CreateToolCallLogInput,
  pool?: DbPoolLike,
): Promise<ToolCallLogRow> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        INSERT INTO tool_call_logs (
          message_id,
          user_id,
          tool_name,
          tool_input,
          tool_output,
          duration_ms,
          status,
          error_message
        )
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8)
        RETURNING
          id,
          message_id,
          user_id,
          tool_name,
          tool_input,
          tool_output,
          duration_ms,
          status,
          error_message,
          created_at
      `,
      [
        input.messageId,
        input.userId,
        input.toolName,
        JSON.stringify(input.toolInput),
        input.toolOutput === null ? null : JSON.stringify(input.toolOutput),
        input.durationMs,
        input.status,
        input.errorMessage,
      ],
    );

    const row = result.rows[0];

    if (row === undefined) {
      throw new Error("Tool call log insert did not return a row.");
    }

    return row as ToolCallLogRow;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Load recent tool execution log rows for one user.
 *
 * @param filters - User-scoped log filters.
 * @param pool - Optional shared database pool.
 * @returns Recent log rows ordered newest-first.
 */
export async function listRecentToolCallLogs(
  filters: ListToolCallLogsFilters,
  pool?: DbPoolLike,
): Promise<ToolCallLogRow[]> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT
          id,
          message_id,
          user_id,
          tool_name,
          tool_input,
          tool_output,
          duration_ms,
          status,
          error_message,
          created_at
        FROM tool_call_logs
        WHERE user_id = $1
          AND ($2::varchar(100) IS NULL OR tool_name = $2)
        ORDER BY created_at DESC, id DESC
        LIMIT $3
      `,
      [filters.userId, filters.toolName ?? null, filters.limit ?? 20],
    );

    return result.rows as ToolCallLogRow[];
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}
