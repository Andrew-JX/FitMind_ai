import type { AssistantIntentMode } from "../ai/provider-types.js";
import { getUserExerciseProgress } from "./exercise-progress-service.js";
import { getUserMuscleLoad } from "./muscle-load-service.js";
import { getUserRecommendationContext } from "./recommendation-context-service.js";
import { getUserTrainingSummary } from "./training-summary-service.js";

export type AssistantInsightTone = "accent" | "analysis" | "info" | "warning";

export type AssistantInsightType =
  | "next_training_focus"
  | "training_imbalance"
  | "recovery_check"
  | "exercise_progress"
  | "evidence_explain";

export interface AssistantInsightRangeDto {
  start_date: string;
  end_date: string;
}

export interface AssistantInsightPromptDto {
  message: string;
  mode: AssistantIntentMode;
}

export interface AssistantInsightCardDto {
  type: AssistantInsightType;
  title: string;
  summary: string;
  tone: AssistantInsightTone;
  hint?: string | undefined;
  evidence_summary?: string | undefined;
  suggested_prompt?: AssistantInsightPromptDto | undefined;
}

export interface AssistantInsightsOverviewDto {
  workout_count: number;
  set_count: number;
  total_volume: number;
  top_muscle_group_name: string | null;
  top_exercise_name: string | null;
}

export interface AssistantInsightsEvidenceDto {
  workout_count: number;
  set_count: number;
  calculation_sources: string[];
  calculation_rules: string[];
}

export interface AssistantInsightsResponseData {
  range: AssistantInsightRangeDto;
  overview: AssistantInsightsOverviewDto;
  cards: AssistantInsightCardDto[];
  limitations: string[];
  evidence: AssistantInsightsEvidenceDto;
}

export interface AssistantInsightsInput {
  exerciseId?: string | undefined;
  range: AssistantInsightRangeDto;
  userId: string;
}

const RECOVERY_BOUNDARY =
  "我只能根据训练记录做一般性提醒，不能判断疼痛、疲劳或健康风险。如果有疼痛或不适，应优先休息或咨询专业人士。";

/**
 * Build deterministic assistant insight cards for the authenticated user.
 *
 * @param input - Authenticated user, date range, and optional selected exercise.
 * @returns Assistant dashboard view-model generated from deterministic sources.
 */
export async function getUserAssistantInsights(
  input: AssistantInsightsInput,
): Promise<AssistantInsightsResponseData> {
  const [summary, recommendationContext, muscleLoad, exerciseProgress] =
    await Promise.all([
      getUserTrainingSummary(input.userId, input.range),
      getUserRecommendationContext(input.userId, input.range),
      getUserMuscleLoad(input.userId, input.range),
      input.exerciseId
        ? getUserExerciseProgress(input.userId, input.exerciseId, input.range)
        : Promise.resolve(null),
    ]);

  const topMuscleGroup = muscleLoad.top_muscle_groups[0] ?? null;
  const topExercise = summary.by_exercise[0] ?? null;
  const cards: AssistantInsightCardDto[] = [
    buildNextTrainingFocusCard(muscleLoad),
    buildTrainingImbalanceCard(muscleLoad),
    buildRecoveryCard(recommendationContext.recent_workouts),
    buildExerciseProgressCard(exerciseProgress),
    buildEvidenceExplainCard(muscleLoad),
  ];
  const calculationRules = new Set<string>([
    ...summary.evidence.calculation_rules,
    ...recommendationContext.evidence.calculation_rules,
    ...muscleLoad.evidence.calculation_rules,
  ]);
  const calculationSources = [
    "training_summary",
    "recommendation_context",
    "muscle_load",
  ];

  if (exerciseProgress) {
    calculationSources.push("exercise_progress");

    for (const rule of exerciseProgress.evidence.calculation_rules) {
      calculationRules.add(rule);
    }
  }

  return {
    range: input.range,
    overview: {
      workout_count: summary.totals.workout_count,
      set_count: summary.totals.set_count,
      total_volume: summary.totals.total_volume,
      top_muscle_group_name: topMuscleGroup?.muscle_group_name ?? null,
      top_exercise_name: topExercise?.exercise_name ?? null,
    },
    cards,
    limitations: [
      "本页仅基于已记录训练生成一般性提醒，不构成医疗、康复或专业训练处方。",
      "肌群分布来自动作-肌群贡献权重和已记录组数；没有记录的数据不会被当作完整训练计划判断。",
      "当前 Assistant Insight Dashboard 是 deterministic view-model，不是 LLM 自由生成内容。",
    ],
    evidence: {
      workout_count: muscleLoad.evidence.workout_ids.length,
      set_count: muscleLoad.evidence.set_ids.length,
      calculation_sources: calculationSources,
      calculation_rules: [...calculationRules],
    },
  };
}

function buildNextTrainingFocusCard(
  muscleLoad: Awaited<ReturnType<typeof getUserMuscleLoad>>,
): AssistantInsightCardDto {
  const topMuscleGroup = muscleLoad.top_muscle_groups[0];
  const lowVolumeGroup = muscleLoad.low_volume_muscle_groups[0];

  if (muscleLoad.totals.workout_count === 0) {
    return {
      type: "next_training_focus",
      title: "今日建议",
      summary:
        "最近还没有足够训练记录生成下一次训练参考。完成 1-2 次包含重量和次数的训练后，我会基于动作、组数和肌群贡献权重给出更具体的建议。",
      tone: "accent",
      hint: "先记录一次完整训练，助手页就会开始生成更有针对性的建议。",
      suggested_prompt: {
        mode: "next_training_focus",
        message: "我今天练什么？",
      },
    };
  }

  if (
    muscleLoad.totals.set_count < 5 ||
    muscleLoad.by_muscle_group.length < 2 ||
    !topMuscleGroup
  ) {
    return {
      type: "next_training_focus",
      title: "今日建议",
      summary:
        "当前记录已经可以作为起点，但样本还偏薄。可以继续记录 1-2 次训练，让下一次训练参考更稳定。",
      tone: "accent",
      evidence_summary: `当前范围内已记录 ${muscleLoad.totals.workout_count} 次训练、${muscleLoad.totals.set_count} 组。`,
      suggested_prompt: {
        mode: "next_training_focus",
        message: "我今天练什么？",
      },
    };
  }

  const focusCopy = lowVolumeGroup
    ? `下一次可以优先关注最近记录中占比较低的 ${lowVolumeGroup.muscle_group_name}。`
    : "下一次可以优先关注最近记录中出现较少的动作类型。";

  return {
    type: "next_training_focus",
    title: "今日建议",
    summary: `最近 30 天的记录更集中于 ${topMuscleGroup.muscle_group_name}，占比约 ${formatRatio(topMuscleGroup.contribution_ratio)}。${focusCopy}`,
    tone: "accent",
    evidence_summary: `判断基于 ${muscleLoad.totals.set_count} 组记录和 muscle-load weighted volume。`,
    suggested_prompt: {
      mode: "next_training_focus",
      message: "我今天练什么？",
    },
  };
}

function buildTrainingImbalanceCard(
  muscleLoad: Awaited<ReturnType<typeof getUserMuscleLoad>>,
): AssistantInsightCardDto {
  const topMuscleGroup = muscleLoad.top_muscle_groups[0];
  const lowVolumeGroups = muscleLoad.low_volume_muscle_groups
    .slice(0, 2)
    .map((group) => group.muscle_group_name);

  if (muscleLoad.totals.workout_count === 0) {
    return {
      type: "training_imbalance",
      title: "训练偏科提醒",
      summary:
        "当前还没有可比较的肌群分布。继续记录几次训练后，这里会提示最近记录是否更集中于某些肌群。",
      tone: "warning",
      suggested_prompt: {
        mode: "training_imbalance",
        message: "我是不是偏科？",
      },
    };
  }

  if (!topMuscleGroup || muscleLoad.by_muscle_group.length < 2) {
    return {
      type: "training_imbalance",
      title: "训练偏科提醒",
      summary:
        "当前可计算肌群结果还不够丰富，暂时只适合观察趋势，不适合解读为明确的偏向。",
      tone: "warning",
      evidence_summary: `当前返回 ${muscleLoad.by_muscle_group.length} 个可计算肌群。`,
      suggested_prompt: {
        mode: "training_imbalance",
        message: "我是不是偏科？",
      },
    };
  }

  return {
    type: "training_imbalance",
    title: "训练偏科提醒",
    summary: `当前记录更集中于 ${topMuscleGroup.muscle_group_name}，最近记录中占比较低的肌群包括 ${formatNameList(lowVolumeGroups)}。这只是训练记录分布提示，不代表训练计划结论。`,
    tone: topMuscleGroup.contribution_ratio >= 0.45 ? "warning" : "info",
    evidence_summary: `最高肌群占比约 ${formatRatio(topMuscleGroup.contribution_ratio)}，来自 muscle-load contribution ratio。`,
    suggested_prompt: {
      mode: "training_imbalance",
      message: "我是不是偏科？",
    },
  };
}

function buildRecoveryCard(
  recentWorkouts: Array<{ performed_at: string; set_count: number }>,
): AssistantInsightCardDto {
  const latestWorkout = recentWorkouts[0];

  if (!latestWorkout) {
    return {
      type: "recovery_check",
      title: "恢复提醒",
      summary:
        "还没有最近训练记录可供参考，所以这里先不做恢复节奏提示。" +
        RECOVERY_BOUNDARY,
      tone: "info",
      suggested_prompt: {
        mode: "recovery_check",
        message: "我今天还能练吗？",
      },
    };
  }

  const daysSince = getDaysSince(latestWorkout.performed_at);
  const timingCopy =
    daysSince <= 1
      ? "最近一次训练距离现在很近，下一次安排可以先参考主观状态和训练部位。"
      : `最近一次训练距离现在大约 ${daysSince} 天，可以结合当前状态安排下一次训练。`;

  return {
    type: "recovery_check",
    title: "恢复提醒",
    summary: `${timingCopy}${RECOVERY_BOUNDARY}`,
    tone: "info",
    evidence_summary: `最近一次记录时间：${formatDisplayDateTime(latestWorkout.performed_at)}，包含 ${latestWorkout.set_count} 组。`,
    suggested_prompt: {
      mode: "recovery_check",
      message: "我今天还能练吗？",
    },
  };
}

function buildExerciseProgressCard(
  exerciseProgress: Awaited<ReturnType<typeof getUserExerciseProgress>> | null,
): AssistantInsightCardDto {
  if (!exerciseProgress) {
    return {
      type: "exercise_progress",
      title: "重点动作进展",
      summary:
        "当前还没有选中重点动作。可以先在分析页选择一个动作，再查看更具体的进展。",
      tone: "analysis",
      hint: "选中动作后，这里会展示最近 30 天训练次数、最高重量和估算 1RM。",
      suggested_prompt: {
        mode: "exercise_progress",
        message: "当前动作进展",
      },
    };
  }

  const exerciseName = exerciseProgress.exercise.exercise_name ?? "当前动作";

  if (exerciseProgress.totals.workout_count === 0) {
    return {
      type: "exercise_progress",
      title: "重点动作进展",
      summary: `${exerciseName} 最近 30 天还没有训练记录，所以现在还看不出稳定趋势。`,
      tone: "analysis",
      suggested_prompt: {
        mode: "exercise_progress",
        message: `分析一下 ${exerciseName} 的进展`,
      },
    };
  }

  return {
    type: "exercise_progress",
    title: "重点动作进展",
    summary: `${exerciseName} 最近记录 ${exerciseProgress.totals.workout_count} 次，最高训练重量约 ${formatNullableKg(exerciseProgress.totals.max_weight_kg)}，估算 1RM 约 ${formatNullableKg(exerciseProgress.totals.estimated_1rm_kg)}。`,
    tone: "analysis",
    evidence_summary: `判断基于 ${exerciseProgress.evidence.workout_ids.length} 条 workout 和 ${exerciseProgress.evidence.set_ids.length} 条 set。`,
    suggested_prompt: {
      mode: "exercise_progress",
      message: `分析一下 ${exerciseName} 的进展`,
    },
  };
}

function buildEvidenceExplainCard(
  muscleLoad: Awaited<ReturnType<typeof getUserMuscleLoad>>,
): AssistantInsightCardDto {
  return {
    type: "evidence_explain",
    title: "判断依据",
    summary:
      "这些洞察来自已记录的 workout、sets 和 calculation rules。肌群分布来自 exercise_muscles contribution weight，不是模型凭空生成。",
    tone: "info",
    evidence_summary: `当前 evidence 覆盖 ${muscleLoad.evidence.workout_ids.length} 条 workout、${muscleLoad.evidence.set_ids.length} 条 set，以及 ${muscleLoad.evidence.calculation_rules.length} 条 muscle-load 规则。`,
    suggested_prompt: {
      mode: "evidence_explain",
      message: "AI 根据什么判断？",
    },
  };
}

function formatRatio(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNameList(values: string[]): string {
  if (values.length === 0) {
    return "暂无明显低占比项";
  }

  return values.join("、");
}

function formatNullableKg(value: number | null): string {
  if (value === null) {
    return "暂无";
  }

  return `${value.toLocaleString()} kg`;
}

function getDaysSince(timestamp: string): number {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  const diff = Math.max(0, Date.now() - date.getTime());

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
