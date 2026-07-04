import type {
  DictionaryExercise,
  DictionaryMuscleGroup,
} from "./dictionary-api";

export const EXERCISE_CATEGORY_LABELS = [
  "全部",
  "胸",
  "背",
  "腿",
  "肩",
  "手臂",
  "核心",
  "有氧",
  "全身",
  "其他",
] as const;

export type ExerciseCategory = (typeof EXERCISE_CATEGORY_LABELS)[number];

const MUSCLE_LABELS: Record<string, string> = {
  biceps: "肱二头肌",
  calves: "小腿",
  chest: "胸",
  core: "核心",
  front_delts: "三角肌前束",
  glutes: "臀部",
  hamstrings: "腘绳肌",
  lats: "背阔肌",
  legs: "腿",
  quads: "股四头肌",
  rear_delts: "三角肌后束",
  shoulders: "肩",
  side_delts: "三角肌中束",
  triceps: "肱三头肌",
  upper_back: "上背",
  upper_chest: "上胸",
};

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "杠铃",
  bodyweight: "自重",
  cable: "绳索",
  dumbbell: "哑铃",
  kettlebell: "壶铃",
  machine: "器械",
  none: "无器械",
  plate: "杠铃片",
  resistance_band: "弹力带",
  sled: "雪橇",
};

const MOVEMENT_PATTERN_LABELS: Record<string, string> = {
  carry: "搬运",
  core: "核心",
  gait: "步态",
  hinge: "髋主导",
  horizontal_pull: "水平拉",
  horizontal_push: "水平推",
  isolation: "孤立训练",
  knee_dominant: "膝主导",
  lunge: "弓步",
  pull: "拉",
  push: "推",
  rotation: "旋转",
  shoulder_abduction: "肩外展",
  shoulder_flexion: "肩屈曲",
  squat: "深蹲",
  vertical_pull: "垂直拉",
  vertical_push: "垂直推",
};

export function getExerciseDisplayName(exercise: DictionaryExercise): string {
  const chineseName = cleanDisplayText(exercise.name_zh);

  return chineseName || "未知动作";
}

export function getMuscleGroupDisplayName(
  muscleGroup: DictionaryMuscleGroup,
): string {
  return getMuscleCodeLabel(muscleGroup.code);
}

export function getMuscleCodeLabel(code: string): string {
  const normalizedCode = code.trim().toLowerCase();

  return MUSCLE_LABELS[normalizedCode] ?? inferMuscleLabel(normalizedCode);
}

export function getEquipmentLabel(
  equipment: string | null | undefined,
): string | null {
  if (!equipment?.trim()) {
    return null;
  }

  const normalizedEquipment = equipment.trim().toLowerCase();

  return EQUIPMENT_LABELS[normalizedEquipment] ?? "未标注器械";
}

export function getMovementPatternLabel(
  movementPattern: string | null | undefined,
): string | null {
  if (!movementPattern?.trim()) {
    return null;
  }

  const normalizedPattern = movementPattern.trim().toLowerCase();

  return MOVEMENT_PATTERN_LABELS[normalizedPattern] ?? "未标注类型";
}

export function getExerciseCategory(
  exercise: DictionaryExercise,
): ExerciseCategory {
  const allCodes = exercise.muscles.map((muscle) => muscle.code.toLowerCase());
  const movementPattern = exercise.movement_pattern?.toLowerCase() ?? "";
  const searchable = getExerciseSearchText(exercise);

  if (allCodes.some(isChestCode)) {
    return "胸";
  }

  if (allCodes.some(isBackCode)) {
    return "背";
  }

  if (allCodes.some(isLegCode)) {
    return "腿";
  }

  if (allCodes.some(isShoulderCode)) {
    return "肩";
  }

  if (allCodes.some(isArmCode)) {
    return "手臂";
  }

  if (allCodes.some(isCoreCode)) {
    return "核心";
  }

  if (
    movementPattern.includes("gait") ||
    searchable.includes("cardio") ||
    searchable.includes("conditioning")
  ) {
    return "有氧";
  }

  if (
    movementPattern.includes("carry") ||
    movementPattern.includes("rotation") ||
    searchable.includes("sled")
  ) {
    return "全身";
  }

  return "其他";
}

export function getExerciseCategoryLabel(exercise: DictionaryExercise): string {
  return getExerciseCategory(exercise);
}

export function getExerciseSearchText(exercise: DictionaryExercise): string {
  return [
    exercise.name_zh,
    exercise.name_en,
    exercise.code,
    exercise.equipment,
    exercise.movement_pattern,
    getEquipmentLabel(exercise.equipment),
    getMovementPatternLabel(exercise.movement_pattern),
    getExerciseDisplayName(exercise),
    ...exercise.muscles.flatMap((muscle) => [
      muscle.code,
      getMuscleCodeLabel(muscle.code),
    ]),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .toLowerCase();
}

export function formatWeight(value: number | string): string {
  return `${value} 公斤`;
}

function cleanDisplayText(value: string | null | undefined): string {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue || looksLikeMojibake(trimmedValue)) {
    return "";
  }

  return trimmedValue;
}

function looksLikeMojibake(value: string): boolean {
  return (
    value.includes("�") ||
    /[鑳兏噦績]/u.test(value) ||
    /[涓冨勬椂]/u.test(value)
  );
}

function inferMuscleLabel(code: string): string {
  if (isShoulderCode(code)) {
    return "肩";
  }

  if (isChestCode(code)) {
    return "胸";
  }

  if (isBackCode(code)) {
    return "背";
  }

  if (isLegCode(code)) {
    return "腿";
  }

  if (isArmCode(code)) {
    return "手臂";
  }

  if (isCoreCode(code)) {
    return "核心";
  }

  return "其他肌群";
}

function isShoulderCode(code: string): boolean {
  return (
    code.includes("shoulder") ||
    code.includes("delt") ||
    code.includes("deltoid")
  );
}

function isChestCode(code: string): boolean {
  return code.includes("chest") || code.includes("pec");
}

function isBackCode(code: string): boolean {
  return code.includes("back") || code.includes("lat") || code.includes("trap");
}

function isLegCode(code: string): boolean {
  return (
    code.includes("quad") ||
    code.includes("hamstring") ||
    code.includes("leg") ||
    code.includes("glute") ||
    code.includes("calf")
  );
}

function isArmCode(code: string): boolean {
  return (
    code.includes("bicep") ||
    code.includes("tricep") ||
    code.includes("forearm") ||
    code.includes("grip")
  );
}

function isCoreCode(code: string): boolean {
  return code.includes("core") || code.includes("ab");
}
