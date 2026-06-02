/**
 * Add Chinese exercise detail content fields for the mobile exercise library.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 * @returns {void}
 */
export const up = (pgm) => {
  pgm.addColumns("exercises", {
    technique_cues_zh: {
      type: "text[]",
      notNull: true,
      default: pgm.func("ARRAY[]::text[]"),
    },
    common_mistakes_zh: {
      type: "text[]",
      notNull: true,
      default: pgm.func("ARRAY[]::text[]"),
    },
    equipment_notes_zh: {
      type: "text",
    },
  });
};

/**
 * Roll back the Phase 4.5 Batch 7D exercise detail fields.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 * @returns {void}
 */
export const down = (pgm) => {
  pgm.dropColumns("exercises", [
    "technique_cues_zh",
    "common_mistakes_zh",
    "equipment_notes_zh",
  ]);
};
