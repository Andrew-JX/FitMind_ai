import { timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";

import { Router } from "express";

import { exerciseMuscleSeeds } from "../db/seed-data/exercise-muscles.js";
import { exerciseSeeds } from "../db/seed-data/exercises.js";
import { muscleGroupSeeds } from "../db/seed-data/muscle-groups.js";

export const oneShotDbInitRouter = Router();

interface DbPoolLike {
  end: () => Promise<void>;
  query: <TRow = unknown>(
    sql: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: TRow[] }>;
}

const require = createRequire(import.meta.url);
const { Pool } = require("pg") as {
  Pool: new (config: { connectionString: string }) => DbPoolLike;
};

oneShotDbInitRouter.post("/one-shot-db-init-7d", async (request, response) => {
  const configuredToken = process.env.DB_INIT_TOKEN;
  const requestToken = request.header("x-db-init-token");
  const databaseUrl = process.env.DATABASE_URL;

  if (!configuredToken || !requestToken || !tokensMatch(requestToken, configuredToken)) {
    return response.status(404).json({ ok: false });
  }

  if (!databaseUrl || databaseUrl.trim().length < 10) {
    return response.status(500).json({
      ok: false,
      error: "DATABASE_URL is not configured.",
    });
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await runMigration(pool);
    await runSeed(pool);
    const counts = await loadCounts(pool);

    return response.json({
      ok: true,
      migration: "completed",
      seed: "completed",
      counts,
    });
  } catch {
    return response.status(500).json({
      ok: false,
      error: "Database initialization failed.",
    });
  } finally {
    await pool.end();
  }
});

function tokensMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

async function runMigration(pool: DbPoolLike): Promise<void> {
  await pool.query("BEGIN");

  try {
    await pool.query(`
      ALTER TABLE exercises
        ADD COLUMN IF NOT EXISTS technique_cues_zh text[] DEFAULT ARRAY[]::text[] NOT NULL,
        ADD COLUMN IF NOT EXISTS common_mistakes_zh text[] DEFAULT ARRAY[]::text[] NOT NULL,
        ADD COLUMN IF NOT EXISTS equipment_notes_zh text
    `);
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

async function runSeed(pool: DbPoolLike): Promise<void> {
  await pool.query("BEGIN");

  try {
    const muscleGroupIds = await seedMuscleGroups(pool);
    const exerciseIds = await seedExercises(pool);
    await seedExerciseMuscles(pool, exerciseIds, muscleGroupIds);
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

async function seedMuscleGroups(pool: DbPoolLike): Promise<Map<string, string>> {
  const idByCode = new Map<string, string>();

  for (const seed of muscleGroupSeeds) {
    const parentId =
      seed.parentCode === null ? null : idByCode.get(seed.parentCode);

    if (seed.parentCode !== null && parentId === undefined) {
      throw new Error("Missing parent muscle group seed.");
    }

    const result = await pool.query<{ id: string }>(
      `
        INSERT INTO muscle_groups (
          code,
          name_en,
          name_zh,
          parent_id,
          recovery_hours
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (code)
        DO UPDATE SET
          name_en = EXCLUDED.name_en,
          name_zh = EXCLUDED.name_zh,
          parent_id = EXCLUDED.parent_id,
          recovery_hours = EXCLUDED.recovery_hours
        RETURNING id
      `,
      [
        seed.code,
        seed.nameEn,
        seed.nameZh,
        parentId ?? null,
        seed.recoveryHours,
      ],
    );

    const insertedId = result.rows[0]?.id;

    if (!insertedId) {
      throw new Error("Failed to upsert muscle group.");
    }

    idByCode.set(seed.code, insertedId);
  }

  return idByCode;
}

async function seedExercises(pool: DbPoolLike): Promise<Map<string, string>> {
  const idByCode = new Map<string, string>();

  for (const seed of exerciseSeeds) {
    const result = await pool.query<{ id: string }>(
      `
        INSERT INTO exercises (
          code,
          name_en,
          name_zh,
          movement_pattern,
          equipment,
          is_compound,
          default_rest_seconds,
          technique_cues_zh,
          common_mistakes_zh,
          equipment_notes_zh
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (code)
        DO UPDATE SET
          name_en = EXCLUDED.name_en,
          name_zh = EXCLUDED.name_zh,
          movement_pattern = EXCLUDED.movement_pattern,
          equipment = EXCLUDED.equipment,
          is_compound = EXCLUDED.is_compound,
          default_rest_seconds = EXCLUDED.default_rest_seconds,
          technique_cues_zh = EXCLUDED.technique_cues_zh,
          common_mistakes_zh = EXCLUDED.common_mistakes_zh,
          equipment_notes_zh = EXCLUDED.equipment_notes_zh
        RETURNING id
      `,
      [
        seed.code,
        seed.nameEn,
        seed.nameZh,
        seed.movementPattern,
        seed.equipment,
        seed.isCompound,
        seed.defaultRestSeconds,
        seed.techniqueCuesZh,
        seed.commonMistakesZh,
        seed.equipmentNotesZh,
      ],
    );

    const insertedId = result.rows[0]?.id;

    if (!insertedId) {
      throw new Error("Failed to upsert exercise.");
    }

    idByCode.set(seed.code, insertedId);
  }

  return idByCode;
}

async function seedExerciseMuscles(
  pool: DbPoolLike,
  exerciseIds: ReadonlyMap<string, string>,
  muscleGroupIds: ReadonlyMap<string, string>,
): Promise<void> {
  for (const seed of exerciseMuscleSeeds) {
    const exerciseId = exerciseIds.get(seed.exerciseCode);
    const muscleGroupId = muscleGroupIds.get(seed.muscleCode);

    if (!exerciseId || !muscleGroupId) {
      throw new Error("Missing seed mapping dependency.");
    }

    await pool.query(
      `
        INSERT INTO exercise_muscles (
          exercise_id,
          muscle_group_id,
          contribution_weight,
          is_primary
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (exercise_id, muscle_group_id)
        DO UPDATE SET
          contribution_weight = EXCLUDED.contribution_weight,
          is_primary = EXCLUDED.is_primary
      `,
      [exerciseId, muscleGroupId, seed.contributionWeight, seed.isPrimary],
    );
  }
}

async function loadCounts(pool: DbPoolLike): Promise<{
  exerciseMuscles: number;
  exercises: number;
  muscleGroups: number;
}> {
  const result = await pool.query<{
    exercise_muscles: number;
    exercises: number;
    muscle_groups: number;
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM muscle_groups) AS muscle_groups,
      (SELECT COUNT(*)::int FROM exercises) AS exercises,
      (SELECT COUNT(*)::int FROM exercise_muscles) AS exercise_muscles
  `);
  const row = result.rows[0];

  if (!row) {
    throw new Error("Failed to load seed counts.");
  }

  return {
    exerciseMuscles: row.exercise_muscles,
    exercises: row.exercises,
    muscleGroups: row.muscle_groups,
  };
}
