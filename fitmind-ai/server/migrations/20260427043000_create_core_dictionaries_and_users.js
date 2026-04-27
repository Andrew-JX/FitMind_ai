/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * Create the Phase 1.0A core dictionary and user tables.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 * @returns {void}
 */
export const up = (pgm) => {
  pgm.createExtension("uuid-ossp", {
    ifNotExists: true,
  });

  pgm.createTable("users", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    email: {
      type: "varchar(255)",
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: "varchar(255)",
      notNull: true,
    },
    display_name: {
      type: "varchar(100)",
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

  pgm.createIndex("users", "email", {
    name: "idx_users_email",
  });

  pgm.createTable("muscle_groups", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    code: {
      type: "varchar(50)",
      notNull: true,
      unique: true,
    },
    name_en: {
      type: "varchar(100)",
      notNull: true,
    },
    name_zh: {
      type: "varchar(100)",
      notNull: true,
    },
    parent_id: {
      type: "uuid",
      references: '"muscle_groups"',
      onDelete: "SET NULL",
    },
    recovery_hours: {
      type: "integer",
      notNull: true,
      default: 48,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createTable("exercises", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    code: {
      type: "varchar(100)",
      notNull: true,
      unique: true,
    },
    name_en: {
      type: "varchar(150)",
      notNull: true,
    },
    name_zh: {
      type: "varchar(150)",
      notNull: true,
    },
    movement_pattern: {
      type: "varchar(50)",
    },
    equipment: {
      type: "varchar(50)",
    },
    is_compound: {
      type: "boolean",
      notNull: true,
      default: true,
    },
    default_rest_seconds: {
      type: "integer",
      default: 120,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("exercises", "code", {
    name: "idx_exercises_code",
  });

  pgm.createIndex("exercises", "movement_pattern", {
    name: "idx_exercises_pattern",
  });

  pgm.createTable("exercise_muscles", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    exercise_id: {
      type: "uuid",
      notNull: true,
      references: '"exercises"',
      onDelete: "CASCADE",
    },
    muscle_group_id: {
      type: "uuid",
      notNull: true,
      references: '"muscle_groups"',
      onDelete: "CASCADE",
    },
    contribution_weight: {
      type: "numeric(3,2)",
      notNull: true,
      check: "contribution_weight BETWEEN 0 AND 1",
    },
    is_primary: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.addConstraint(
    "exercise_muscles",
    "exercise_muscles_exercise_id_muscle_group_id_key",
    {
      unique: ["exercise_id", "muscle_group_id"],
    },
  );

  pgm.createIndex("exercise_muscles", "exercise_id", {
    name: "idx_exercise_muscles_exercise",
  });

  pgm.createIndex("exercise_muscles", "muscle_group_id", {
    name: "idx_exercise_muscles_muscle",
  });
};

/**
 * Roll back the Phase 1.0A core dictionary and user tables.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 * @returns {void}
 */
export const down = (pgm) => {
  pgm.dropTable("exercise_muscles", {
    ifExists: true,
  });
  pgm.dropTable("exercises", {
    ifExists: true,
  });
  pgm.dropTable("muscle_groups", {
    ifExists: true,
  });
  pgm.dropTable("users", {
    ifExists: true,
  });
};
