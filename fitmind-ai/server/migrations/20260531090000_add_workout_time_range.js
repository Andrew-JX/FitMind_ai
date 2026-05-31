/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * Add optional precise workout time range fields.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 * @returns {void}
 */
export const up = (pgm) => {
  pgm.addColumns("workouts", {
    started_at: {
      type: "timestamptz",
    },
    ended_at: {
      type: "timestamptz",
    },
  });
};

/**
 * Remove optional precise workout time range fields.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 * @returns {void}
 */
export const down = (pgm) => {
  pgm.dropColumns("workouts", ["started_at", "ended_at"]);
};
