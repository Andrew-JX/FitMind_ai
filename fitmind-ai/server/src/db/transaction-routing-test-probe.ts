export interface TransactionTestQueryResult {
  rows: unknown[];
  rowCount?: number | null;
}

export interface TransactionTestQueryCall {
  sql: string;
  params: readonly unknown[] | undefined;
}

type ClientQueryHandler = (
  sql: string,
  params: readonly unknown[] | undefined,
) => Promise<TransactionTestQueryResult> | TransactionTestQueryResult;

/**
 * Builds a deliberately split pool/client pair for transaction tests.
 *
 * A direct pool query fails immediately. Transactional repositories must call
 * `connect()` exactly once and keep BEGIN, business SQL, and COMMIT/ROLLBACK on
 * the returned client. Keeping this probe independent of Vitest lets every
 * repository suite share the same routing invariant without sharing mocks.
 */
export function createTransactionRoutingTestProbe(
  onClientQuery: ClientQueryHandler = () => ({ rows: [] }),
) {
  const poolQueryCalls: TransactionTestQueryCall[] = [];
  const clientQueryCalls: TransactionTestQueryCall[] = [];
  let connectCallCount = 0;
  let releaseCallCount = 0;

  const client = {
    query: async (sql: string, params?: readonly unknown[]) => {
      clientQueryCalls.push({ sql, params });
      return onClientQuery(sql, params);
    },
    release: () => {
      releaseCallCount += 1;
    },
  };

  const pool = {
    query: async (sql: string, params?: readonly unknown[]) => {
      poolQueryCalls.push({ sql, params });
      throw new Error("Transaction query escaped the connected client.");
    },
    connect: async () => {
      connectCallCount += 1;
      return client;
    },
  };

  return {
    pool,
    client,
    poolQueryCalls,
    clientQueryCalls,
    get clientStatements() {
      return clientQueryCalls.map(({ sql }) =>
        sql.trim().replace(/\s+/gu, " "),
      );
    },
    get connectCallCount() {
      return connectCallCount;
    },
    get releaseCallCount() {
      return releaseCallCount;
    },
  };
}

export type TransactionRoutingTestProbe = ReturnType<
  typeof createTransactionRoutingTestProbe
>;
