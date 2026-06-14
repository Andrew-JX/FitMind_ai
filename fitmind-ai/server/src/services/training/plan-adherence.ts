/** 单个动作的依从状态。 */
export type ExerciseAdherenceStatus = "done" | "partial" | "missed";

export interface PlannedExerciseTarget {
  exerciseName: string;
  sets: number;
}

export interface PerformedExerciseVolume {
  exerciseName: string;
  setCount: number;
}

export interface ExerciseAdherence {
  exercise_name: string;
  planned_sets: number;
  performed_sets: number;
  status: ExerciseAdherenceStatus;
  set_completion_ratio: number;
}

export interface PlanAdherenceSummary {
  planned_exercise_count: number;
  trained_exercise_count: number;
  extra_exercise_count: number;
  exercise_adherence_ratio: number;
  set_adherence_ratio: number;
  exercises: ExerciseAdherence[];
}

/** 比例保留的小数位（百分比展示用，避免浮点尾巴）。 */
const RATIO_DECIMALS = 4;

/**
 * 确定性计算计划依从度：把计划里的目标动作与该周期内实际练过的动作对比。
 *
 * 纯函数、无 LLM、无 DB、可单测。动作名按 trim + lowercase 匹配。完成度比例用
 * min(performed, planned) 计算，避免超量练习把比例推过 100%。
 *
 * @param input - 计划目标动作 + 周期内实际训练的动作容量
 * @returns 逐动作 + 汇总的依从度
 */
export function computePlanAdherence(input: {
  plannedExercises: PlannedExerciseTarget[];
  performedExercises: PerformedExerciseVolume[];
}): PlanAdherenceSummary {
  const performedByName = new Map<string, number>();
  for (const performed of input.performedExercises) {
    const key = normalizeName(performed.exerciseName);
    performedByName.set(
      key,
      (performedByName.get(key) ?? 0) + Math.max(0, performed.setCount),
    );
  }

  const matchedKeys = new Set<string>();
  let plannedSetTotal = 0;
  let completedSetTotal = 0;
  let trainedExerciseCount = 0;

  const exercises: ExerciseAdherence[] = input.plannedExercises.map((planned) => {
    const key = normalizeName(planned.exerciseName);
    matchedKeys.add(key);

    const plannedSets = Math.max(0, planned.sets);
    const performedSets = performedByName.get(key) ?? 0;
    const completedSets = Math.min(performedSets, plannedSets);

    plannedSetTotal += plannedSets;
    completedSetTotal += completedSets;

    if (performedSets > 0) {
      trainedExerciseCount += 1;
    }

    return {
      exercise_name: planned.exerciseName,
      planned_sets: plannedSets,
      performed_sets: performedSets,
      status: resolveStatus(performedSets, plannedSets),
      set_completion_ratio: ratio(completedSets, plannedSets),
    };
  });

  const extraExerciseCount = [...performedByName.keys()].filter(
    (key) => !matchedKeys.has(key),
  ).length;

  return {
    planned_exercise_count: input.plannedExercises.length,
    trained_exercise_count: trainedExerciseCount,
    extra_exercise_count: extraExerciseCount,
    exercise_adherence_ratio: ratio(
      trainedExerciseCount,
      input.plannedExercises.length,
    ),
    set_adherence_ratio: ratio(completedSetTotal, plannedSetTotal),
    exercises,
  };
}

function resolveStatus(
  performedSets: number,
  plannedSets: number,
): ExerciseAdherenceStatus {
  if (performedSets <= 0) {
    return "missed";
  }

  if (performedSets >= plannedSets) {
    return "done";
  }

  return "partial";
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  const value = numerator / denominator;
  const factor = 10 ** RATIO_DECIMALS;

  return Math.round(value * factor) / factor;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}
