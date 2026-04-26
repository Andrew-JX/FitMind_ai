/** @type {import('node-pg-migrate').RunnerOption} */
module.exports = {
  dir: "./migrations",
  direction: "up",
  migrationsTable: "pgmigrations",
  databaseUrl: process.env.DATABASE_URL ?? "",
};
