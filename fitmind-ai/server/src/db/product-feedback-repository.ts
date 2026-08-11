import { createDbPool } from "./pool.js";

interface DbPoolLike {
  query: (
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: unknown[]; rowCount?: number | null }>;
  end?: () => Promise<void>;
}

export interface ProductFeedbackRow {
  id: string;
  user_id: string;
  rating: number | null;
  message: string | null;
  source_route: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface CreateProductFeedbackInput {
  userId: string;
  rating?: number | null | undefined;
  message?: string | null | undefined;
  sourceRoute?: string | null | undefined;
  userAgent?: string | null | undefined;
}

export async function createProductFeedback(
  input: CreateProductFeedbackInput,
  pool?: DbPoolLike,
): Promise<ProductFeedbackRow> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        INSERT INTO product_feedback (
          user_id,
          rating,
          message,
          source_route,
          user_agent
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          user_id,
          rating,
          message,
          source_route,
          user_agent,
          created_at
      `,
      [
        input.userId,
        input.rating ?? null,
        input.message ?? null,
        input.sourceRoute ?? null,
        input.userAgent ?? null,
      ],
    );

    return result.rows[0] as ProductFeedbackRow;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}
