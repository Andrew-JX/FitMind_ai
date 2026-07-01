export interface DbPool {
  query: (
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: unknown[]; rowCount?: number | null }>;
  end: () => Promise<void>;
}

export function createDbPool(): DbPool;
