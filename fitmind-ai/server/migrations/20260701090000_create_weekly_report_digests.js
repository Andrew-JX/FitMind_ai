/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
export function up(pgm) {
  pgm.createTable("weekly_report_digests", {
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
    iso_year: {
      type: "integer",
      notNull: true,
    },
    iso_week: {
      type: "integer",
      notNull: true,
      check: "iso_week BETWEEN 1 AND 53",
    },
    week_start_date: {
      type: "date",
      notNull: true,
    },
    week_end_date: {
      type: "date",
      notNull: true,
    },
    status: {
      type: "text",
      notNull: true,
      check: "status IN ('ready', 'empty')",
    },
    title: {
      type: "varchar(160)",
      notNull: true,
    },
    summary: {
      type: "text",
      notNull: true,
    },
    report_snapshot: {
      type: "jsonb",
      notNull: true,
    },
    generated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
    dismissed_at: {
      type: "timestamptz",
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

  pgm.addConstraint(
    "weekly_report_digests",
    "weekly_report_digests_user_iso_week_unique",
    {
      unique: ["user_id", "iso_year", "iso_week"],
    },
  );
  pgm.createIndex(
    "weekly_report_digests",
    ["user_id", "dismissed_at", "generated_at"],
    {
      name: "weekly_report_digests_user_dismissed_generated_idx",
    },
  );
}

/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
export function down(pgm) {
  pgm.dropTable("weekly_report_digests");
}
