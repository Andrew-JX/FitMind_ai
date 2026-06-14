/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
export function up(pgm) {
  // An accepted next-week plan snapshot. The draft (动作×组×次×目标重量) is stored
  // as jsonb; adherence is computed at read time against logged workouts in range.
  pgm.createTable("planned_workouts", {
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
    status: {
      type: "text",
      notNull: true,
      default: "active",
      check: "status IN ('active', 'completed', 'abandoned')",
    },
    start_date: {
      type: "date",
      notNull: true,
    },
    end_date: {
      type: "date",
      notNull: true,
    },
    plan: {
      type: "jsonb",
      notNull: true,
    },
    source_message_id: {
      type: "uuid",
      references: "messages(id)",
      onDelete: "set null",
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

  pgm.createIndex("planned_workouts", ["user_id", "status", "created_at"], {
    name: "planned_workouts_user_status_created_at_idx",
  });
}

/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
export function down(pgm) {
  pgm.dropTable("planned_workouts");
}
