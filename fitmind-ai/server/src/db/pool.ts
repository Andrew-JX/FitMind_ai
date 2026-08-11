import { createRequire } from "node:module";

import { loadServerEnv } from "../env.js";

export interface DbQueryResult {
  rows: unknown[];
  rowCount?: number | null;
}

export interface DbClient {
  query: (sql: string, params?: readonly unknown[]) => Promise<DbQueryResult>;
  release: () => void;
}

export interface DbPool {
  query: (sql: string, params?: readonly unknown[]) => Promise<DbQueryResult>;
  connect: () => Promise<DbClient>;
  end: () => Promise<void>;
}

interface PgPool extends DbPool {
  on: (event: "error", listener: (error: unknown) => void) => PgPool;
}

interface PgPoolConstructor {
  new (config: {
    connectionString: string;
    max: number;
    allowExitOnIdle: boolean;
  }): PgPool;
}

export interface DbPoolIdleErrorLog {
  event: "db_pool_idle_error";
  errorType: string;
  errorCode?: string;
}

const require = createRequire(import.meta.url);
const MAX_POOL_CLIENTS = 10;
let processPool: PgPool | undefined;

function conservativeIdentifier(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]{1,31}$/.test(value)
    ? value
    : undefined;
}

/**
 * Build the only payload permitted for an idle-client pool error.
 *
 * Error messages and stacks may contain SQL, connection details, or user data,
 * so they are deliberately not accepted by this boundary.
 */
export function createDbPoolIdleErrorLog(error: unknown): DbPoolIdleErrorLog {
  const errorRecord =
    typeof error === "object" && error !== null
      ? (error as { code?: unknown; name?: unknown })
      : undefined;
  const errorType = conservativeIdentifier(errorRecord?.name) ?? "ERROR";
  const errorCode = conservativeIdentifier(errorRecord?.code);

  return {
    event: "db_pool_idle_error",
    errorType,
    ...(errorCode === undefined ? {} : { errorCode }),
  };
}

function getOrCreateProcessPool(): PgPool {
  if (processPool !== undefined) {
    return processPool;
  }

  const env = loadServerEnv();

  if (env.databaseUrl === undefined) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  const { Pool } = require("pg") as { Pool: PgPoolConstructor };
  const nextPool = new Pool({
    connectionString: env.databaseUrl,
    max: MAX_POOL_CLIENTS,
    allowExitOnIdle: true,
  });

  nextPool.on("error", (error) => {
    console.error(JSON.stringify(createDbPoolIdleErrorLog(error)));
  });
  processPool = nextPool;

  return nextPool;
}

const processPoolFacade: DbPool = {
  query: (sql, params) => getOrCreateProcessPool().query(sql, params),
  connect: () => getOrCreateProcessPool().connect(),
  // Repositories historically closed pools they created. Their default path
  // now receives this process-owned facade, so request cleanup must be a no-op.
  end: async () => undefined,
};

/** Return the stable process-owned database facade. */
export function createDbPool(): DbPool {
  getOrCreateProcessPool();
  return processPoolFacade;
}

/** Drain the underlying process pool at an explicit lifecycle boundary. */
export async function closeDbPool(): Promise<void> {
  const poolToClose = processPool;
  processPool = undefined;

  if (poolToClose !== undefined) {
    await poolToClose.end();
  }
}
