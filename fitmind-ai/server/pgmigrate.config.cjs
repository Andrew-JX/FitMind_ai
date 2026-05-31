const fs = require("node:fs");
const path = require("node:path");

function loadRootEnvIfNeeded() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const envPath = path.resolve(__dirname, "..", ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const source = fs.readFileSync(envPath, "utf8");

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadRootEnvIfNeeded();

/** @type {import('node-pg-migrate').RunnerOption} */
module.exports = {
  dir: "./migrations",
  direction: "up",
  migrationsTable: "pgmigrations",
  databaseUrl: process.env.DATABASE_URL ?? "",
};
