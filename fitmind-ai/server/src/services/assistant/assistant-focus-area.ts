export type FocusArea =
  | "back"
  | "chest"
  | "legs"
  | "mixed"
  | "shoulders"
  | "unknown";

export function inferDominantFocusArea(
  exercises: Array<{ exercise_name: string; total_volume: number }>,
): FocusArea {
  const areaScores = new Map<FocusArea, number>([
    ["chest", 0],
    ["back", 0],
    ["legs", 0],
    ["shoulders", 0],
    ["unknown", 0],
  ]);

  for (const exercise of exercises) {
    const area = inferFocusAreaFromName(exercise.exercise_name);
    areaScores.set(area, (areaScores.get(area) ?? 0) + exercise.total_volume);
  }

  const rankedAreas = [...areaScores.entries()].sort(
    (left, right) => right[1] - left[1],
  );
  const topArea = rankedAreas[0];
  const secondArea = rankedAreas[1];

  if (!topArea || topArea[1] === 0) {
    return "unknown";
  }

  if (secondArea && secondArea[1] > 0 && topArea[1] / secondArea[1] < 1.25) {
    return "mixed";
  }

  return topArea[0];
}

export function inferFocusAreaFromName(exerciseName: string): FocusArea {
  const normalized = exerciseName.trim().toLowerCase();

  if (/(bench|chest|fly|push[- ]?up|incline|decline|dip)/u.test(normalized)) {
    return "chest";
  }

  if (
    /(row|pull|lat|deadlift|pull[- ]?down|face pull|chin[- ]?up)/u.test(
      normalized,
    )
  ) {
    return "back";
  }

  if (
    /(squat|leg|lunge|rdl|romanian|calf|hip thrust|glute)/u.test(normalized)
  ) {
    return "legs";
  }

  if (
    /(shoulder|overhead press|lateral raise|rear delt|press)/u.test(normalized)
  ) {
    return "shoulders";
  }

  return "unknown";
}

export function resolveNextFocusSuggestion(area: FocusArea): string {
  switch (area) {
    case "chest":
      return "背部或腿部";
    case "back":
      return "腿部或胸推动作";
    case "legs":
      return "背部或胸推动作";
    case "shoulders":
      return "背部或腿部";
    case "mixed":
      return "最近训练量相对没那么集中的部位";
    default:
      return "训练记录相对较少的部位";
  }
}

export function detectTargetArea(message: string): FocusArea {
  const normalized = message.trim().toLowerCase();

  if (/(胸|卧推|bench|incline|push)/u.test(normalized)) {
    return "chest";
  }

  if (/(背|引体|划船|row|pull|deadlift|lat)/u.test(normalized)) {
    return "back";
  }

  if (/(腿|深蹲|squat|leg|lunge|calf|glute)/u.test(normalized)) {
    return "legs";
  }

  if (/(肩|shoulder|press|lateral raise)/u.test(normalized)) {
    return "shoulders";
  }

  return "unknown";
}

export function describeTargetArea(area: FocusArea): string {
  switch (area) {
    case "chest":
      return "胸部";
    case "back":
      return "背部";
    case "legs":
      return "腿部";
    case "shoulders":
      return "肩部";
    case "mixed":
      return "多部位";
    default:
      return "这类部位";
  }
}
