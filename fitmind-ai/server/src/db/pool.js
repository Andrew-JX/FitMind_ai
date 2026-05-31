import { Pool } from "pg";

import { loadServerEnv } from "../env.js";

/**
 * Create a PostgreSQL pool using the configured DATABASE_URL.
 *
 * @returns {Pool} Configured PostgreSQL pool.
 */
export function createDbPool() {
  const env = loadServerEnv();

  if (env.databaseUrl === undefined) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  return new Pool({
    connectionString: env.databaseUrl,
  });
}
