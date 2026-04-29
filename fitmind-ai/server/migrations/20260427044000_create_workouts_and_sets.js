/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * Create the Phase 1.0B workouts and sets tables.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 * @returns {void}
 */
export const up = (pgm) => {
  pgm.createTable("workouts", {
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
    performed_at: {
      type: "timestamptz",
      notNull: true,
    },
    duration_minutes: {
      type: "integer",
    },
    notes: {
      type: "text",
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

  pgm.createIndex(
    "workouts",
    ["user_id", { name: "performed_at", sort: "DESC" }],
    {
      name: "idx_workouts_user_perf",
    },
  );

  pgm.createTable("sets", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    workout_id: {
      type: "uuid",
      notNull: true,
      references: '"workouts"',
      onDelete: "CASCADE",
    },
    exercise_id: {
      type: "uuid",
      notNull: true,
      references: '"exercises"',
    },
    set_index: {
      type: "integer",
      notNull: true,
    },
    reps: {
      type: "integer",
      notNull: true,
      check: "reps >= 0",
    },
    weight_kg: {
      type: "numeric(6,2)",
      notNull: true,
      check: "weight_kg >= 0",
    },
    rpe: {
      type: "numeric(3,1)",
      check: "rpe BETWEEN 1 AND 10",
    },
    is_warmup: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    notes: {
      type: "text",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("sets", "workout_id", {
    name: "idx_sets_workout",
  });

  pgm.createIndex("sets", "exercise_id", {
    name: "idx_sets_exercise",
  });
};

/**
 * Roll back the Phase 1.0B workouts and sets tables.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 * @returns {void}
 */
export const down = (pgm) => {
  pgm.dropTable("sets", {
    ifExists: true,
  });
  pgm.dropTable("workouts", {
    ifExists: true,
  });
};
