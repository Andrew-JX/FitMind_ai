/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
export function up(pgm) {
  // One row per (user, consent type, policy version). PIPL art. 14 requires
  // fresh consent when the purpose or the handled categories change, so the
  // question this table has to answer is not "did they consent" but "which
  // version did they consent to" — which a column on `users` cannot answer
  // once the policy is revised.
  pgm.createTable("user_consents", {
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
    // cross_border_transfer: art. 39, storing personal information abroad.
    // sensitive_health_data: art. 28/29, injury constraints in the profile.
    // Separate rows because they are separate consents, asked at different
    // moments — bundling them back into one flag is the thing art. 29 forbids.
    consent_type: {
      type: "text",
      notNull: true,
      check:
        "consent_type IN ('cross_border_transfer', 'sensitive_health_data')",
    },
    policy_version: {
      type: "text",
      notNull: true,
      check: "char_length(btrim(policy_version)) > 0",
    },
    accepted_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
    // Set when the user withdraws (PIPL art. 15). The row is kept rather than
    // deleted: it is still the evidence that permission existed between
    // `accepted_at` and here, which is exactly what an audit would ask about.
    // Everything that decides "may we process this" must therefore test
    // `revoked_at IS NULL`, not merely that a row exists.
    revoked_at: {
      type: "timestamptz",
    },
    // Where the consent was actually collected. Kept because "how was this
    // obtained" is part of what has to be provable, and because a value that
    // could only come from a backfill script would be visible here rather
    // than indistinguishable from a real one.
    source: {
      type: "text",
      notNull: true,
      check: "source IN ('registration', 'profile_form', 'consent_catchup')",
    },
  });

  // Partial, not a plain unique constraint. At most one *live* consent per
  // (user, type, version) — so re-submitting one the user already gave is a
  // no-op — while any number of revoked rows may sit alongside it.
  //
  // A full unique constraint forced grant → revoke → grant to reuse a single
  // row, which meant the second grant overwrote when the first was given and
  // erased the withdrawal entirely. The table then could not answer the one
  // question it exists for: was this processing permitted at time T. Consents
  // are append-only here; withdrawal closes a row rather than freeing it for
  // reuse.
  pgm.createIndex(
    "user_consents",
    ["user_id", "consent_type", "policy_version"],
    {
      name: "user_consents_one_live_per_version_idx",
      unique: true,
      where: "revoked_at IS NULL",
    },
  );

  pgm.createIndex("user_consents", ["user_id", "consent_type"], {
    name: "user_consents_user_type_idx",
  });
}

/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
export function down(pgm) {
  pgm.dropTable("user_consents");
}
