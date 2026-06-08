/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
export function up(pgm) {
  pgm.createTable("assistant_saved_insights", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "cascade",
    },
    message_id: {
      type: "uuid",
      references: "messages(id)",
      onDelete: "set null",
    },
    insight_type: {
      type: "varchar(40)",
      notNull: true,
      check:
        "insight_type IN ('weekly_report', 'plateau_diagnosis', 'next_week_plan')",
    },
    title: {
      type: "varchar(160)",
      notNull: true,
    },
    summary: {
      type: "text",
      notNull: true,
    },
    structured_snapshot: {
      type: "jsonb",
      notNull: true,
    },
    share_text: {
      type: "text",
      notNull: true,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("assistant_saved_insights", ["user_id", "created_at"], {
    name: "assistant_saved_insights_user_created_at_idx",
  });
  pgm.createIndex("assistant_saved_insights", "insight_type", {
    name: "assistant_saved_insights_type_idx",
  });
  pgm.createIndex("assistant_saved_insights", "message_id", {
    name: "assistant_saved_insights_message_id_unique_idx",
    unique: true,
  });
}

/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
export function down(pgm) {
  pgm.dropTable("assistant_saved_insights");
}
