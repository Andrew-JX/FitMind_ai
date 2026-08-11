import { createDbPool, type DbPool } from "../src/db/pool.js";
import { exerciseMuscleSeeds } from "../src/db/seed-data/exercise-muscles.js";
import { exerciseSeeds } from "../src/db/seed-data/exercises.js";
import { muscleGroupSeeds } from "../src/db/seed-data/muscle-groups.js";

interface MuscleGroupSeed {
  code: string;
  nameEn: string;
  nameZh: string;
  parentCode: string | null;
  recoveryHours: number;
}

interface ExerciseSeed {
  code: string;
  nameEn: string;
  nameZh: string;
  movementPattern: string | null;
  equipment: string | null;
  isCompound: boolean;
  defaultRestSeconds: number;
  techniqueCuesZh: string[];
  commonMistakesZh: string[];
  equipmentNotesZh: string;
}

interface ExerciseMuscleSeed {
  exerciseCode: string;
  muscleCode: string;
  contributionWeight: number;
  isPrimary: boolean;
}

interface SeedOptions {
  help: boolean;
}

/**
 * Parse supported CLI flags for the seed script.
 *
 * @param args - Raw CLI arguments after the script path.
 * @returns Parsed seed script options.
 */
function parseSeedOptions(args: string[]): SeedOptions {
  return {
    help: args.includes("--help") || args.includes("-h"),
  };
}

/**
 * Print usage information for the seed script.
 *
 * @returns Nothing.
 */
function printHelp(): void {
  console.log("Usage: tsx scripts/seed.ts");
  console.log("Seeds muscle_groups, exercises, and exercise_muscles.");
}

/**
 * Seed the muscle_groups table with idempotent upserts.
 *
 * @param pool - PostgreSQL connection pool.
 * @param seeds - Muscle group seeds to insert or update.
 * @returns A lookup from muscle code to database id.
 */
async function seedMuscleGroups(
  pool: DbPool,
  seeds: readonly MuscleGroupSeed[],
): Promise<Map<string, string>> {
  const idByCode = new Map<string, string>();

  for (const seed of seeds) {
    const parentId =
      seed.parentCode === null ? null : idByCode.get(seed.parentCode);

    if (seed.parentCode !== null && parentId === undefined) {
      throw new Error(`Missing parent muscle group seed: ${seed.parentCode}`);
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

    if (insertedId === undefined) {
      throw new Error(`Failed to upsert muscle group: ${seed.code}`);
    }

    idByCode.set(seed.code, insertedId);
  }

  return idByCode;
}

/**
 * Seed the exercises table with idempotent upserts.
 *
 * @param pool - PostgreSQL connection pool.
 * @param seeds - Exercise seeds to insert or update.
 * @returns A lookup from exercise code to database id.
 */
async function seedExercises(
  pool: DbPool,
  seeds: readonly ExerciseSeed[],
): Promise<Map<string, string>> {
  const idByCode = new Map<string, string>();

  for (const seed of seeds) {
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

    if (insertedId === undefined) {
      throw new Error(`Failed to upsert exercise: ${seed.code}`);
    }

    idByCode.set(seed.code, insertedId);
  }

  return idByCode;
}

/**
 * Seed the exercise_muscles table with idempotent upserts.
 *
 * @param pool - PostgreSQL connection pool.
 * @param seeds - Exercise-to-muscle mappings to insert or update.
 * @param exerciseIds - Exercise ids keyed by exercise code.
 * @param muscleGroupIds - Muscle group ids keyed by muscle code.
 * @returns Nothing.
 */
async function seedExerciseMuscles(
  pool: DbPool,
  seeds: readonly ExerciseMuscleSeed[],
  exerciseIds: ReadonlyMap<string, string>,
  muscleGroupIds: ReadonlyMap<string, string>,
): Promise<void> {
  for (const seed of seeds) {
    const exerciseId = exerciseIds.get(seed.exerciseCode);
    const muscleGroupId = muscleGroupIds.get(seed.muscleCode);

    if (exerciseId === undefined) {
      throw new Error(
        `Missing exercise seed for mapping: ${seed.exerciseCode}`,
      );
    }

    if (muscleGroupId === undefined) {
      throw new Error(
        `Missing muscle group seed for mapping: ${seed.muscleCode}`,
      );
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

/**
 * Run the dictionary seed workflow inside a single transaction.
 *
 * @returns Nothing.
 */
async function main(): Promise<void> {
  const options = parseSeedOptions(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const pool = createDbPool();

  try {
    await pool.query("BEGIN");

    const muscleGroupIds = await seedMuscleGroups(
      pool,
      muscleGroupSeeds as readonly MuscleGroupSeed[],
    );
    const exerciseIds = await seedExercises(
      pool,
      exerciseSeeds as readonly ExerciseSeed[],
    );

    await seedExerciseMuscles(
      pool,
      exerciseMuscleSeeds as readonly ExerciseMuscleSeed[],
      exerciseIds,
      muscleGroupIds,
    );

    await pool.query("COMMIT");

    console.log(
      `Seed completed: ${muscleGroupSeeds.length} muscle groups, ${exerciseSeeds.length} exercises, ${exerciseMuscleSeeds.length} exercise-muscle mappings.`,
    );
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error("Seed failed.");
  console.error(error);
  process.exitCode = 1;
});
