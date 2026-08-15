import type {
  NextWeekPlanDraft,
  PlanAdherenceContext,
  PlanAdherenceExerciseContext,
  PlanExerciseCatalogItem,
  PlanGoal,
  PlanPreferences,
  PlanProfileContext,
  PlannedExercise,
  PlannedExerciseAlternative,
  PlannedTrainingSession,
  ProgressionMode,
} from "./react-planner-types.js";

interface GoalScheme {
  repMin: number;
  repMax: number;
  intensityPctOf1Rm: number;
  fallbackRestSeconds: number;
}

const GOAL_SCHEMES: Record<PlanGoal, GoalScheme> = {
  strength: {
    repMin: 3,
    repMax: 6,
    intensityPctOf1Rm: 0.85,
    fallbackRestSeconds: 180,
  },
  hypertrophy: {
    repMin: 6,
    repMax: 10,
    intensityPctOf1Rm: 0.72,
    fallbackRestSeconds: 90,
  },
  endurance: {
    repMin: 12,
    repMax: 15,
    intensityPctOf1Rm: 0.6,
    fallbackRestSeconds: 60,
  },
  general_fitness: {
    repMin: 8,
    repMax: 12,
    intensityPctOf1Rm: 0.68,
    fallbackRestSeconds: 90,
  },
};

const DEFAULT_GOAL: PlanGoal = "hypertrophy";
const DEFAULT_WEEKLY_DAYS = 3;
const DEFAULT_SESSION_DURATION_MINUTES = 60;
const WEIGHT_ROUNDING_KG = 2.5;
const MAX_WEEKLY_EXERCISES = 12;
const MIN_WEEKLY_EXERCISES = 4;
const MAX_ALTERNATIVES = 3;
const HIGH_ADHERENCE_RATIO = 0.8;
const LOW_ADHERENCE_RATIO = 0.5;
const SETS_BY_MODE: Record<ProgressionMode, number> = {
  consolidate: 3,
  maintain: 3,
  add_frequency: 4,
};

interface ExerciseWeightBaseline {
  estimated1RmKg: number | null;
  maxWeightKg: number | null;
}

interface HistoricalExercise extends ExerciseWeightBaseline {
  exerciseId?: string | undefined;
  exerciseName: string;
}

export interface NextWeekPlanGeneratorInput {
  progressionMode: ProgressionMode;
  weakArea: string | null;
  topExercises: Array<HistoricalExercise & { setCount: number }>;
  focusExercise: HistoricalExercise | null;
  profile?: PlanProfileContext | null | undefined;
  preferences?: PlanPreferences | null | undefined;
  exerciseCatalog?: PlanExerciseCatalogItem[] | undefined;
  planAdherence?: PlanAdherenceContext | null | undefined;
}

interface CandidateExercise {
  baseline: ExerciseWeightBaseline;
  meta: PlanExerciseCatalogItem | null;
  name: string;
  previousAdherence?: PlanAdherenceExerciseContext | undefined;
}

/** Build a deterministic, constraint-filtered flexible training-day plan. */
export function generateNextWeekPlan(
  input: NextWeekPlanGeneratorInput,
): NextWeekPlanDraft {
  const goal = input.profile?.goal ?? DEFAULT_GOAL;
  const scheme = GOAL_SCHEMES[goal];
  const settings = resolvePlanSettings(
    input.profile ?? null,
    input.preferences,
  );
  const requestedMode =
    input.preferences?.readiness === "fatigued"
      ? "consolidate"
      : input.progressionMode;
  const adjustedMode = resolveAdherenceAdjustedMode(
    requestedMode,
    input.planAdherence ?? null,
  );
  const baseSets = SETS_BY_MODE[adjustedMode];
  const rawCatalog = input.exerciseCatalog ?? [];
  const allowedCatalog = rawCatalog.filter((exercise) =>
    isExerciseAllowed(exercise, settings.availableEquipment, settings.injuries),
  );
  const catalogIsAuthoritative = rawCatalog.length > 0;
  const catalogById = new Map(
    rawCatalog.map((exercise) => [exercise.exerciseId, exercise]),
  );
  const catalogByName = new Map<string, PlanExerciseCatalogItem>();

  for (const exercise of rawCatalog) {
    catalogByName.set(normalizeName(exercise.exerciseName), exercise);
  }

  const adherenceByName = buildAdherenceMap(input.planAdherence ?? null);
  const candidates: CandidateExercise[] = [];
  const seen = new Set<string>();
  const desiredExerciseCount = Math.min(
    MAX_WEEKLY_EXERCISES,
    Math.max(
      MIN_WEEKLY_EXERCISES,
      settings.weeklyDays *
        exercisesPerSession(settings.sessionDurationMinutes),
    ),
  );

  const addCandidate = (
    historical: HistoricalExercise,
    previousAdherence?: PlanAdherenceExerciseContext,
  ) => {
    if (candidates.length >= desiredExerciseCount) return;

    const meta =
      (historical.exerciseId
        ? catalogById.get(historical.exerciseId)
        : undefined) ??
      catalogByName.get(normalizeName(historical.exerciseName));
    const key = normalizeName(meta?.exerciseName ?? historical.exerciseName);

    if (seen.has(key)) return;
    if (
      catalogIsAuthoritative &&
      (meta === undefined ||
        !isExerciseAllowed(
          meta,
          settings.availableEquipment,
          settings.injuries,
        ))
    ) {
      return;
    }

    seen.add(key);
    candidates.push({
      baseline: historical,
      meta: meta ?? null,
      name: meta?.exerciseName ?? historical.exerciseName,
      previousAdherence,
    });
  };

  if (input.focusExercise) {
    addCandidate(
      input.focusExercise,
      adherenceByName.get(normalizeName(input.focusExercise.exerciseName)),
    );
  }

  for (const previous of getCarryOverExercises(input.planAdherence ?? null)) {
    addCandidate(
      {
        exerciseName: previous.exerciseName,
        estimated1RmKg: null,
        maxWeightKg: previous.targetWeightKg,
      },
      previous,
    );
  }

  for (const topExercise of input.topExercises) {
    addCandidate(
      topExercise,
      adherenceByName.get(normalizeName(topExercise.exerciseName)),
    );
  }

  const starterExercises = rankStarterExercises(
    allowedCatalog,
    settings.focusAreas,
    input.weakArea,
    candidates.flatMap((candidate) => (candidate.meta ? [candidate.meta] : [])),
  );

  for (const exercise of starterExercises) {
    addCandidate({
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      estimated1RmKg: null,
      maxWeightKg: null,
    });
  }

  let exercises = candidates.map((candidate) => {
    const exercise = buildPlannedExercise(
      candidate.name,
      candidate.baseline,
      baseSets,
      scheme,
      candidate.meta,
    );

    return candidate.previousAdherence
      ? applyExerciseAdherence(exercise, candidate.previousAdherence)
      : exercise;
  });

  const selectedNames = new Set(
    exercises.map((exercise) => normalizeName(exercise.exercise_name)),
  );
  exercises = exercises.map((exercise) => ({
    ...exercise,
    alternatives: buildAlternatives(exercise, allowedCatalog, selectedNames),
  }));

  return {
    strategy: adjustedMode,
    exercises,
    sessions: buildSessions(
      exercises,
      settings.weeklyDays,
      settings.sessionDurationMinutes,
    ),
    notes: buildNotes(
      input,
      adjustedMode,
      settings,
      rawCatalog,
      allowedCatalog,
    ),
  };
}

function resolvePlanSettings(
  profile: PlanProfileContext | null,
  preferences: PlanPreferences | null | undefined,
) {
  return {
    weeklyDays:
      preferences?.weeklyDays ?? profile?.weeklyDays ?? DEFAULT_WEEKLY_DAYS,
    sessionDurationMinutes:
      preferences?.sessionDurationMinutes ?? DEFAULT_SESSION_DURATION_MINUTES,
    availableEquipment:
      preferences?.availableEquipment ?? profile?.availableEquipment ?? [],
    focusAreas: preferences?.focusAreas ?? [],
    injuries: profile?.injuryConstraints ?? [],
  };
}

function exercisesPerSession(durationMinutes: number): number {
  if (durationMinutes <= 30) return 3;
  if (durationMinutes <= 45) return 4;
  if (durationMinutes <= 60) return 5;
  return 6;
}

function isExerciseAllowed(
  exercise: PlanExerciseCatalogItem,
  availableEquipment: string[],
  injuries: string[],
): boolean {
  const equipmentAllowed =
    availableEquipment.length === 0 ||
    exercise.equipment === null ||
    availableEquipment.includes(exercise.equipment);
  return equipmentAllowed && !hasKnownInjuryRisk(exercise, injuries);
}

function hasKnownInjuryRisk(
  exercise: PlanExerciseCatalogItem,
  injuries: string[],
): boolean {
  const injuryText = injuries.join(" ").toLowerCase();
  const pattern = exercise.movementPattern ?? "";
  const muscles = new Set(exercise.primaryMuscles);
  const hasKneeConstraint = /knee|acl|膝/u.test(injuryText);
  const hasShoulderConstraint = /shoulder|rotator|肩/u.test(injuryText);
  const hasBackConstraint = /lower\s*back|lumbar|back pain|腰|脊柱/u.test(
    injuryText,
  );

  if (
    hasKneeConstraint &&
    (["squat", "knee_flexion", "knee_extension"].includes(pattern) ||
      muscles.has("quads"))
  )
    return true;

  if (
    hasShoulderConstraint &&
    ([
      "vertical_push",
      "vertical_pull",
      "shoulder_abduction",
      "shoulder_flexion",
    ].includes(pattern) ||
      muscles.has("shoulders"))
  )
    return true;

  return (
    hasBackConstraint &&
    ["hinge", "spinal_flexion", "rotation"].includes(pattern)
  );
}

function scoreCatalogExercise(
  exercise: PlanExerciseCatalogItem,
  focusAreas: string[],
  weakArea: string | null,
): number {
  const normalizedFocus = new Set(focusAreas.flatMap(expandFocusArea));
  const weakTokens = weakArea ? expandFocusArea(weakArea) : [];
  const focusScore = exercise.primaryMuscles.some((muscle) =>
    normalizedFocus.has(muscle),
  )
    ? 50
    : 0;
  const weakScore = exercise.primaryMuscles.some((muscle) =>
    weakTokens.includes(muscle),
  )
    ? 30
    : 0;
  return focusScore + weakScore;
}

function rankStarterExercises(
  catalog: PlanExerciseCatalogItem[],
  focusAreas: string[],
  weakArea: string | null,
  alreadySelected: PlanExerciseCatalogItem[],
): PlanExerciseCatalogItem[] {
  const remaining = [...catalog];
  const ranked: PlanExerciseCatalogItem[] = [];
  const muscleCounts = new Map<string, number>();
  const patternCounts = new Map<string, number>();

  for (const exercise of alreadySelected) {
    incrementCoverage(exercise, muscleCounts, patternCounts);
  }

  while (remaining.length > 0) {
    remaining.sort((left, right) => {
      const adjustedScore = (exercise: PlanExerciseCatalogItem) => {
        const musclePenalty = exercise.primaryMuscles.reduce(
          (total, muscle) => total + (muscleCounts.get(muscle) ?? 0) * 24,
          0,
        );
        const patternPenalty =
          (patternCounts.get(exercise.movementPattern ?? "unknown") ?? 0) * 12;
        return (
          scoreCatalogExercise(exercise, focusAreas, weakArea) -
          musclePenalty -
          patternPenalty
        );
      };

      return (
        adjustedScore(right) - adjustedScore(left) ||
        left.exerciseName.localeCompare(right.exerciseName)
      );
    });

    const next = remaining.shift();
    if (!next) break;
    ranked.push(next);
    incrementCoverage(next, muscleCounts, patternCounts);
  }

  return ranked;
}

function incrementCoverage(
  exercise: PlanExerciseCatalogItem,
  muscleCounts: Map<string, number>,
  patternCounts: Map<string, number>,
) {
  for (const muscle of exercise.primaryMuscles) {
    muscleCounts.set(muscle, (muscleCounts.get(muscle) ?? 0) + 1);
  }
  const pattern = exercise.movementPattern ?? "unknown";
  patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
}

function expandFocusArea(area: string): string[] {
  const normalized = area.trim().toLowerCase();
  const map: Record<string, string[]> = {
    chest: ["chest", "upper_chest"],
    胸: ["chest", "upper_chest"],
    back: ["back", "lats", "upper_back"],
    背: ["back", "lats", "upper_back"],
    shoulders: ["shoulders", "front_delts", "side_delts", "rear_delts"],
    shoulder: ["shoulders", "front_delts", "side_delts", "rear_delts"],
    肩: ["shoulders", "front_delts", "side_delts", "rear_delts"],
    arms: ["biceps", "triceps"],
    手臂: ["biceps", "triceps"],
    legs: ["legs", "quads", "hamstrings", "calves"],
    腿: ["legs", "quads", "hamstrings", "calves"],
    glutes: ["glutes"],
    臀: ["glutes"],
    core: ["core"],
    核心: ["core"],
  };
  return map[normalized] ?? [normalized];
}

function buildPlannedExercise(
  exerciseName: string,
  baseline: ExerciseWeightBaseline,
  sets: number,
  scheme: GoalScheme,
  meta: PlanExerciseCatalogItem | null,
): PlannedExercise {
  const base: PlannedExercise = {
    ...(meta ? { exercise_id: meta.exerciseId } : {}),
    exercise_name: exerciseName,
    sets,
    rep_min: scheme.repMin,
    rep_max: scheme.repMax,
    target_weight_kg: null,
    rest_seconds: meta?.defaultRestSeconds ?? scheme.fallbackRestSeconds,
    equipment: meta?.equipment ?? null,
    movement_pattern: meta?.movementPattern ?? null,
    primary_muscles: meta?.primaryMuscles ?? [],
    basis: "暂无重量基线，沿用上次训练重量并小幅保守渐进。",
  };

  if (baseline.estimated1RmKg !== null && baseline.estimated1RmKg > 0) {
    return {
      ...base,
      target_weight_kg: roundToPlate(
        baseline.estimated1RmKg * scheme.intensityPctOf1Rm,
      ),
      basis: `基于估算 1RM ${formatOneRmForDisplay(baseline.estimated1RmKg)} kg 的 ${Math.round(scheme.intensityPctOf1Rm * 100)}%（${scheme.repMin}~${scheme.repMax} 次区间起始重量）。`,
    };
  }

  if (baseline.maxWeightKg !== null && baseline.maxWeightKg > 0) {
    return {
      ...base,
      target_weight_kg: roundToPlate(baseline.maxWeightKg),
      basis: "无估算 1RM，以近期最高训练重量为基线，保持后再小幅渐进。",
    };
  }

  return base;
}

function buildAlternatives(
  exercise: PlannedExercise,
  catalog: PlanExerciseCatalogItem[],
  selectedNames: Set<string>,
): PlannedExerciseAlternative[] {
  const primaryMuscles = new Set(exercise.primary_muscles ?? []);
  return catalog
    .filter((candidate) => {
      if (selectedNames.has(normalizeName(candidate.exerciseName)))
        return false;
      const samePattern =
        exercise.movement_pattern != null &&
        candidate.movementPattern === exercise.movement_pattern;
      const sharedMuscle = candidate.primaryMuscles.some((muscle) =>
        primaryMuscles.has(muscle),
      );
      return samePattern || sharedMuscle;
    })
    .slice(0, MAX_ALTERNATIVES)
    .map((candidate) => ({
      exercise_id: candidate.exerciseId,
      exercise_name: candidate.exerciseName,
      equipment: candidate.equipment,
      movement_pattern: candidate.movementPattern,
      primary_muscles: candidate.primaryMuscles,
      rest_seconds: candidate.defaultRestSeconds,
    }));
}

function buildSessions(
  exercises: PlannedExercise[],
  weeklyDays: number,
  durationBudget: number,
): PlannedTrainingSession[] {
  if (exercises.length === 0) return [];
  const sessionCount = Math.min(weeklyDays, exercises.length);
  const buckets = Array.from(
    { length: sessionCount },
    () => [] as PlannedExercise[],
  );
  for (const exercise of exercises) {
    const exerciseMuscles = new Set(exercise.primary_muscles ?? []);
    const rankedBuckets = buckets
      .map((bucket, index) => ({
        bucket,
        index,
        overlap: bucket.reduce(
          (total, item) =>
            total +
            (item.primary_muscles ?? []).filter((muscle) =>
              exerciseMuscles.has(muscle),
            ).length,
          0,
        ),
      }))
      .sort(
        (left, right) =>
          left.overlap - right.overlap ||
          left.bucket.length - right.bucket.length ||
          left.index - right.index,
      );
    rankedBuckets[0]?.bucket.push(exercise);
  }

  return buckets.map((sessionExercises, index) => ({
    session_index: index + 1,
    title: `训练日 ${index + 1}`,
    focus_areas: uniqueStrings(
      sessionExercises.flatMap((exercise) => exercise.primary_muscles ?? []),
    ).slice(0, 3),
    estimated_duration_minutes: Math.min(
      durationBudget,
      estimateSessionDuration(sessionExercises),
    ),
    exercises: sessionExercises,
  }));
}

function estimateSessionDuration(exercises: PlannedExercise[]): number {
  const seconds = exercises.reduce((total, exercise) => {
    const workSeconds = exercise.sets * 45;
    const restSeconds =
      Math.max(0, exercise.sets - 1) * (exercise.rest_seconds ?? 90);
    return total + workSeconds + restSeconds;
  }, 5 * 60);
  return Math.max(15, Math.ceil(seconds / 300) * 5);
}

function applyExerciseAdherence(
  exercise: PlannedExercise,
  adherence: PlanAdherenceExerciseContext,
): PlannedExercise {
  if (adherence.status === "done") return exercise;
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
  if (adherence.status === "missed")
    return Math.max(1, Math.min(baseSets, adherence.plannedSets) - 1);
  if (adherence.status === "partial")
    return Math.max(1, Math.min(baseSets, adherence.plannedSets));
  return baseSets;
}

function capTargetWeight(
  targetWeightKg: number | null,
  previousTargetWeightKg: number | null,
): number | null {
  if (previousTargetWeightKg === null) return null;
  if (targetWeightKg === null) return previousTargetWeightKg;
  return Math.min(targetWeightKg, previousTargetWeightKg);
}

function resolveAdherenceAdjustedMode(
  mode: ProgressionMode,
  adherence: PlanAdherenceContext | null,
): ProgressionMode {
  if (adherence === null || adherence.setAdherenceRatio >= HIGH_ADHERENCE_RATIO)
    return mode;
  if (adherence.setAdherenceRatio < LOW_ADHERENCE_RATIO) return "consolidate";
  return mode === "add_frequency" ? "maintain" : mode;
}

function getCarryOverExercises(
  adherence: PlanAdherenceContext | null,
): PlanAdherenceExerciseContext[] {
  return (
    adherence?.exercises.filter(
      (exercise) =>
        exercise.status === "partial" || exercise.status === "missed",
    ) ?? []
  );
}

function buildAdherenceMap(
  adherence: PlanAdherenceContext | null,
): Map<string, PlanAdherenceExerciseContext> {
  return new Map(
    adherence?.exercises.map((exercise) => [
      normalizeName(exercise.exerciseName),
      exercise,
    ]) ?? [],
  );
}

function buildNotes(
  input: NextWeekPlanGeneratorInput,
  adjustedMode: ProgressionMode,
  settings: ReturnType<typeof resolvePlanSettings>,
  rawCatalog: PlanExerciseCatalogItem[],
  allowedCatalog: PlanExerciseCatalogItem[],
): string[] {
  const notes = [
    describeStrategy(adjustedMode),
    `按 ${settings.weeklyDays} 个灵活训练日编排，单次以 ${settings.sessionDurationMinutes} 分钟为上限。`,
    "一次只改一个变量（组数 / 重量 / 次数 / 休息）。",
  ];
  if (input.profile) {
    notes.push(describeGoal(input.profile.goal));
    for (const injury of input.profile.injuryConstraints) {
      notes.push(`已按 ${injury} 约束过滤已知高风险动作；不适时立即停止。`);
    }
  }
  if (settings.availableEquipment.length > 0) {
    notes.push(`本次只使用：${settings.availableEquipment.join("、")}。`);
  }
  if (rawCatalog.length > allowedCatalog.length) {
    notes.push(
      `器械与伤病约束已排除 ${rawCatalog.length - allowedCatalog.length} 个候选动作。`,
    );
  }
  if (input.preferences?.readiness === "fatigued") {
    notes.push("本周状态偏疲劳：计划自动切到巩固模式，不主动加量。");
  }
  if (input.weakArea)
    notes.push(`记录较少的 ${input.weakArea} 仅作排序参考，不强行堆量。`);
  if (input.topExercises.length === 0) {
    notes.push("暂无近期动作基线：先使用合规 starter 动作，目标重量保持为空。");
  }
  notes.push("这是规划草案而非医疗处方；出现疼痛、麻木或异常疲劳请停止训练。");
  return notes;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function describeStrategy(mode: ProgressionMode): string {
  switch (mode) {
    case "consolidate":
      return "下周以巩固和控制疲劳为主，不大幅加量。";
    case "add_frequency":
      return "近期频率偏低，下周可保守地增加训练量。";
    case "maintain":
      return "频率适中，下周维持基线，只做小幅优化。";
  }
}

function describeGoal(goal: PlanGoal): string {
  switch (goal) {
    case "strength":
      return "目标力量：低次数、高强度、充分组间休息。";
    case "hypertrophy":
      return "目标增肌：中等次数与强度，关注总有效组数。";
    case "endurance":
      return "目标耐力：高次数、低强度、较短组间休息。";
    case "general_fitness":
      return "目标综合健身：中等次数，兼顾力量与耐力。";
  }
}

function roundToPlate(value: number): number {
  return Math.round(value / WEIGHT_ROUNDING_KG) * WEIGHT_ROUNDING_KG;
}

function formatOneRmForDisplay(value: number): number {
  return Math.round(value * 10) / 10;
}
