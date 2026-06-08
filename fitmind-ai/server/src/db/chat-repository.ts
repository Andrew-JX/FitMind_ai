import { createRequire } from "node:module";

import { loadServerEnv } from "../env.js";

interface DbPoolLike {
  query: (
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: unknown[] }>;
  end?: () => Promise<void>;
}

export interface ChatSessionRow {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  last_message_at: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "tool";
  content: unknown;
  structured_output: unknown;
  usage: unknown;
  metadata: unknown;
  token_input: number | null;
  token_output: number | null;
  created_at: string;
}

export interface CreateChatSessionInput {
  userId: string;
  title: string | null;
}

export interface CreateChatMessageInput {
  sessionId: string;
  role: "user" | "assistant" | "tool";
  content: unknown;
  structuredOutput: unknown;
  usage: unknown;
  metadata: unknown;
  tokenInput?: number | null | undefined;
  tokenOutput?: number | null | undefined;
}

const require = createRequire(import.meta.url);

async function createRepositoryPool(): Promise<DbPoolLike> {
  const env = loadServerEnv();

  if (env.databaseUrl === undefined) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  const { Pool } = require("pg") as {
    Pool: new (config: { connectionString: string }) => DbPoolLike;
  };

  return new Pool({
    connectionString: env.databaseUrl,
  });
}

/**
 * Create one user-owned chat session row.
 *
 * @param input - Authenticated session ownership and optional title.
 * @param pool - Optional shared database pool.
 * @returns Inserted session row.
 */
export async function createChatSession(
  input: CreateChatSessionInput,
  pool?: DbPoolLike,
): Promise<ChatSessionRow> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        INSERT INTO chat_sessions (user_id, title)
        VALUES ($1, $2)
        RETURNING
          id,
          user_id,
          title,
          created_at,
          last_message_at
      `,
      [input.userId, input.title],
    );

    return result.rows[0] as ChatSessionRow;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Load one chat session row for the provided user id.
 *
 * @param sessionId - Session id.
 * @param userId - Authenticated user id.
 * @param pool - Optional shared database pool.
 * @returns Matching session row or null.
 */
export async function findChatSessionByIdForUser(
  sessionId: string,
  userId: string,
  pool?: DbPoolLike,
): Promise<ChatSessionRow | null> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT
          id,
          user_id,
          title,
          created_at,
          last_message_at
        FROM chat_sessions
        WHERE id = $1 AND user_id = $2
        LIMIT 1
      `,
      [sessionId, userId],
    );

    return (result.rows[0] as ChatSessionRow | undefined) ?? null;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Check whether a chat session exists regardless of ownership.
 *
 * @param sessionId - Session id.
 * @param pool - Optional shared database pool.
 * @returns True when the session id exists.
 */
export async function hasChatSessionById(
  sessionId: string,
  pool?: DbPoolLike,
): Promise<boolean> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT id
        FROM chat_sessions
        WHERE id = $1
        LIMIT 1
      `,
      [sessionId],
    );

    return result.rows.length > 0;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Load one chat message for the provided user id.
 *
 * @param messageId - Message id.
 * @param userId - Authenticated user id.
 * @param pool - Optional shared database pool.
 * @returns Matching message row or null.
 */
export async function findChatMessageByIdForUser(
  messageId: string,
  userId: string,
  pool?: DbPoolLike,
): Promise<ChatMessageRow | null> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT
          m.id,
          m.session_id,
          m.role,
          m.content,
          m.structured_output,
          m.usage,
          m.metadata,
          m.token_input,
          m.token_output,
          m.created_at
        FROM messages m
        JOIN chat_sessions s ON s.id = m.session_id
        WHERE m.id = $1
          AND s.user_id = $2
        LIMIT 1
      `,
      [messageId, userId],
    );

    return (result.rows[0] as ChatMessageRow | undefined) ?? null;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Check whether a chat message exists regardless of ownership.
 *
 * @param messageId - Message id.
 * @param pool - Optional shared database pool.
 * @returns True when the message id exists.
 */
export async function hasChatMessageById(
  messageId: string,
  pool?: DbPoolLike,
): Promise<boolean> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT id
        FROM messages
        WHERE id = $1
        LIMIT 1
      `,
      [messageId],
    );

    return result.rows.length > 0;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * Insert one chat message row and advance the parent session timestamp.
 *
 * @param input - Message payload.
 * @param pool - Optional shared database pool.
 * @returns Inserted message row.
 */
export async function createChatMessage(
  input: CreateChatMessageInput,
  pool?: DbPoolLike,
): Promise<ChatMessageRow> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        WITH inserted_message AS (
          INSERT INTO messages (
            session_id,
            role,
            content,
            structured_output,
            usage,
            metadata,
            token_input,
            token_output
          )
          VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8)
          RETURNING
            id,
            session_id,
            role,
            content,
            structured_output,
            usage,
            metadata,
            token_input,
            token_output,
            created_at
        )
        UPDATE chat_sessions
        SET last_message_at = inserted_message.created_at
        FROM inserted_message
        WHERE chat_sessions.id = inserted_message.session_id
        RETURNING
          inserted_message.id,
          inserted_message.session_id,
          inserted_message.role,
          inserted_message.content,
          inserted_message.structured_output,
          inserted_message.usage,
          inserted_message.metadata,
          inserted_message.token_input,
          inserted_message.token_output,
          inserted_message.created_at
      `,
      [
        input.sessionId,
        input.role,
        JSON.stringify(input.content),
        input.structuredOutput === null
          ? null
          : JSON.stringify(input.structuredOutput),
        input.usage === null ? null : JSON.stringify(input.usage),
        input.metadata === null ? null : JSON.stringify(input.metadata),
        input.tokenInput ?? null,
        input.tokenOutput ?? null,
      ],
    );

    return result.rows[0] as ChatMessageRow;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * List chat sessions for one authenticated user, newest activity first.
 *
 * @param userId - Authenticated user id.
 * @param pool - Optional shared database pool.
 * @returns User-owned session rows.
 */
export async function listChatSessionsForUser(
  userId: string,
  pool?: DbPoolLike,
): Promise<ChatSessionRow[]> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT
          id,
          user_id,
          title,
          created_at,
          last_message_at
        FROM chat_sessions
        WHERE user_id = $1
        ORDER BY last_message_at DESC, id DESC
      `,
      [userId],
    );

    return result.rows as ChatSessionRow[];
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}

/**
 * List persisted messages for one user-owned session.
 *
 * @param sessionId - Session id.
 * @param userId - Authenticated user id.
 * @param pool - Optional shared database pool.
 * @returns Session messages oldest-first.
 */
export async function listMessagesForSession(
  sessionId: string,
  userId: string,
  pool?: DbPoolLike,
): Promise<ChatMessageRow[]> {
  const activePool = pool ?? (await createRepositoryPool());
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT
          m.id,
          m.session_id,
          m.role,
          m.content,
          m.structured_output,
          m.usage,
          m.metadata,
          m.token_input,
          m.token_output,
          m.created_at
        FROM messages m
        JOIN chat_sessions s ON s.id = m.session_id
        WHERE m.session_id = $1
          AND s.user_id = $2
        ORDER BY m.created_at ASC, m.id ASC
      `,
      [sessionId, userId],
    );

    return result.rows as ChatMessageRow[];
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}
