/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
export function up(pgm) {
  pgm.createTable("personal_health_settings", {
    user_id: {
      type: "uuid",
      primaryKey: true,
      references: "users(id)",
      onDelete: "cascade",
    },
    show_period_in_history: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createTable("menstrual_records", {
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "cascade",
    },
    period_date: {
      type: "date",
      notNull: true,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });
  pgm.addConstraint("menstrual_records", "menstrual_records_pkey", {
    primaryKey: ["user_id", "period_date"],
  });
  pgm.createIndex("menstrual_records", ["user_id", "period_date"], {
    name: "menstrual_records_user_date_idx",
  });

  pgm.createTable("body_measurements", {
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
    measured_on: { type: "date", notNull: true },
    weight_kg: { type: "numeric(6,2)" },
    target_weight_kg: { type: "numeric(6,2)" },
    body_fat_percent: { type: "numeric(5,2)" },
    neck_cm: { type: "numeric(6,2)" },
    shoulder_cm: { type: "numeric(6,2)" },
    chest_cm: { type: "numeric(6,2)" },
    waist_cm: { type: "numeric(6,2)" },
    hip_cm: { type: "numeric(6,2)" },
    left_upper_arm_cm: { type: "numeric(6,2)" },
    right_upper_arm_cm: { type: "numeric(6,2)" },
    left_thigh_cm: { type: "numeric(6,2)" },
    right_thigh_cm: { type: "numeric(6,2)" },
    left_calf_cm: { type: "numeric(6,2)" },
    right_calf_cm: { type: "numeric(6,2)" },
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
  pgm.addConstraint("body_measurements", "body_measurements_user_date_key", {
    unique: ["user_id", "measured_on"],
  });
  pgm.createIndex("body_measurements", ["user_id", "measured_on"], {
    name: "body_measurements_user_date_idx",
  });

  pgm.createTable("training_memos", {
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
    title: { type: "text", notNull: true },
    content: { type: "text", notNull: true },
    is_pinned: { type: "boolean", notNull: true, default: false },
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
  pgm.sql(`
    CREATE INDEX training_memos_user_order_idx
    ON training_memos (user_id, is_pinned DESC, updated_at DESC)
  `);

  // The new health tools collect their separate consent at the moment of the
  // first save. Preserve that collection context in the audit row.
  pgm.dropConstraint("user_consents", "user_consents_source_check", {
    ifExists: true,
  });
  pgm.addConstraint("user_consents", "user_consents_source_check", {
    check:
      "source IN ('registration', 'profile_form', 'health_tool', 'consent_catchup')",
  });
}

/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
export function down(pgm) {
  pgm.dropConstraint("user_consents", "user_consents_source_check", {
    ifExists: true,
  });
  pgm.addConstraint("user_consents", "user_consents_source_check", {
    check: "source IN ('registration', 'profile_form', 'consent_catchup')",
  });
  pgm.dropTable("training_memos");
  pgm.dropTable("body_measurements");
  pgm.dropTable("menstrual_records");
  pgm.dropTable("personal_health_settings");
}
