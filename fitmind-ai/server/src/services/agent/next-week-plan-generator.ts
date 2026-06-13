import type {
  NextWeekPlanDraft,
  PlannedExercise,
  ProgressionMode,
} from "./react-planner-types.js";

/** 工作组次数下限（增肌区间下沿）。 */
const WORKING_REP_MIN = 6;
/** 工作组次数上限（增肌区间上沿）。 */
const WORKING_REP_MAX = 10;
/** 目标重量取估算 1RM 的该比例（6~10 次区间的保守起始强度）。 */
const TARGET_INTENSITY_PCT_OF_1RM = 0.72;
/** 目标重量取整到该公斤数（贴近实际配重片）。 */
const WEIGHT_ROUNDING_KG = 2.5;
/** 草案最多排几个动作（保持精简、聚焦）。 */
const MAX_PLANNED_EXERCISES = 4;
/** 不同进展策略下每个动作的工作组数。 */
const SETS_BY_MODE: Record<ProgressionMode, number> = {
  consolidate: 3,
  maintain: 3,
  add_frequency: 4,
};

/** 生成器输入：从 weekly report / exercise progress 提取后的干净结构（不碰原始工具对象）。 */
export interface NextWeekPlanGeneratorInput {
  progressionMode: ProgressionMode;
  weakArea: string | null;
  topExercises: Array<{ exerciseName: string; setCount: number }>;
  focusExercise: {
    exerciseName: string;
    estimated1RmKg: number | null;
    maxWeightKg: number | null;
  } | null;
}

/**
 * 由训练容量 + 动作进展确定性生成一份可执行的下周训练草案（动作 × 组 × 次 × 目标重量）。
 *
 * 纯函数、无 LLM、无 DB、可单测。目标重量只在有真实重量基线（估算 1RM / 近期最高重量）时给出，
 * 否则保持 null 并提示"沿用上次重量"，绝不编造数字。所有阈值用命名常量。
 *
 * @param input - 进展策略、弱项、top 动作、可选 focus 动作的重量基线
 * @returns 结构化下周草案（strategy + exercises + notes）
 *
 * @remarks
 * 草案是规划建议而非处方：目标重量 = 取整(估算 1RM × {@link TARGET_INTENSITY_PCT_OF_1RM})。
 */
export function generateNextWeekPlan(
  input: NextWeekPlanGeneratorInput,
): NextWeekPlanDraft {
  const sets = SETS_BY_MODE[input.progressionMode];
  const exercises: PlannedExercise[] = [];
  const seen = new Set<string>();

  if (input.focusExercise) {
    exercises.push(buildFocusExercise(input.focusExercise, sets));
    seen.add(input.focusExercise.exerciseName);
  }

  for (const topExercise of input.topExercises) {
    if (exercises.length >= MAX_PLANNED_EXERCISES) {
      break;
    }

    if (seen.has(topExercise.exerciseName)) {
      continue;
    }

    seen.add(topExercise.exerciseName);
    exercises.push({
      exercise_name: topExercise.exerciseName,
      sets,
      rep_min: WORKING_REP_MIN,
      rep_max: WORKING_REP_MAX,
      target_weight_kg: null,
      basis: "无单独 1RM 基线，沿用上次训练重量并小幅保守渐进。",
    });
  }

  return {
    strategy: input.progressionMode,
    exercises,
    notes: buildNotes(input),
  };
}

function buildFocusExercise(
  focus: NonNullable<NextWeekPlanGeneratorInput["focusExercise"]>,
  sets: number,
): PlannedExercise {
  if (focus.estimated1RmKg !== null) {
    const targetWeight = roundToPlate(
      focus.estimated1RmKg * TARGET_INTENSITY_PCT_OF_1RM,
    );

    return {
      exercise_name: focus.exerciseName,
      sets,
      rep_min: WORKING_REP_MIN,
      rep_max: WORKING_REP_MAX,
      target_weight_kg: targetWeight,
      basis: `基于估算 1RM ${focus.estimated1RmKg} kg 的 ${Math.round(
        TARGET_INTENSITY_PCT_OF_1RM * 100,
      )}%（${WORKING_REP_MIN}~${WORKING_REP_MAX} 次区间起始重量）。`,
    };
  }

  if (focus.maxWeightKg !== null) {
    return {
      exercise_name: focus.exerciseName,
      sets,
      rep_min: WORKING_REP_MIN,
      rep_max: WORKING_REP_MAX,
      target_weight_kg: roundToPlate(focus.maxWeightKg),
      basis: "无估算 1RM，以近期最高训练重量为基线，保持后再小幅渐进。",
    };
  }

  return {
    exercise_name: focus.exerciseName,
    sets,
    rep_min: WORKING_REP_MIN,
    rep_max: WORKING_REP_MAX,
    target_weight_kg: null,
    basis: "暂无重量基线，沿用上次训练重量并小幅保守渐进。",
  };
}

function buildNotes(input: NextWeekPlanGeneratorInput): string[] {
  const notes = [describeStrategy(input.progressionMode), "一次只改一个变量（组数 / 重量 / 次数 / 休息）。"];

  if (input.weakArea) {
    notes.push(`弱项 ${input.weakArea}：可加一点可控的针对性补充，不必加大强度。`);
  }

  notes.push("这是规划草案而非处方；出现疼痛、麻木或异常疲劳不要硬按草案执行。");

  return notes;
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

function roundToPlate(value: number): number {
  return Math.round(value / WEIGHT_ROUNDING_KG) * WEIGHT_ROUNDING_KG;
}
