import { createRequire } from "node:module";

import {
  ensureCurrentHealthConsent,
  type HealthConsentDecision,
  revokeLiveHealthConsentsIfNoStoredData,
  withLockedUser,
  type DbPoolLike,
} from "./user-health-data-repository.js";
import { loadServerEnv } from "../env.js";

interface DbQueryable {
  query: (
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: unknown[]; rowCount?: number | null }>;
}

const require = createRequire(import.meta.url);

async function createRepositoryPool(): Promise<DbPoolLike> {
  const env = loadServerEnv();

  if (env.databaseUrl === undefined) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  const { Pool } = require("pg") as {
    Pool: new (config: { connectionString: string }) => DbPoolLike;
  };

  return new Pool({ connectionString: env.databaseUrl });
}

async function withPool<T>(
  pool: DbPoolLike | undefined,
  work: (queryable: DbQueryable) => Promise<T>,
): Promise<T> {
  const activePool = pool ?? (await createRepositoryPool());

  try {
    return await work(activePool);
  } finally {
    if (pool === undefined) {
      await activePool.end?.();
    }
  }
}

export interface MenstrualOverviewRow {
  dates: string[];
  show_in_history: boolean;
}

export async function getMenstrualOverview(
  userId: string,
  month: string,
  pool?: DbPoolLike,
): Promise<MenstrualOverviewRow> {
  return withPool(pool, async (queryable) => {
    const result = await queryable.query(
      `
        SELECT
          COALESCE(
            (
              SELECT json_agg(period_date::text ORDER BY period_date)
              FROM menstrual_records
              WHERE user_id = $1
                AND period_date >= ($2 || '-01')::date
                AND period_date < (($2 || '-01')::date + interval '1 month')
            ),
            '[]'::json
          ) AS dates,
          COALESCE(
            (
              SELECT show_period_in_history
              FROM personal_health_settings
              WHERE user_id = $1
            ),
            false
          ) AS show_in_history
      `,
      [userId, month],
    );

    return result.rows[0] as MenstrualOverviewRow;
  });
}

export type SensitiveWriteResult<T> =
  | { status: "saved"; value: T }
  | { status: "consent_missing" }
  | { status: "consent_stale" };

export async function setMenstrualDate(
  input: {
    userId: string;
    date: string;
    isPeriod: boolean;
    policyVersion: string;
    consentDecision?: HealthConsentDecision | undefined;
  },
  pool?: DbPoolLike,
): Promise<SensitiveWriteResult<{ date: string; isPeriod: boolean }>> {
  return withLockedUser(input.userId, pool, async (client) => {
    if (input.isPeriod) {
      const consent = await ensureCurrentHealthConsent(client, {
        userId: input.userId,
        policyVersion: input.policyVersion,
        source: "health_tool",
        ...(input.consentDecision === undefined
          ? {}
          : { consentDecision: input.consentDecision }),
      });

      if (consent.status !== "available") {
        return consent;
      }

      await client.query(
        `
          INSERT INTO menstrual_records (user_id, period_date)
          VALUES ($1, $2::date)
          ON CONFLICT (user_id, period_date) DO NOTHING
        `,
        [input.userId, input.date],
      );
    } else {
      await client.query(
        `DELETE FROM menstrual_records WHERE user_id = $1 AND period_date = $2::date`,
        [input.userId, input.date],
      );
      await revokeLiveHealthConsentsIfNoStoredData(client, input.userId);
    }

    return {
      status: "saved",
      value: { date: input.date, isPeriod: input.isPeriod },
    };
  });
}

export async function updateMenstrualSettings(
  userId: string,
  showInHistory: boolean,
  pool?: DbPoolLike,
): Promise<boolean> {
  return withPool(pool, async (queryable) => {
    const result = await queryable.query(
      `
        INSERT INTO personal_health_settings (
          user_id,
          show_period_in_history,
          updated_at
        )
        VALUES ($1, $2, now())
        ON CONFLICT (user_id) DO UPDATE SET
          show_period_in_history = EXCLUDED.show_period_in_history,
          updated_at = now()
        RETURNING show_period_in_history
      `,
      [userId, showInHistory],
    );

    return (result.rows[0] as { show_period_in_history: boolean })
      .show_period_in_history;
  });
}

export async function deleteMenstrualRecords(
  userId: string,
  pool?: DbPoolLike,
): Promise<void> {
  await withLockedUser(userId, pool, async (client) => {
    await client.query("DELETE FROM menstrual_records WHERE user_id = $1", [
      userId,
    ]);
    await revokeLiveHealthConsentsIfNoStoredData(client, userId);
  });
}

export interface BodyMeasurementRow {
  id: string;
  measured_on: string;
  weight_kg: string | number | null;
  target_weight_kg: string | number | null;
  body_fat_percent: string | number | null;
  neck_cm: string | number | null;
  shoulder_cm: string | number | null;
  chest_cm: string | number | null;
  waist_cm: string | number | null;
  hip_cm: string | number | null;
  left_upper_arm_cm: string | number | null;
  right_upper_arm_cm: string | number | null;
  left_thigh_cm: string | number | null;
  right_thigh_cm: string | number | null;
  left_calf_cm: string | number | null;
  right_calf_cm: string | number | null;
  created_at: string;
  updated_at: string;
}

const BODY_COLUMNS = `
  id,
  measured_on::text AS measured_on,
  weight_kg,
  target_weight_kg,
  body_fat_percent,
  neck_cm,
  shoulder_cm,
  chest_cm,
  waist_cm,
  hip_cm,
  left_upper_arm_cm,
  right_upper_arm_cm,
  left_thigh_cm,
  right_thigh_cm,
  left_calf_cm,
  right_calf_cm,
  created_at,
  updated_at
`;

export async function listBodyMeasurements(
  userId: string,
  pool?: DbPoolLike,
): Promise<BodyMeasurementRow[]> {
  return withPool(pool, async (queryable) => {
    const result = await queryable.query(
      `
        SELECT ${BODY_COLUMNS}
        FROM body_measurements
        WHERE user_id = $1
        ORDER BY measured_on DESC, updated_at DESC
        LIMIT 366
      `,
      [userId],
    );

    return result.rows as BodyMeasurementRow[];
  });
}

export async function saveBodyMeasurement(
  input: {
    userId: string;
    measuredOn: string;
    values: readonly (number | null)[];
    policyVersion: string;
    consentDecision?: HealthConsentDecision | undefined;
  },
  pool?: DbPoolLike,
): Promise<SensitiveWriteResult<BodyMeasurementRow>> {
  return withLockedUser(input.userId, pool, async (client) => {
    const consent = await ensureCurrentHealthConsent(client, {
      userId: input.userId,
      policyVersion: input.policyVersion,
      source: "health_tool",
      ...(input.consentDecision === undefined
        ? {}
        : { consentDecision: input.consentDecision }),
    });

    if (consent.status !== "available") {
      return consent;
    }

    const result = await client.query(
      `
        INSERT INTO body_measurements (
          user_id,
          measured_on,
          weight_kg,
          target_weight_kg,
          body_fat_percent,
          neck_cm,
          shoulder_cm,
          chest_cm,
          waist_cm,
          hip_cm,
          left_upper_arm_cm,
          right_upper_arm_cm,
          left_thigh_cm,
          right_thigh_cm,
          left_calf_cm,
          right_calf_cm,
          updated_at
        )
        VALUES (
          $1, $2::date, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16, now()
        )
        ON CONFLICT (user_id, measured_on) DO UPDATE SET
          weight_kg = EXCLUDED.weight_kg,
          target_weight_kg = EXCLUDED.target_weight_kg,
          body_fat_percent = EXCLUDED.body_fat_percent,
          neck_cm = EXCLUDED.neck_cm,
          shoulder_cm = EXCLUDED.shoulder_cm,
          chest_cm = EXCLUDED.chest_cm,
          waist_cm = EXCLUDED.waist_cm,
          hip_cm = EXCLUDED.hip_cm,
          left_upper_arm_cm = EXCLUDED.left_upper_arm_cm,
          right_upper_arm_cm = EXCLUDED.right_upper_arm_cm,
          left_thigh_cm = EXCLUDED.left_thigh_cm,
          right_thigh_cm = EXCLUDED.right_thigh_cm,
          left_calf_cm = EXCLUDED.left_calf_cm,
          right_calf_cm = EXCLUDED.right_calf_cm,
          updated_at = now()
        RETURNING ${BODY_COLUMNS}
      `,
      [input.userId, input.measuredOn, ...input.values],
    );

    return {
      status: "saved",
      value: result.rows[0] as BodyMeasurementRow,
    };
  });
}

export async function deleteBodyMeasurement(
  userId: string,
  measurementId: string,
  pool?: DbPoolLike,
): Promise<boolean> {
  return withLockedUser(userId, pool, async (client) => {
    const result = await client.query(
      "DELETE FROM body_measurements WHERE id = $1 AND user_id = $2",
      [measurementId, userId],
    );
    await revokeLiveHealthConsentsIfNoStoredData(client, userId);
    return (result.rowCount ?? 0) > 0;
  });
}

export async function deleteAllBodyMeasurements(
  userId: string,
  pool?: DbPoolLike,
): Promise<void> {
  await withLockedUser(userId, pool, async (client) => {
    await client.query("DELETE FROM body_measurements WHERE user_id = $1", [
      userId,
    ]);
    await revokeLiveHealthConsentsIfNoStoredData(client, userId);
  });
}

export interface TrainingMemoRow {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

const MEMO_COLUMNS = `id, title, content, is_pinned, created_at, updated_at`;

export async function listTrainingMemos(
  userId: string,
  pool?: DbPoolLike,
): Promise<TrainingMemoRow[]> {
  return withPool(pool, async (queryable) => {
    const result = await queryable.query(
      `
        SELECT ${MEMO_COLUMNS}
        FROM training_memos
        WHERE user_id = $1
        ORDER BY is_pinned DESC, updated_at DESC
      `,
      [userId],
    );
    return result.rows as TrainingMemoRow[];
  });
}

export async function createTrainingMemo(
  input: { userId: string; title: string; content: string; isPinned: boolean },
  pool?: DbPoolLike,
): Promise<TrainingMemoRow> {
  return withPool(pool, async (queryable) => {
    const result = await queryable.query(
      `
        INSERT INTO training_memos (user_id, title, content, is_pinned)
        VALUES ($1, $2, $3, $4)
        RETURNING ${MEMO_COLUMNS}
      `,
      [input.userId, input.title, input.content, input.isPinned],
    );
    return result.rows[0] as TrainingMemoRow;
  });
}

export async function updateTrainingMemo(
  input: {
    userId: string;
    id: string;
    title?: string | undefined;
    content?: string | undefined;
    isPinned?: boolean | undefined;
  },
  pool?: DbPoolLike,
): Promise<TrainingMemoRow | null> {
  return withPool(pool, async (queryable) => {
    const result = await queryable.query(
      `
        UPDATE training_memos
        SET
          title = COALESCE($3, title),
          content = COALESCE($4, content),
          is_pinned = COALESCE($5, is_pinned),
          updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING ${MEMO_COLUMNS}
      `,
      [
        input.id,
        input.userId,
        input.title ?? null,
        input.content ?? null,
        input.isPinned ?? null,
      ],
    );
    return (result.rows[0] as TrainingMemoRow | undefined) ?? null;
  });
}

export async function deleteTrainingMemo(
  userId: string,
  memoId: string,
  pool?: DbPoolLike,
): Promise<boolean> {
  return withPool(pool, async (queryable) => {
    const result = await queryable.query(
      "DELETE FROM training_memos WHERE id = $1 AND user_id = $2",
      [memoId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  });
}

export async function deleteAllSensitiveHealthData(
  userId: string,
  pool?: DbPoolLike,
): Promise<void> {
  await withLockedUser(userId, pool, async (client) => {
    await client.query(
      `
        UPDATE athlete_profiles
        SET injury_constraints = '{}'::text[], updated_at = now()
        WHERE user_id = $1
      `,
      [userId],
    );
    await client.query("DELETE FROM menstrual_records WHERE user_id = $1", [
      userId,
    ]);
    await client.query("DELETE FROM body_measurements WHERE user_id = $1", [
      userId,
    ]);
    await revokeLiveHealthConsentsIfNoStoredData(client, userId);
  });
}
