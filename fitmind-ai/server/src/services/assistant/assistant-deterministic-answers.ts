import type { AssistantIntentMode } from "../ai/provider-types.js";
import type { RetrievedKnowledgeChunk } from "../rag/knowledge-retriever.js";
import type {
  AssistantAnswerEvidence,
  AssistantStructuredAnswer,
} from "./assistant-answer-composer.js";
import {
  formatMetricKg,
  formatPercent,
  getDaysSince,
} from "./assistant-display-metrics.js";
import {
  describeTargetArea,
  detectTargetArea,
  inferDominantFocusArea,
  resolveNextFocusSuggestion,
} from "./assistant-focus-area.js";
import type { AssistantRoutedIntent } from "./assistant-intent-router.js";

export interface TrainingOverviewResult {
  range: {
    start_date: string;
    end_date: string;
  };
  totals: {
    workout_count: number;
    set_count: number;
    total_reps: number;
    total_volume: number;
  };
  by_exercise: Array<{
    exercise_name: string;
    total_volume: number;
  }>;
  evidence: {
    workout_ids: string[];
    calculation_rules: string[];
  };
}

export interface ExerciseProgressResult {
  range: {
    start_date: string;
    end_date: string;
  };
  exercise: {
    exercise_id: string;
    exercise_name: string | null;
  };
  totals: {
    workout_count: number;
    set_count: number;
    total_reps: number;
    total_volume: number;
    max_weight_kg: number | null;
    estimated_1rm_kg: number | null;
  };
  sessions: Array<{
    performed_at: string;
  }>;
  evidence: {
    workout_ids: string[];
    set_ids: string[];
    calculation_rules: string[];
  };
}

export interface RecommendationContextResult {
  range: {
    start_date: string;
    end_date: string;
  };
  summary: {
    workout_count: number;
    set_count: number;
    total_reps: number;
    total_volume: number;
    by_exercise: Array<{
      exercise_name: string;
      total_volume: number;
    }>;
  };
  focus_exercises: Array<{
    exercise_name: string;
    total_volume?: number | undefined;
  }>;
  recent_workouts: Array<{
    workout_id: string;
    performed_at: string;
  }>;
  evidence: {
    workout_ids: string[];
    set_ids: string[];
    calculation_rules: string[];
  };
}

export interface WeeklyTrainingReportResult {
  range: {
    start_date: string;
    end_date: string;
  };
  status: "empty" | "ready";
  totals: {
    workout_count: number;
    set_count: number;
    total_reps: number;
    total_volume: number;
    total_weighted_volume: number;
  };
  frequency: {
    range_days: number;
    workouts_per_week: number;
  };
  top_exercises: Array<{
    exercise_name: string;
    set_count: number;
    total_volume: number;
  }>;
  top_muscle_groups: Array<{
    muscle_group_name: string;
    contribution_ratio: number;
  }>;
  low_volume_muscle_groups: Array<{
    muscle_group_name: string;
    contribution_ratio: number;
  }>;
  selected_exercise_progress: {
    exercise_name: string | null;
    workout_count: number;
    set_count: number;
    max_weight_kg: number | null;
    estimated_1rm_kg: number | null;
  } | null;
  recovery_notes: string[];
  limitations: string[];
  evidence: {
    workout_ids: string[];
    set_ids: string[];
    calculation_rules: string[];
  };
}

export interface AssistantAnswerCore {
  summary: string;
  bullets: string[];
  evidence: AssistantAnswerEvidence;
}

const RECOVERY_BOUNDARY_COPY =
  "我只能根据训练记录做一般性提醒，不能判断疼痛、疲劳或健康风险。如果有疼痛或不适，应优先休息或咨询专业人士。";

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function buildEvidence(
  toolName: string,
  result: unknown,
): AssistantAnswerEvidence {
  const record =
    typeof result === "object" && result !== null
      ? (result as { evidence?: unknown })
      : null;
  const evidenceRecord =
    record !== null &&
    typeof record.evidence === "object" &&
    record.evidence !== null
      ? (record.evidence as {
          workout_ids?: string[];
          set_ids?: string[];
          calculation_rules?: string[];
        })
      : null;

  return {
    source: "deterministic_tool_executor" as const,
    tool_names: [toolName],
    workout_ids: uniqueStrings(evidenceRecord?.workout_ids ?? []),
    set_ids: uniqueStrings(evidenceRecord?.set_ids ?? []),
    calculation_rules: uniqueStrings(evidenceRecord?.calculation_rules ?? []),
  };
}

/**
 * Render the exact tool-result range as an answer bullet.
 *
 * @param range - Inclusive date range carried by the tool result
 * @returns The range label shown to the user
 *
 * @remarks
 * Every data-bearing answer states the range it actually covers. The window is
 * whatever the date resolver produced for this turn, so prose must never name a
 * fixed window of its own: that is how "本周共记录 5 次" came to describe 30 days
 * of data. Reading `result.range` keeps the label and the numbers from drifting
 * apart.
 */
function formatStatRangeLabel(range: {
  start_date: string;
  end_date: string;
}): string {
  return `统计范围：${range.start_date} 到 ${range.end_date}`;
}

function buildMockProviderEvidence(): AssistantAnswerEvidence {
  return {
    source: "deterministic_mock_provider",
    tool_names: [],
    workout_ids: [],
    set_ids: [],
    calculation_rules: [],
  };
}

function completeAnswer(input: {
  summary: string;
  bullets: string[];
  evidence: AssistantAnswerEvidence;
  intent: AssistantRoutedIntent;
  recommendation?: string | undefined;
  limitations?: string[] | undefined;
}): AssistantStructuredAnswer {
  return {
    summary: input.summary,
    bullets: input.bullets,
    conclusion: input.summary,
    recommendation:
      input.recommendation ??
      "请结合最近训练记录、主观疲劳和动作状态保守调整训练安排。",
    evidence: input.evidence,
    sources: [],
    intent: input.intent,
    limitations: input.limitations ?? [],
  };
}

export function normalizeStructuredAnswer(
  answer: AssistantAnswerCore | AssistantStructuredAnswer,
  intent: AssistantRoutedIntent,
): AssistantStructuredAnswer {
  if (
    "intent" in answer &&
    "sources" in answer &&
    "limitations" in answer &&
    "conclusion" in answer &&
    "recommendation" in answer
  ) {
    return answer;
  }

  return completeAnswer({
    summary: answer.summary,
    bullets: answer.bullets,
    evidence: answer.evidence,
    intent,
  });
}

export function buildTrainingOverviewAnswer(
  result: TrainingOverviewResult,
): AssistantAnswerCore {
  const topExercise = result.by_exercise[0];

  if (result.totals.workout_count === 0) {
    return {
      summary:
        "根据当前时间范围内的训练记录，你还没有可用的训练数据。先完成几次训练，助手才能给出更有意义的总览和建议。",
      bullets: [
        formatStatRangeLabel(result.range),
        "当前训练次数：0 次",
        "当前训练量：0 kg",
      ],
      evidence: buildEvidence("get_training_summary", result),
    };
  }

  return {
    summary: `根据统计范围内的训练记录，你共训练了 ${result.totals.workout_count} 次，完成 ${result.totals.set_count} 组，累计 ${result.totals.total_reps} 次，总训练量约 ${formatMetricKg(result.totals.total_volume)}。`,
    bullets: [
      formatStatRangeLabel(result.range),
      topExercise
        ? `当前训练量最集中的动作是 ${topExercise.exercise_name}，累计约 ${formatMetricKg(topExercise.total_volume)}。`
        : "当前时间范围内还没有明显集中的主要动作。",
      `这个总结来自 ${result.evidence.workout_ids.length} 条已记录 workout。`,
      "这些数字来自已记录训练，不是模型凭空猜测。",
    ],
    evidence: buildEvidence("get_training_summary", result),
  };
}

export function buildExerciseProgressAnswer(
  result: ExerciseProgressResult,
): AssistantAnswerCore {
  const exerciseName = result.exercise.exercise_name ?? "当前动作";

  if (result.totals.workout_count === 0) {
    return {
      summary: `${exerciseName} 最近这段时间还没有训练记录，所以我暂时看不出这个动作的稳定进展。`,
      bullets: [
        formatStatRangeLabel(result.range),
        "当前训练次数：0 次",
        "你可以先记录这个动作，或者去“分析”页切换到已有数据的动作。",
      ],
      evidence: buildEvidence("get_exercise_progress", result),
    };
  }

  return {
    summary: `根据统计范围内的 ${exerciseName} 训练记录，当前估算 1RM 约为 ${formatMetricKg(result.totals.estimated_1rm_kg)}，观察到的最高训练重量约为 ${formatMetricKg(result.totals.max_weight_kg)}。`,
    bullets: [
      formatStatRangeLabel(result.range),
      `这个范围内共纳入 ${result.totals.workout_count} 次训练、${result.totals.set_count} 条相关训练组。`,
      `这个判断来自 ${result.evidence.workout_ids.length} 条 workout 和 ${result.evidence.set_ids.length} 条 set。`,
      "这里的 1RM 是训练信号，不是保证值，也不是医疗或专业教练建议。",
    ],
    evidence: buildEvidence("get_exercise_progress", result),
  };
}

export function buildWeeklyTrainingReportAnswer(
  result: WeeklyTrainingReportResult,
): AssistantAnswerCore {
  const topExercise = result.top_exercises[0];
  const topMuscleGroup = result.top_muscle_groups[0];
  const lowVolumeGroup = result.low_volume_muscle_groups[0];

  if (result.status === "empty") {
    return {
      summary:
        "这段时间还没有足够的训练记录生成周报。先记录几次包含组数、次数和重量的训练后，我就能总结频率、训练量、主要动作和肌群分布。",
      bullets: [
        `统计范围：${result.range.start_date} 到 ${result.range.end_date}。`,
        "当前记录训练次数：0 次。",
        "这个范围内还没有可用于动作或肌群分布分析的 Evidence。",
      ],
      evidence: buildEvidence("get_weekly_training_report", result),
    };
  }

  return {
    summary: `统计范围：${result.range.start_date} 到 ${result.range.end_date}。共记录 ${result.totals.workout_count} 次训练，${result.totals.set_count} 组，${result.totals.total_reps} 次，总训练量约 ${formatMetricKg(result.totals.total_volume)}。`,
    bullets: [
      `该统计范围内训练频率：${result.totals.workout_count} 次。`,
      `近 ${result.frequency.range_days} 天平均训练频率：约每周 ${result.frequency.workouts_per_week} 次，用于观察长期趋势。`,
      topExercise
        ? `该统计范围内主要训练动作是 ${topExercise.exercise_name}，共 ${topExercise.set_count} 组，总量约 ${formatMetricKg(topExercise.total_volume)}。`
        : "当前还没有明显的主要训练动作。",
      topMuscleGroup
        ? `记录中占比最高的肌群是 ${topMuscleGroup.muscle_group_name}，约 ${formatPercent(topMuscleGroup.contribution_ratio)}。`
        : "当前还没有明显占比最高的肌群。",
      lowVolumeGroup
        ? `记录较少的肌群是 ${lowVolumeGroup.muscle_group_name}，约 ${formatPercent(lowVolumeGroup.contribution_ratio)}。`
        : "当前还没有可识别的低记录量肌群。",
    ],
    evidence: buildEvidence("get_weekly_training_report", result),
  };
}

export function buildPlateauDiagnosisAnswer(input: {
  message: string;
  result: ExerciseProgressResult;
  sources: RetrievedKnowledgeChunk[];
}): AssistantStructuredAnswer {
  const evidence = buildEvidence("get_exercise_progress", input.result);
  const exerciseName =
    input.result.exercise.exercise_name ?? "selected exercise";
  const sources = input.sources.map((source) => ({
    id: source.id,
    title: source.title,
    category: source.category,
    chunk_text: source.chunk_text,
    source_type: source.source_type,
    tags: source.tags,
  }));

  return {
    summary: `${exerciseName} 的平台期诊断需要保持保守：我会先比较你的动作训练趋势，再结合训练知识 Sources 解释训练量、强度、恢复和渐进方式这些可能影响因素。`,
    bullets: [
      formatStatRangeLabel(input.result.range),
      `Evidence：${input.result.totals.workout_count} 次相关训练，${input.result.totals.set_count} 组，最高重量 ${formatMetricKg(input.result.totals.max_weight_kg)}，估算 1RM ${formatMetricKg(input.result.totals.estimated_1rm_kg)}。`,
      input.result.totals.workout_count < 3
        ? "样本还偏少，所以不能直接判定为真正的平台期。"
        : "样本已经可以做初步诊断，但短期表现波动仍然需要考虑。",
      sources.length > 0
        ? `Sources：${sources.map((source) => source.title).join("、")}。`
        : "这次诊断没有检索到可用训练知识来源。",
    ],
    conclusion:
      "平台期诊断不能默认训练量就是唯一原因。调整计划前，应该同时比较频率、有效组数、重量推进、RPE、动作质量和恢复。",
    recommendation:
      "下一步建议一次只调整一个变量：小幅增加周训练量、提高渐进一致性，或在近期强度很高时先降低疲劳。",
    evidence,
    sources,
    intent: "plateau_diagnosis",
    limitations: [
      "这是基于训练数据的诊断，不是医疗建议或专业教练处方。",
      "疼痛、伤病、睡眠、酸痛和动作质量无法完全从训练日志中判断。",
    ],
  };
}

export function buildRecommendationContextAnswer(
  mode: AssistantIntentMode,
  message: string,
  result: RecommendationContextResult,
): AssistantAnswerCore {
  if (result.summary.workout_count === 0) {
    return {
      summary:
        "当前还没有足够的训练记录可供判断。先记录几次训练后，我才能根据真实的 workout 和 set 给出更具体的解释。",
      bullets: [
        formatStatRangeLabel(result.range),
        "当前没有可用的训练量分布和最近训练记录。",
      ],
      evidence: buildEvidence("get_recommendation_context", result),
    };
  }

  switch (mode) {
    case "next_training_focus":
      return buildNextTrainingFocusAnswer(result);
    case "muscle_balance":
      return buildMuscleBalanceAnswer(message, result);
    case "training_imbalance":
      return buildTrainingImbalanceAnswer(result);
    case "recovery_check":
      return buildRecoveryCheckAnswer(message, result);
    case "evidence_explain":
      return buildEvidenceExplainAnswer(result);
    default:
      return buildEvidenceExplainAnswer(result);
  }
}

function buildNextTrainingFocusAnswer(
  result: RecommendationContextResult,
): AssistantAnswerCore {
  const dominantArea = inferDominantFocusArea(result.summary.by_exercise);
  const topExercise = result.summary.by_exercise[0];

  return {
    summary: `根据统计范围内的训练记录，下一次训练可以优先补${resolveNextFocusSuggestion(dominantArea)}。`,
    bullets: [
      formatStatRangeLabel(result.range),
      topExercise
        ? `你当前训练量最集中的动作是 ${topExercise.exercise_name}。`
        : "当前时间范围内还没有明显集中的主要动作。",
      "这个建议只是基于已记录训练量和最近训练分布的保守提醒，不是生产级教练方案。",
      "如果你的动作字典肌群信息还不完整，我会更多依据动作名称和训练量集中度来判断。",
    ],
    evidence: buildEvidence("get_recommendation_context", result),
  };
}

function buildMuscleBalanceAnswer(
  message: string,
  result: RecommendationContextResult,
): AssistantAnswerCore {
  const targetArea = detectTargetArea(message);
  const dominantArea = inferDominantFocusArea(result.summary.by_exercise);
  const topExercise = result.summary.by_exercise[0];

  const summary =
    targetArea === "unknown"
      ? "我会先根据最近训练量分布来判断你有没有明显忽略某一类动作。"
      : targetArea === dominantArea
        ? `从最近记录看，${describeTargetArea(targetArea)}相关训练并不算少，训练量已经比较靠前。`
        : `从最近记录看，${describeTargetArea(targetArea)}相关训练暂时不是最集中的部分，可能还有补充空间。`;

  return {
    summary: `${summary} 当前动作字典的肌群信息有限，所以这个判断主要基于动作名称和训练量分布。`,
    bullets: [
      formatStatRangeLabel(result.range),
      topExercise
        ? `当前训练量最集中的动作是 ${topExercise.exercise_name}。`
        : "当前时间范围内没有明显排在最前的动作。",
      `这个范围内共参考 ${result.summary.workout_count} 次训练和 ${result.summary.set_count} 组记录。`,
    ],
    evidence: buildEvidence("get_recommendation_context", result),
  };
}

function buildTrainingImbalanceAnswer(
  result: RecommendationContextResult,
): AssistantAnswerCore {
  const topExercises = result.summary.by_exercise.slice(0, 3);
  const topVolume = topExercises.reduce(
    (total, exercise) => total + exercise.total_volume,
    0,
  );
  const firstExercise = topExercises[0];
  const firstRatio =
    topVolume === 0 || !firstExercise
      ? 0
      : firstExercise.total_volume / topVolume;

  return {
    summary:
      firstRatio >= 0.55
        ? `最近训练量有一点集中在 ${firstExercise?.exercise_name ?? "少数动作"}，从分布上看存在一定偏科倾向。`
        : "最近训练量没有明显只堆在单一动作上，整体分布看起来还算相对均衡。",
    bullets: [
      formatStatRangeLabel(result.range),
      firstExercise
        ? `Top 3 动作里，第一位约占 ${(firstRatio * 100).toFixed(0)}% 的训练量。`
        : "当前时间范围内还没有明显的 top exercise 分布。",
      "这个判断主要来自统计范围内 top exercises 的训练量集中度，而不是模型主观猜测。",
    ],
    evidence: buildEvidence("get_recommendation_context", result),
  };
}

function buildRecoveryCheckAnswer(
  message: string,
  result: RecommendationContextResult,
): AssistantAnswerCore {
  const targetArea = detectTargetArea(message);
  const dominantArea = inferDominantFocusArea(result.summary.by_exercise);
  const latestWorkout = result.recent_workouts[0];
  const daysSince = latestWorkout
    ? getDaysSince(latestWorkout.performed_at)
    : null;
  const relationCopy =
    targetArea !== "unknown" && targetArea === dominantArea
      ? `${describeTargetArea(targetArea)}相关训练在你最近记录里出现得不算少。`
      : "从最近记录看，你确实有持续训练，但我不能只靠日志判断当天是否适合继续练同一部位。";

  return {
    summary: `${relationCopy} ${daysSince === null ? "" : `最近一次纳入参考的训练距离现在大约 ${daysSince} 天。 `}${RECOVERY_BOUNDARY_COPY}`,
    bullets: [
      formatStatRangeLabel(result.range),
      "这类提醒主要依据最近训练时间和训练量分布，不包含疼痛、睡眠、主观疲劳等信息。",
      "如果你今天有明显 soreness、疲劳或不适，应该优先休息而不是继续硬顶训练。",
    ],
    evidence: buildEvidence("get_recommendation_context", result),
  };
}

function buildEvidenceExplainAnswer(
  result: RecommendationContextResult,
): AssistantAnswerCore {
  return {
    summary:
      "这些判断来自已记录的 workout、set 和 calculation rules，不是模型凭空猜测。",
    bullets: [
      formatStatRangeLabel(result.range),
      `当前共参考 ${result.evidence.workout_ids.length} 条 workout、${result.evidence.set_ids.length} 条 set。`,
      `目前纳入 ${result.evidence.calculation_rules.length} 条 calculation rules。`,
      "如果当前动作字典的肌群信息不完整，我会更多依据动作名称、训练量和最近训练频率来解释。",
    ],
    evidence: buildEvidence("get_recommendation_context", result),
  };
}

export function buildProviderMessageAnswer(
  message: string,
): AssistantAnswerCore {
  return {
    summary: message,
    bullets: [],
    evidence: buildMockProviderEvidence(),
  };
}

export function buildProviderErrorFallbackGuidance(
  missingInputFields: string[],
): string {
  const fieldLabels = missingInputFields.map((field) =>
    field === "exercise_id"
      ? "要分析的动作"
      : field === "start_date"
        ? "开始日期"
        : field === "end_date"
          ? "结束日期"
          : field,
  );

  return `暂时无法完成这次训练数据查询。请先指定${fieldLabels.join("、")}，再重新提问。`;
}
