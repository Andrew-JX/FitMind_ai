/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
export function up(pgm) {
  pgm.createTable("product_feedback", {
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
    rating: {
      type: "smallint",
      check: "rating IS NULL OR rating BETWEEN 1 AND 5",
    },
    message: {
      type: "text",
      check: "message IS NULL OR char_length(message) <= 2000",
    },
    source_route: {
      type: "text",
    },
    user_agent: {
      type: "text",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.addConstraint(
    "product_feedback",
    "product_feedback_rating_or_message_check",
    {
      check:
        "rating IS NOT NULL OR (message IS NOT NULL AND btrim(message) <> '')",
    },
  );

  pgm.createIndex("product_feedback", ["user_id", "created_at"], {
    name: "product_feedback_user_created_at_idx",
  });
}

/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
export function down(pgm) {
  pgm.dropTable("product_feedback");
}
