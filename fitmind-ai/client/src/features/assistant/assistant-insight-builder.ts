import type { ExerciseProgress } from "../training/exercise-progress-api";
import type { RecommendationContext } from "../training/recommendation-context-api";
import type { TrainingSummary } from "../training/training-summary-api";
import type {
  AssistantInsightCard,
  AssistantInsightSnapshot,
} from "./assistant-insight-types";

interface BuildAssistantInsightSnapshotInput {
  exerciseProgress: ExerciseProgress | null;
  recommendationContext: RecommendationContext;
  selectedExerciseName: string | null | undefined;
  summary: TrainingSummary;
}

type FocusArea =
  | "back"
  | "chest"
  | "legs"
  | "mixed"
  | "shoulders"
  | "unknown";

export function buildAssistantInsightSnapshot(
  input: BuildAssistantInsightSnapshotInput,
): AssistantInsightSnapshot {
  const cards: AssistantInsightCard[] = [
    buildNextTrainingFocusCard(input),
    buildTrainingImbalanceCard(input),
    buildRecoveryCard(input),
    buildExerciseProgressCard(input),
    buildEvidenceExplainCard(input),
  ];

  return {
    range: input.summary.range,
    overview: {
      set_count: input.summary.totals.set_count,
      total_volume: input.summary.totals.total_volume,
      workout_count: input.summary.totals.workout_count,
    },
    cards,
    limitations: [
      "这些结论主要基于最近 30 天已记录的 workout 和 set，不是模型凭空猜测。",
      "当前动作字典的肌群信息仍有限，所以部分判断主要依据动作名称、训练频率和训练量集中度。",
      "恢复相关内容只提供训练记录层的一般性提醒，不能代替对疼痛、疲劳或健康风险的判断。",
    ],
  };
}

function buildNextTrainingFocusCard(
  input: BuildAssistantInsightSnapshotInput,
): AssistantInsightCard {
  const topExercise = input.summary.by_exercise[0];
  const dominantArea = inferDominantFocusArea(input.summary.by_exercise);

  if (input.summary.totals.workout_count === 0) {
    return {
      type: "next_training_focus",
      title: "今日建议",
      summary:
        "你最近 30 天还没有训练记录。先完成一次训练，助手才能根据真实记录给出更具体的下一次训练建议。",
      tone: "accent",
      suggestedPrompt: {
        mode: "next_training_focus",
        message: "我今天练什么？",
      },
    };
  }

  const suggestion = resolveNextFocusSuggestion(dominantArea);

  return {
    type: "next_training_focus",
    title: "今日建议",
    summary: `根据你最近 30 天的训练记录，下一次可以优先补${suggestion}。${topExercise ? `你当前记录里训练量最集中的动作是 ${topExercise.exercise_name}。` : ""}`,
    tone: "accent",
    evidenceSummary: `最近 30 天共记录 ${input.summary.totals.workout_count} 次训练，已纳入 ${input.recommendationContext.evidence.workout_ids.length} 条 workout 证据。`,
    suggestedPrompt: {
      mode: "next_training_focus",
      message: "我今天练什么？",
    },
  };
}

function buildTrainingImbalanceCard(
  input: BuildAssistantInsightSnapshotInput,
): AssistantInsightCard {
  const topExercises = input.summary.by_exercise.slice(0, 3);
  const topVolume = topExercises.reduce(
    (total, exercise) => total + exercise.total_volume,
    0,
  );
  const firstExercise = topExercises[0];
  const firstRatio =
    topVolume === 0 || firstExercise === undefined
      ? 0
      : firstExercise.total_volume / topVolume;
  const dominantArea = inferDominantFocusArea(topExercises);

  if (topExercises.length === 0) {
    return {
      type: "training_imbalance",
      title: "训练偏科提醒",
      summary:
        "目前还没有足够的动作训练量分布可供比较。继续记录几次训练后，这里会提示你是否明显偏向某一类动作。",
      tone: "warning",
      suggestedPrompt: {
        mode: "training_imbalance",
        message: "我是不是偏科？",
      },
    };
  }

  const imbalanceSummary =
    firstRatio >= 0.55
      ? `最近训练量明显集中在 ${firstExercise?.exercise_name ?? "少数动作"}，当前分布有一点偏向 ${describeFocusArea(dominantArea)}。`
      : "最近训练量没有明显只堆在单一动作上，整体看起来还算相对均衡。";

  return {
    type: "training_imbalance",
    title: "训练偏科提醒",
    summary: `${imbalanceSummary} 这个判断主要来自最近 30 天 top exercises 的训练量占比。`,
    tone: firstRatio >= 0.55 ? "warning" : "info",
    evidenceSummary: `Top 3 动作共 ${topVolume.toLocaleString()} kg，其中第一位约占 ${(firstRatio * 100).toFixed(0)}%。`,
    suggestedPrompt: {
      mode: "training_imbalance",
      message: "我是不是偏科？",
    },
  };
}

function buildRecoveryCard(
  input: BuildAssistantInsightSnapshotInput,
): AssistantInsightCard {
  const latestWorkout = input.recommendationContext.recent_workouts[0];
  const latestExerciseSession = input.exerciseProgress?.sessions
    .slice()
    .sort((left, right) =>
      right.performed_at.localeCompare(left.performed_at),
    )[0];

  if (!latestWorkout) {
    return {
      type: "recovery_check",
      title: "恢复提醒",
      summary:
        "目前还没有最近训练记录可供参考。我只能根据训练记录做一般性提醒，不能判断疼痛、疲劳或健康风险。",
      tone: "info",
      hint:
        "如果有疼痛或不适，应优先休息或咨询专业人士。",
      suggestedPrompt: {
        mode: "recovery_check",
        message: "我今天还能练胸吗？",
      },
    };
  }

  const referenceTime = latestExerciseSession?.performed_at ?? latestWorkout.performed_at;
  const daysSince = getDaysSince(referenceTime);
  const selectedExerciseName = input.selectedExerciseName?.trim();
  const subject = selectedExerciseName
    ? `${selectedExerciseName} 相关训练`
    : "最近一次训练";
  const rhythmCopy =
    daysSince <= 1
      ? `${subject}距离现在很近，如果今天还想继续练同一类动作，建议把主观疲劳、睡眠和 soreness 一起考虑。`
      : `${subject}距离现在大约 ${daysSince} 天，记录层面看并不算特别密，但是否继续加量还是要结合你当天状态。`;

  return {
    type: "recovery_check",
    title: "恢复提醒",
    summary: `${rhythmCopy} 我只能根据训练记录做一般性提醒，不能判断疼痛、疲劳或健康风险。`,
    tone: "info",
    hint: "如果有疼痛或不适，应优先休息或咨询专业人士。",
    evidenceSummary: `最近一次纳入参考的训练时间是 ${formatDisplayDateTime(referenceTime)}。`,
    suggestedPrompt: {
      mode: "recovery_check",
      message: selectedExerciseName
        ? `我今天还能练${selectedExerciseName}吗？`
        : "我今天还能练胸吗？",
    },
  };
}

function buildExerciseProgressCard(
  input: BuildAssistantInsightSnapshotInput,
): AssistantInsightCard {
  const selectedExerciseName = input.selectedExerciseName?.trim() ?? "";

  if (!input.exerciseProgress) {
    return {
      type: "exercise_progress",
      title: "重点动作进展",
      summary:
        "当前还没有选中动作，所以这里先不直接判断某个动作的进展。",
      tone: "analysis",
      hint: "去“分析”页先选一个动作，再回来查看它的训练进展。",
      suggestedPrompt: {
        mode: "exercise_progress",
        message: "当前动作进展",
      },
    };
  }

  if (input.exerciseProgress.totals.workout_count === 0) {
    return {
      type: "exercise_progress",
      title: "重点动作进展",
      summary: `${selectedExerciseName || "当前动作"}最近 30 天还没有训练记录，所以暂时看不出稳定进展。`,
      tone: "analysis",
      suggestedPrompt: {
        mode: "exercise_progress",
        message: `分析一下${selectedExerciseName || "当前动作"}的进展。`,
      },
    };
  }

  return {
    type: "exercise_progress",
    title: "重点动作进展",
    summary: `${selectedExerciseName || "当前动作"}最近共记录 ${input.exerciseProgress.totals.workout_count} 次训练，当前估算 1RM 约 ${formatKg(input.exerciseProgress.totals.estimated_1rm_kg)}，观察到的最高训练重量约 ${formatKg(input.exerciseProgress.totals.max_weight_kg)}。`,
    tone: "analysis",
    evidenceSummary: `这个判断来自 ${input.exerciseProgress.evidence.workout_ids.length} 条 workout 和 ${input.exerciseProgress.evidence.set_ids.length} 条 set。`,
    suggestedPrompt: {
      mode: "exercise_progress",
      message: `分析一下${selectedExerciseName || "当前动作"}的进展。`,
    },
  };
}

function buildEvidenceExplainCard(
  input: BuildAssistantInsightSnapshotInput,
): AssistantInsightCard {
  return {
    type: "evidence_explain",
    title: "判断依据",
    summary:
      "这些判断来自已记录的 workout、set 和 calculation rules，不是模型凭空猜测。当前肌群映射仍有限，所以我主要根据动作名称、训练量和最近训练频率来解释你的训练情况。",
    tone: "info",
    evidenceSummary: `本页共参考 ${input.recommendationContext.evidence.workout_ids.length} 条 workout、${input.recommendationContext.evidence.set_ids.length} 条 set，以及 ${input.recommendationContext.evidence.calculation_rules.length} 条 calculation rules。`,
    suggestedPrompt: {
      mode: "evidence_explain",
      message: "AI 根据什么判断？",
    },
  };
}

function inferDominantFocusArea(
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

  const rankedAreas = [...areaScores.entries()].sort((left, right) => right[1] - left[1]);
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

function inferFocusAreaFromName(exerciseName: string): FocusArea {
  const normalized = exerciseName.trim().toLowerCase();

  if (
    /(bench|chest|fly|push[- ]?up|incline|decline|dip)/u.test(normalized)
  ) {
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

  if (/(shoulder|overhead press|lateral raise|rear delt|press)/u.test(normalized)) {
    return "shoulders";
  }

  return "unknown";
}

function resolveNextFocusSuggestion(area: FocusArea): string {
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
      return "训练记录较少的部位";
  }
}

function describeFocusArea(area: FocusArea): string {
  switch (area) {
    case "chest":
      return "胸推动作";
    case "back":
      return "背部拉类动作";
    case "legs":
      return "腿部动作";
    case "shoulders":
      return "肩部推动作";
    case "mixed":
      return "多部位混合";
    default:
      return "少数动作";
  }
}

function formatKg(value: number | null): string {
  if (value === null) {
    return "暂无结果";
  }

  return `${value.toLocaleString()} kg`;
}

function getDaysSince(timestamp: string): number {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  const now = Date.now();
  const diff = Math.max(0, now - date.getTime());

  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatDisplayDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}
