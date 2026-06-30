import type {
  NextWeekPlanDraft,
  PlanAdherenceContext,
  PlanAdherenceExerciseContext,
  PlanGoal,
  PlanProfileContext,
  PlannedExercise,
  ProgressionMode,
} from "./react-planner-types.js";

/** 每个训练目标对应的次数区间 + 目标强度（取估算 1RM 的比例）。 */
interface GoalScheme {
  repMin: number;
  repMax: number;
  intensityPctOf1Rm: number;
}

/** 目标 → 次数/强度方案。无档案时退回 {@link DEFAULT_GOAL}（保持历史行为）。 */
const GOAL_SCHEMES: Record<PlanGoal, GoalScheme> = {
  strength: { repMin: 3, repMax: 6, intensityPctOf1Rm: 0.85 },
  hypertrophy: { repMin: 6, repMax: 10, intensityPctOf1Rm: 0.72 },
  endurance: { repMin: 12, repMax: 15, intensityPctOf1Rm: 0.6 },
  general_fitness: { repMin: 8, repMax: 12, intensityPctOf1Rm: 0.68 },
};
/** 无运动员档案时的默认目标（增肌区间，与档案功能上线前的行为一致）。 */
const DEFAULT_GOAL: PlanGoal = "hypertrophy";
/** 目标重量取整到该公斤数（贴近实际配重片）。 */
const WEIGHT_ROUNDING_KG = 2.5;
/** 草案最多排几个动作（保持精简、聚焦）。 */
const MAX_PLANNED_EXERCISES = 4;
/** Set adherence at or above this keeps the original progression mode. */
const HIGH_ADHERENCE_RATIO = 0.8;
/** Set adherence below this consolidates the next plan. */
const LOW_ADHERENCE_RATIO = 0.5;
/** 不同进展策略下每个动作的工作组数。 */
const SETS_BY_MODE: Record<ProgressionMode, number> = {
  consolidate: 3,
  maintain: 3,
  add_frequency: 4,
};

/** 单个动作的重量基线（来自周报 top_exercises 或单动作进展），都可能缺失。 */
interface ExerciseWeightBaseline {
  estimated1RmKg: number | null;
  maxWeightKg: number | null;
}

/** 生成器输入：从 weekly report / exercise progress (+ 运动员档案) 提取后的干净结构。 */
export interface NextWeekPlanGeneratorInput {
  progressionMode: ProgressionMode;
  weakArea: string | null;
  topExercises: Array<
    { exerciseName: string; setCount: number } & ExerciseWeightBaseline
  >;
  focusExercise: ({ exerciseName: string } & ExerciseWeightBaseline) | null;
  profile?: PlanProfileContext | null | undefined;
  planAdherence?: PlanAdherenceContext | null | undefined;
}

/**
 * 由训练容量 + 动作进展 (+ 运动员档案) 确定性生成一份可执行的下周训练草案
 * （动作 × 组 × 次 × 目标重量）。
 *
 * 纯函数、无 LLM、无 DB、可单测。次数区间与目标强度由档案的训练目标决定（无档案退回增肌方案）；
 * 伤病约束 / 每周天数注入安全与分配提示。目标重量只在有真实重量基线（估算 1RM / 近期最高重量）时
 * 给出，否则保持 null，绝不编造数字。所有阈值用命名常量。
 *
 * @param input - 进展策略、弱项、top 动作、可选 focus 动作的重量基线、可选档案
 * @returns 结构化下周草案（strategy + exercises + notes）
 *
 * @remarks
 * 目标重量 = 取整(估算 1RM × 目标对应强度比例)。
 */
export function generateNextWeekPlan(
  input: NextWeekPlanGeneratorInput,
): NextWeekPlanDraft {
  const scheme = GOAL_SCHEMES[input.profile?.goal ?? DEFAULT_GOAL];
  const adjustedMode = resolveAdherenceAdjustedMode(
    input.progressionMode,
    input.planAdherence ?? null,
  );
  const sets = SETS_BY_MODE[adjustedMode];
  const exercises: PlannedExercise[] = [];
  const seen = new Set<string>();
  const adherenceByName = buildAdherenceMap(input.planAdherence ?? null);

  if (input.focusExercise) {
    const adherence = adherenceByName.get(
      normalizeName(input.focusExercise.exerciseName),
    );
    exercises.push(
      applyExerciseAdherence(
        buildPlannedExercise(
          input.focusExercise.exerciseName,
          input.focusExercise,
          sets,
          scheme,
        ),
        adherence,
      ),
    );
    seen.add(normalizeName(input.focusExercise.exerciseName));
  }

  for (const previous of getCarryOverExercises(input.planAdherence ?? null)) {
    if (exercises.length >= MAX_PLANNED_EXERCISES) {
      break;
    }

    const key = normalizeName(previous.exerciseName);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    exercises.push(buildCarryOverExercise(previous, sets, scheme));
  }

  for (const topExercise of input.topExercises) {
    if (exercises.length >= MAX_PLANNED_EXERCISES) {
      break;
    }

    const key = normalizeName(topExercise.exerciseName);
    if (seen.has(key)) {
      continue;
    }

    const adherence = adherenceByName.get(key);
    seen.add(key);
    exercises.push(
      applyExerciseAdherence(
        buildPlannedExercise(
          topExercise.exerciseName,
          topExercise,
          sets,
          scheme,
        ),
        adherence,
      ),
    );
  }

  return {
    strategy: adjustedMode,
    exercises,
    notes: buildNotes(input, adjustedMode),
  };
}

/**
 * 由一个动作的重量基线（估算 1RM / 近期最高重量）确定性推导一条计划动作。
 *
 * focus 与非 focus 动作共用这一套规则：优先用估算 1RM × 目标强度比例算起始重量，
 * 退化到近期最高训练重量，两者都没有（含纯自重动作的 0 基线）时保持
 * target_weight_kg=null 并提示"沿用上次重量"，绝不编造数字。
 *
 * @param exerciseName - 动作名
 * @param baseline - 该动作的估算 1RM 与近期最高重量（可缺失）
 * @param sets - 工作组数（由进展策略决定）
 * @param scheme - 训练目标对应的次数区间与目标强度
 * @returns 一条结构化计划动作
 */
function buildPlannedExercise(
  exerciseName: string,
  baseline: ExerciseWeightBaseline,
  sets: number,
  scheme: GoalScheme,
): PlannedExercise {
  const base = {
    exercise_name: exerciseName,
    sets,
    rep_min: scheme.repMin,
    rep_max: scheme.repMax,
  };

  if (baseline.estimated1RmKg !== null && baseline.estimated1RmKg > 0) {
    return {
      ...base,
      // 目标重量用未取整的 1RM 算，避免复合误差；只在 basis 文案里把 1RM 显示取整。
      target_weight_kg: roundToPlate(
        baseline.estimated1RmKg * scheme.intensityPctOf1Rm,
      ),
      basis: `基于估算 1RM ${formatOneRmForDisplay(baseline.estimated1RmKg)} kg 的 ${Math.round(
        scheme.intensityPctOf1Rm * 100,
      )}%（${scheme.repMin}~${scheme.repMax} 次区间起始重量）。`,
    };
  }

  if (baseline.maxWeightKg !== null && baseline.maxWeightKg > 0) {
    return {
      ...base,
      target_weight_kg: roundToPlate(baseline.maxWeightKg),
      basis: "无估算 1RM，以近期最高训练重量为基线，保持后再小幅渐进。",
    };
  }

  return {
    ...base,
    target_weight_kg: null,
    basis: "暂无重量基线，沿用上次训练重量并小幅保守渐进。",
  };
}

function buildCarryOverExercise(
  previous: PlanAdherenceExerciseContext,
  baseSets: number,
  scheme: GoalScheme,
): PlannedExercise {
  const sets = resolveAdherenceAdjustedSets(baseSets, previous);

  return {
    exercise_name: previous.exerciseName,
    sets,
    rep_min: scheme.repMin,
    rep_max: scheme.repMax,
    target_weight_kg: previous.targetWeightKg,
    basis: buildAdherenceBasis(
      previous,
      previous.targetWeightKg === null
        ? "上次没有可靠重量目标，本次继续不编造重量。"
        : "本次沿用上一计划重量上限，先把动作完成度补回来。",
    ),
  };
}

function applyExerciseAdherence(
  exercise: PlannedExercise,
  adherence: PlanAdherenceExerciseContext | undefined,
): PlannedExercise {
  if (adherence === undefined || adherence.status === "done") {
    return exercise;
  }

  const adjustedSets = resolveAdherenceAdjustedSets(exercise.sets, adherence);
  const cappedWeight = capTargetWeight(
    exercise.target_weight_kg,
    adherence.targetWeightKg,
  );

  return {
    ...exercise,
    sets: adjustedSets,
    target_weight_kg: cappedWeight,
    basis: buildAdherenceBasis(
      adherence,
      cappedWeight === null
        ? "上次没有可靠重量目标，本次继续不编造重量。"
        : "本次不高于上一计划重量，先巩固完成度。",
    ),
  };
}

function buildAdherenceBasis(
  adherence: PlanAdherenceExerciseContext,
  guidance: string,
): string {
  const statusCopy = adherence.status === "partial" ? "部分完成" : "未完成";

  return `上次计划 ${statusCopy}：完成 ${adherence.performedSets}/${adherence.plannedSets} 组。${guidance}`;
}

function resolveAdherenceAdjustedSets(
  baseSets: number,
  adherence: PlanAdherenceExerciseContext,
): number {
  if (adherence.status === "missed") {
    return Math.max(1, Math.min(baseSets, adherence.plannedSets) - 1);
  }

  if (adherence.status === "partial") {
    return Math.max(1, Math.min(baseSets, adherence.plannedSets));
  }

  return baseSets;
}

function capTargetWeight(
  targetWeightKg: number | null,
  previousTargetWeightKg: number | null,
): number | null {
  if (previousTargetWeightKg === null) {
    return null;
  }

  if (targetWeightKg === null) {
    return previousTargetWeightKg;
  }

  return Math.min(targetWeightKg, previousTargetWeightKg);
}

function resolveAdherenceAdjustedMode(
  mode: ProgressionMode,
  adherence: PlanAdherenceContext | null,
): ProgressionMode {
  if (
    adherence === null ||
    adherence.setAdherenceRatio >= HIGH_ADHERENCE_RATIO
  ) {
    return mode;
  }

  if (adherence.setAdherenceRatio < LOW_ADHERENCE_RATIO) {
    return "consolidate";
  }

  return mode === "add_frequency" ? "maintain" : mode;
}

function getCarryOverExercises(
  adherence: PlanAdherenceContext | null,
): PlanAdherenceExerciseContext[] {
  if (adherence === null) {
    return [];
  }

  return adherence.exercises.filter(
    (exercise) => exercise.status === "partial" || exercise.status === "missed",
  );
}

function buildAdherenceMap(
  adherence: PlanAdherenceContext | null,
): Map<string, PlanAdherenceExerciseContext> {
  const map = new Map<string, PlanAdherenceExerciseContext>();

  if (adherence === null) {
    return map;
  }

  for (const exercise of adherence.exercises) {
    map.set(normalizeName(exercise.exerciseName), exercise);
  }

  return map;
}

function buildNotes(
  input: NextWeekPlanGeneratorInput,
  adjustedMode: ProgressionMode,
): string[] {
  const notes = [
    describeStrategy(adjustedMode),
    "一次只改一个变量（组数 / 重量 / 次数 / 休息）。",
  ];

  if (input.profile) {
    notes.push(describeGoal(input.profile.goal));
    notes.push(
      `目标每周 ${input.profile.weeklyDays} 天：把这些动作分配到各训练日，避免单日堆叠。`,
    );

    for (const injury of input.profile.injuryConstraints) {
      notes.push(
        `因 ${injury} 约束：相关动作降低负荷 / 控制活动范围，必要时换更安全的替代动作。`,
      );
    }
  }

  if (input.weakArea) {
    notes.push(
      `弱项 ${input.weakArea}：可加一点可控的针对性补充，不必加大强度。`,
    );
  }

  notes.push(
    "这是规划草案而非处方；出现疼痛、麻木或异常疲劳不要硬按草案执行。",
  );

  return notes;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function describeStrategy(mode: ProgressionMode): string {
  switch (mode) {
    case "consolidate":
      return "近期频率偏高：下周以巩固和控制疲劳为主，保持组数、不大幅加量。";
    case "add_frequency":
      return "近期频率偏低：下周可保守地多排一组或补一次训练。";
    case "maintain":
      return "频率适中：下周维持基线，只做小幅优化。";
  }
}

function describeGoal(goal: PlanGoal): string {
  switch (goal) {
    case "strength":
      return "目标力量：次数偏低、强度偏高，组间充分休息。";
    case "hypertrophy":
      return "目标增肌：中等次数与强度，关注总有效组数。";
    case "endurance":
      return "目标耐力：次数偏高、强度偏低，缩短组间休息。";
    case "general_fitness":
      return "目标综合健身：中等次数区间，兼顾力量与耐力。";
  }
}

function roundToPlate(value: number): number {
  return Math.round(value / WEIGHT_ROUNDING_KG) * WEIGHT_ROUNDING_KG;
}

/**
 * 把估算 1RM 取整到 1 位小数用于 basis 文案展示（去掉浮点尾巴，如 110.8333… → 110.8）。
 *
 * @param value - 原始估算 1RM（kg）
 * @returns 适合展示的数值（整数则不带小数点）
 */
function formatOneRmForDisplay(value: number): number {
  return Math.round(value * 10) / 10;
}
