import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createDbPool } from "../src/db/pool.js";
import { hashPassword } from "../src/services/auth/password.js";

interface ExerciseLookupRow {
  id: string;
  code: string;
  name_en: string;
}

interface DemoExerciseMap {
  bench: ExerciseLookupRow;
  inclineBench: ExerciseLookupRow;
  row: ExerciseLookupRow;
  pulldown: ExerciseLookupRow;
  squat: ExerciseLookupRow;
}

interface DemoWorkoutInput {
  performedAt: string;
  durationMinutes: number;
  notes: string;
  sets: Array<{
    exerciseId: string;
    reps: number;
    weightKg: number;
    rpe: number;
    isWarmup?: boolean;
    notes?: string;
  }>;
}

interface DemoSavedInsightInput {
  insightType: "weekly_report" | "plateau_diagnosis" | "next_week_plan";
  title: string;
  summary: string;
  evidence: {
    workoutCount: number;
    setCount: number;
    toolNames: string[];
  };
  sources: Array<{
    title: string;
    category: string;
  }>;
  limitations: string[];
}

const DEMO_USER_EMAIL = "assistant-demo@fitmind.local";
const DEMO_USER_DISPLAY_NAME = "Assistant Demo User";
const DEMO_USER_PASSWORD = "Passw0rd!";

async function loadEnvFile(filePath: string): Promise<void> {
  await access(filePath);

  const source = await readFile(filePath, "utf8");

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith("#")) {
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

function createIsoDateDaysAgo(daysAgo: number, hour: number): string {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString();
}

async function loadDemoExercises(userId: string): Promise<DemoExerciseMap> {
  const pool = createDbPool();

  try {
    const result = await pool.query<ExerciseLookupRow>(
      `
        SELECT id, code, name_en
        FROM exercises
        WHERE code = ANY($1::text[])
      `,
      [
        [
          "bench_press_barbell",
          "incline_bench_press_barbell",
          "barbell_row",
          "lat_pulldown_cable",
          "barbell_back_squat",
        ],
      ],
    );

    const byCode = new Map(result.rows.map((row) => [row.code, row]));
    const bench = byCode.get("bench_press_barbell");
    const inclineBench = byCode.get("incline_bench_press_barbell");
    const row = byCode.get("barbell_row");
    const pulldown = byCode.get("lat_pulldown_cable");
    const squat = byCode.get("barbell_back_squat");

    if (!bench || !inclineBench || !row || !pulldown || !squat) {
      throw new Error(
        `Assistant demo seed requires dictionary seed data before workout seeding. userId=${userId}`,
      );
    }

    return {
      bench,
      inclineBench,
      row,
      pulldown,
      squat,
    };
  } finally {
    await pool.end();
  }
}

function buildDemoWorkouts(exercises: DemoExerciseMap): DemoWorkoutInput[] {
  return [
    {
      performedAt: createIsoDateDaysAgo(24, 9),
      durationMinutes: 52,
      notes: "Demo push day baseline",
      sets: [
        {
          exerciseId: exercises.bench.id,
          reps: 8,
          weightKg: 72.5,
          rpe: 7.5,
          notes: "bench volume set 1",
        },
        {
          exerciseId: exercises.bench.id,
          reps: 8,
          weightKg: 75,
          rpe: 8,
          notes: "bench volume set 2",
        },
        {
          exerciseId: exercises.inclineBench.id,
          reps: 10,
          weightKg: 55,
          rpe: 8,
          notes: "incline support work",
        },
      ],
    },
    {
      performedAt: createIsoDateDaysAgo(18, 10),
      durationMinutes: 48,
      notes: "Demo back touch point",
      sets: [
        {
          exerciseId: exercises.row.id,
          reps: 10,
          weightKg: 60,
          rpe: 8,
          notes: "row exposure",
        },
        {
          exerciseId: exercises.pulldown.id,
          reps: 12,
          weightKg: 50,
          rpe: 7.5,
          notes: "lat pulldown exposure",
        },
      ],
    },
    {
      performedAt: createIsoDateDaysAgo(12, 8),
      durationMinutes: 42,
      notes: "Demo chest progression",
      sets: [
        {
          exerciseId: exercises.bench.id,
          reps: 6,
          weightKg: 82.5,
          rpe: 8.5,
          notes: "bench intensity set 1",
        },
        {
          exerciseId: exercises.bench.id,
          reps: 5,
          weightKg: 85,
          rpe: 9,
          notes: "bench intensity set 2",
        },
      ],
    },
    {
      performedAt: createIsoDateDaysAgo(7, 11),
      durationMinutes: 46,
      notes: "Demo light leg touch",
      sets: [
        {
          exerciseId: exercises.squat.id,
          reps: 5,
          weightKg: 90,
          rpe: 7.5,
          notes: "single leg anchor set 1",
        },
        {
          exerciseId: exercises.squat.id,
          reps: 5,
          weightKg: 95,
          rpe: 8,
          notes: "single leg anchor set 2",
        },
      ],
    },
    {
      performedAt: createIsoDateDaysAgo(2, 9),
      durationMinutes: 50,
      notes: "Demo recent chest day",
      sets: [
        {
          exerciseId: exercises.bench.id,
          reps: 5,
          weightKg: 90,
          rpe: 8.5,
          notes: "recent bench top set",
        },
        {
          exerciseId: exercises.bench.id,
          reps: 4,
          weightKg: 92.5,
          rpe: 9,
          notes: "recent bench heavy set",
        },
        {
          exerciseId: exercises.inclineBench.id,
          reps: 8,
          weightKg: 60,
          rpe: 8,
          notes: "recent incline follow-up",
        },
      ],
    },
  ];
}

function buildShareText(input: DemoSavedInsightInput): string {
  const sourceLines =
    input.sources.length === 0
      ? ["- 无"]
      : input.sources.map((source) => `- ${source.title} (${source.category})`);
  const limitationLines =
    input.limitations.length === 0
      ? ["- 无"]
      : input.limitations.map((limitation) => `- ${limitation}`);

  return [
    `FitMind Insight: ${input.title}`,
    `类型：${formatDemoInsightType(input.insightType)}`,
    "",
    "总结：",
    input.summary,
    "",
    "Evidence:",
    `- 训练：${input.evidence.workoutCount}`,
    `- 组数：${input.evidence.setCount}`,
    `- 工具：${input.evidence.toolNames.join("、") || "无"}`,
    "",
    "Sources:",
    ...sourceLines,
    "",
    "限制：",
    ...limitationLines,
  ].join("\n");
}

function formatDemoInsightType(
  insightType: DemoSavedInsightInput["insightType"],
): string {
  switch (insightType) {
    case "weekly_report":
      return "本周训练报告";
    case "plateau_diagnosis":
      return "平台期诊断";
    case "next_week_plan":
      return "下周训练草案";
  }
}

function buildDemoSavedInsights(): DemoSavedInsightInput[] {
  return [
    {
      insightType: "weekly_report",
      title: "Demo 本周训练报告",
      summary:
        "Demo 数据展示了 5 次训练：胸推动作占比较高，同时保留了轻量腿部记录和足够的组数来解释频率与分布。",
      evidence: {
        workoutCount: 5,
        setCount: 12,
        toolNames: ["get_weekly_training_report"],
      },
      sources: [],
      limitations: ["这是基于 demo 聚合训练数据生成的保存快照。"],
    },
    {
      insightType: "plateau_diagnosis",
      title: "Demo 卧推平台期诊断",
      summary:
        "Demo 卧推数据接近停滞，所以诊断会先比较频率、有效组数、重量推进和恢复，再考虑是否调整训练量。",
      evidence: {
        workoutCount: 3,
        setCount: 6,
        toolNames: ["get_exercise_progress"],
      },
      sources: [
        {
          title: "渐进超负荷与平台期检查",
          category: "training_principles",
        },
        {
          title: "训练量参考区间",
          category: "programming",
        },
      ],
      limitations: ["这是训练数据诊断，不是医疗建议或专业教练处方。"],
    },
    {
      insightType: "next_week_plan",
      title: "Demo 下周训练草案",
      summary:
        "下周草案会保持接近当前频率，避免胸推动作大幅加量，并小幅补一点拉类或腿部训练关注。",
      evidence: {
        workoutCount: 5,
        setCount: 12,
        toolNames: ["get_weekly_training_report"],
      },
      sources: [
        {
          title: "推进时一次只调整一个变量",
          category: "programming",
        },
      ],
      limitations: [
        "这只是训练草案，不是医疗建议或专业教练处方。",
        "草案只反映已记录训练和通用训练知识。",
      ],
    },
  ];
}

async function upsertDemoUser(): Promise<{ id: string; email: string }> {
  const pool = createDbPool();

  try {
    const passwordHash = await hashPassword(DEMO_USER_PASSWORD);
    const result = await pool.query<{ id: string; email: string }>(
      `
        INSERT INTO users (email, password_hash, display_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (email)
        DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          display_name = EXCLUDED.display_name,
          updated_at = now()
        RETURNING id, email
      `,
      [DEMO_USER_EMAIL, passwordHash, DEMO_USER_DISPLAY_NAME],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Assistant demo seed could not upsert demo user.");
    }

    return row;
  } finally {
    await pool.end();
  }
}

async function replaceDemoTrainingData(
  userId: string,
  workouts: DemoWorkoutInput[],
): Promise<void> {
  const pool = createDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        DELETE FROM tool_call_logs
        WHERE user_id = $1
      `,
      [userId],
    );

    await client.query(
      `
        DELETE FROM assistant_saved_insights
        WHERE user_id = $1
      `,
      [userId],
    );

    await client.query(
      `
        DELETE FROM chat_sessions
        WHERE user_id = $1
      `,
      [userId],
    );

    await client.query(
      `
        DELETE FROM workouts
        WHERE user_id = $1
      `,
      [userId],
    );

    for (const workout of workouts) {
      const workoutResult = await client.query<{ id: string }>(
        `
          INSERT INTO workouts (user_id, performed_at, duration_minutes, notes)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [userId, workout.performedAt, workout.durationMinutes, workout.notes],
      );

      const workoutId = workoutResult.rows[0]?.id;

      if (!workoutId) {
        throw new Error("Assistant demo seed failed to insert workout.");
      }

      for (const [index, set] of workout.sets.entries()) {
        await client.query(
          `
            INSERT INTO sets (
              workout_id,
              exercise_id,
              set_index,
              reps,
              weight_kg,
              rpe,
              is_warmup,
              notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            workoutId,
            set.exerciseId,
            index + 1,
            set.reps,
            set.weightKg,
            set.rpe,
            set.isWarmup ?? false,
            set.notes ?? null,
          ],
        );
      }
    }

    for (const insight of buildDemoSavedInsights()) {
      const structuredSnapshot = {
        message_text: insight.summary,
        intent: insight.insightType,
        evidence: {
          workout_count: insight.evidence.workoutCount,
          set_count: insight.evidence.setCount,
          tool_names: insight.evidence.toolNames,
          calculation_rule_count: 2,
        },
        sources: insight.sources,
        limitations: insight.limitations,
        structured_output: {
          intent: insight.insightType,
          answer_summary: insight.summary,
          answer_bullets: [],
        },
      };

      await client.query(
        `
          INSERT INTO assistant_saved_insights (
            user_id,
            message_id,
            insight_type,
            title,
            summary,
            structured_snapshot,
            share_text
          )
          VALUES ($1, NULL, $2, $3, $4, $5::jsonb, $6)
        `,
        [
          userId,
          insight.insightType,
          insight.title,
          insight.summary,
          JSON.stringify(structuredSnapshot),
          buildShareText(insight),
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(scriptDir, "..", ".env.local");
  await loadEnvFile(envPath);

  const demoUser = await upsertDemoUser();
  const exercises = await loadDemoExercises(demoUser.id);
  const workouts = buildDemoWorkouts(exercises);
  await replaceDemoTrainingData(demoUser.id, workouts);

  console.log("Assistant demo seed completed.");
  console.log(`email=${demoUser.email}`);
  console.log(`password=${DEMO_USER_PASSWORD}`);
  console.log(
    `workouts=${workouts.length} focus=${exercises.bench.name_en} back=${exercises.row.name_en}/${exercises.pulldown.name_en}`,
  );
}

void main().catch((error: unknown) => {
  console.error("Assistant demo seed failed.");
  console.error(error);
  process.exitCode = 1;
});
