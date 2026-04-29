/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * Create the Phase 1.0C chat session, messages, and tool log tables.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 * @returns {void}
 */
export const up = (pgm) => {
  pgm.createTable("chat_sessions", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: '"users"',
      onDelete: "CASCADE",
    },
    title: {
      type: "varchar(200)",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
    last_message_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex(
    "chat_sessions",
    ["user_id", { name: "last_message_at", sort: "DESC" }],
    {
      name: "idx_chat_sessions_user",
    },
  );

  pgm.createTable("messages", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    session_id: {
      type: "uuid",
      notNull: true,
      references: '"chat_sessions"',
      onDelete: "CASCADE",
    },
    role: {
      type: "varchar(20)",
      notNull: true,
      check: "role IN ('user', 'assistant', 'tool')",
    },
    content: {
      type: "jsonb",
      notNull: true,
    },
    structured_output: {
      type: "jsonb",
    },
    usage: {
      type: "jsonb",
    },
    metadata: {
      type: "jsonb",
    },
    token_input: {
      type: "integer",
    },
    token_output: {
      type: "integer",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("messages", ["session_id", "created_at"], {
    name: "idx_messages_session",
  });

  pgm.createTable("tool_call_logs", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    message_id: {
      type: "uuid",
      references: '"messages"',
      onDelete: "CASCADE",
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: '"users"',
      onDelete: "CASCADE",
    },
    tool_name: {
      type: "varchar(100)",
      notNull: true,
    },
    tool_input: {
      type: "jsonb",
      notNull: true,
    },
    tool_output: {
      type: "jsonb",
    },
    duration_ms: {
      type: "integer",
    },
    status: {
      type: "varchar(20)",
      notNull: true,
      check: "status IN ('success', 'error', 'timeout')",
    },
    error_message: {
      type: "text",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex(
    "tool_call_logs",
    ["user_id", { name: "created_at", sort: "DESC" }],
    {
      name: "idx_tool_call_logs_user_time",
    },
  );

  pgm.createIndex("tool_call_logs", "tool_name", {
    name: "idx_tool_call_logs_tool",
  });
};

/**
 * Roll back the Phase 1.0C chat session, messages, and tool log tables.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 * @returns {void}
 */
export const down = (pgm) => {
  pgm.dropTable("tool_call_logs", {
    ifExists: true,
  });
  pgm.dropTable("messages", {
    ifExists: true,
  });
  pgm.dropTable("chat_sessions", {
    ifExists: true,
  });
};
