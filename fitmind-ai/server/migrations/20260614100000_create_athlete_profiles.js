/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
export function up(pgm) {
  // One thin profile per user; user_id doubles as the primary key so an upsert
  // keeps a single row per athlete.
  pgm.createTable("athlete_profiles", {
    user_id: {
      type: "uuid",
      primaryKey: true,
      references: "users(id)",
      onDelete: "cascade",
    },
    goal: {
      type: "text",
      notNull: true,
      check:
        "goal IN ('strength', 'hypertrophy', 'endurance', 'general_fitness')",
    },
    weekly_days: {
      type: "smallint",
      notNull: true,
      check: "weekly_days BETWEEN 1 AND 7",
    },
    available_equipment: {
      type: "text[]",
      notNull: true,
      default: pgm.func("'{}'::text[]"),
    },
    injury_constraints: {
      type: "text[]",
      notNull: true,
      default: pgm.func("'{}'::text[]"),
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
}

/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
export function down(pgm) {
  pgm.dropTable("athlete_profiles");
}
