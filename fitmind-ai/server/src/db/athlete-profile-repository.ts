import { createDbPool } from "./pool.js";

interface DbPoolLike {
  query: (
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: unknown[]; rowCount?: number | null }>;
  end?: () => Promise<void>;
}

export interface AthleteProfileRow {
  user_id: string;
  goal: string;
  weekly_days: number;
  available_equipment: string[];
  injury_constraints: string[];
  created_at: string;
  updated_at: string;
}

export interface UpsertAthleteProfileInput {
  userId: string;
  goal: string;
  weeklyDays: number;
  availableEquipment: string[];
  injuryConstraints: string[];
}

/**
 * Reads the single athlete profile for a user, or null when none exists yet.
 *
 * @param userId - Owner user id
 * @param pool - Optional injected pool; defaults to the process-owned facade
 * @returns The profile row, or null
 */
export async function getAthleteProfileByUserId(
  userId: string,
  pool?: DbPoolLike,
): Promise<AthleteProfileRow | null> {
  const activePool = pool ?? createDbPool();
  const ownsPool = pool === undefined;

  try {
    const result = await activePool.query(
      `
        SELECT
          user_id,
          goal,
          weekly_days,
          available_equipment,
          injury_constraints,
          created_at,
          updated_at
        FROM athlete_profiles
        WHERE user_id = $1
      `,
      [userId],
    );

    return (result.rows[0] as AthleteProfileRow | undefined) ?? null;
  } finally {
    if (ownsPool) {
      await activePool.end?.();
    }
  }
}
