import { z } from "zod";

import {
  createChatMessage,
  createChatSession,
  findChatSessionByIdForUser,
  hasChatSessionById,
} from "../../db/chat-repository.js";
import { HttpError } from "../../utils/http-error.js";
import { executeAiTool } from "../ai/tools/tool-executor.js";
import {
  AiToolValidationError,
  isValidDateOnly,
} from "../ai/tools/tool-types.js";
import { runNextWeekPlanAgent } from "../agent/next-week-plan-agent.js";
import type {
  AgentTrace,
  NextWeekPlanDraft,
  PlanProfileContext,
} from "../agent/react-planner-types.js";
import { getAthleteProfile } from "../athlete-profile-service.js";
import {
  enforceFaithfulnessInDev,
  verifyAnswerFaithfulness,
  type AnswerFaithfulnessResult,
} from "./answer-faithfulness.js";
import {
  runAssistantAnswerPhrasing,
  runAssistantProvider,
} from "./provider-adapter.js";
import { coerceMessageToEvidenceToolCall } from "./assistant-provider-fallback.js";
import { applyFaithfulPhrasing } from "./answer-phrasing.js";
import { getToolDefinitionForMode } from "./assistant-tool-routing.js";
import {
  createGroqIntentRouter,
  type LlmIntentRouter,
} from "./llm-intent-router.js";
import {
  getConfiguredAssistantProvider,
  isAssistantAnswerPhrasingEnabled,
} from "./provider-config.js";
import {
  composeKnowledgeAnswer,
  composeMixedToolRagAnswer,
  composeUnsupportedAnswer,
  type AssistantAnswerEvidence,
  type AssistantStructuredAnswer,
} from "./assistant-answer-composer.js";
import {
  classifyAssistantIntent,
  isOutOfScopeMessage,
  type AssistantRoutedIntent,
} from "./assistant-intent-router.js";
import {
  filterRelevantKnowledgeChunks,
  retrieveKnowledgeChunks,
  tokenizeKnowledgeQuery,
} from "../rag/knowledge-retriever.js";
import { logRetrievalEvent } from "../rag/retrieval-observability.js";
import type {
  AssistantStreamEvent,
  AssistantStreamOptions,
} from "./assistant-stream-types.js";
import type {
  AssistantIntentMode,
  AssistantProviderRequest,
  AssistantProviderResponse,
  AssistantProviderToolDefinition,
  AssistantProviderUsage,
} from "./provider-types.js";

const assistantModeSchema = z.enum([
  "auto",
  "training_overview",
  "weekly_report",
  "exercise_progress",
  "plateau_diagnosis",
  "next_training_focus",
  "next_week_plan",
  "muscle_balance",
  "training_imbalance",
  "recovery_check",
  "evidence_explain",
  "unsupported",
]);

const mockAssistantTurnSchema = z
  .object({
    mode: assistantModeSchema,
    session_id: z.string().uuid().optional(),
    message: z.string().trim().min(1, "message is required."),
    start_date: z
      .string()
      .refine(isValidDateOnly, "start_date must use YYYY-MM-DD."),
    end_date: z
      .string()
      .refine(isValidDateOnly, "end_date must use YYYY-MM-DD."),
    exercise_id: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.start_date > value.end_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: "end_date must be on or after start_date.",
      });
    }
  });

interface TrainingOverviewResult {
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

interface ExerciseProgressResult {
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

interface RecommendationContextResult {
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

interface WeeklyTrainingReportResult {
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

export interface MockAssistantTurnInput {
  mode: AssistantIntentMode;
  session_id?: string | undefined;
  message: string;
  start_date: string;
  end_date: string;
  exercise_id?: string | undefined;
}

export interface MockAssistantTurnResponseData {
  session_id: string;
  message_id?: string | undefined;
  mode: string;
  assistant_type: "deterministic_mock";
  intent: AssistantRoutedIntent;
  tool_calls: Array<{
    tool_name: string;
    status: "success" | "error";
    duration_ms: number;
  }>;
  answer: AssistantStructuredAnswer;
  agent_trace?: AgentTrace | undefined;
  faithfulness?: AnswerFaithfulnessResult | undefined;
  plan?: NextWeekPlanDraft | undefined;
  /**
   * Aggregated LLM token usage for the turn (routing + optional phrasing calls).
   * Present only when a real provider (Groq) reported usage; absent on the mock
   * path. Surfaced for cost observability (Slice 11.3b / C1).
   */
  token_usage?: AssistantTurnTokenUsage | undefined;
}

/** Per-turn aggregated token usage (snake_case for the API/response DTO). */
export interface AssistantTurnTokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  llm_call_count: number;
}

interface PersistedTextBlock {
  type: "text";
  text: string;
}

interface ResolvedSession {
  sessionId: string;
}

interface ProviderSimulationResult {
  scenario: "default" | "message" | "error";
  normalizedMessage: string;
}

interface AssistantAnswerCore {
  summary: string;
  bullets: string[];
  evidence: AssistantAnswerEvidence;
}

type FocusArea = "back" | "chest" | "legs" | "mixed" | "shoulders" | "unknown";

const ANSWER_DELTA_CHUNK_SIZE = 24;
const RECOVERY_BOUNDARY_COPY =
  "我只能根据训练记录做一般性提醒，不能判断疼痛、疲劳或健康风险。如果有疼痛或不适，应优先休息或咨询专业人士。";

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function trimSessionTitle(message: string): string | null {
  const trimmed = message.trim().slice(0, 200);

  return trimmed.length > 0 ? trimmed : null;
}

function buildUserMessageContent(message: string): PersistedTextBlock[] {
  return [
    {
      type: "text",
      text: message,
    },
  ];
}

function buildAssistantMessageContent(
  answer: AssistantStructuredAnswer,
): PersistedTextBlock[] {
  const bulletLines = answer.bullets.map((bullet) => `- ${bullet}`);

  return [
    {
      type: "text",
      text:
        bulletLines.length === 0
          ? answer.summary
          : `${answer.summary}\n${bulletLines.join("\n")}`,
    },
  ];
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

function normalizeStructuredAnswer(
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

function buildTrainingOverviewAnswer(
  result: TrainingOverviewResult,
): AssistantAnswerCore {
  const topExercise = result.by_exercise[0];

  if (result.totals.workout_count === 0) {
    return {
      summary:
        "根据当前时间范围内的训练记录，你还没有可用的训练数据。先完成几次训练，助手才能给出更有意义的总览和建议。",
      bullets: [
        `统计范围：${result.range.start_date} 到 ${result.range.end_date}`,
        "当前训练次数：0 次",
        "当前训练量：0 kg",
      ],
      evidence: buildEvidence("get_training_summary", result),
    };
  }

  return {
    summary: `根据你最近这段时间的训练记录，你共训练了 ${result.totals.workout_count} 次，完成 ${result.totals.set_count} 组，累计 ${result.totals.total_reps} 次，总训练量约 ${result.totals.total_volume} kg。`,
    bullets: [
      topExercise
        ? `当前训练量最集中的动作是 ${topExercise.exercise_name}，累计约 ${topExercise.total_volume} kg。`
        : "当前时间范围内还没有明显集中的主要动作。",
      `这个总结来自 ${result.evidence.workout_ids.length} 条已记录 workout。`,
      "这些数字来自已记录训练，不是模型凭空猜测。",
    ],
    evidence: buildEvidence("get_training_summary", result),
  };
}

function buildExerciseProgressAnswer(
  result: ExerciseProgressResult,
): AssistantAnswerCore {
  const exerciseName = result.exercise.exercise_name ?? "当前动作";

  if (result.totals.workout_count === 0) {
    return {
      summary: `${exerciseName} 最近这段时间还没有训练记录，所以我暂时看不出这个动作的稳定进展。`,
      bullets: [
        `统计范围：${result.range.start_date} 到 ${result.range.end_date}`,
        "当前训练次数：0 次",
        "你可以先记录这个动作，或者去“分析”页切换到已有数据的动作。",
      ],
      evidence: buildEvidence("get_exercise_progress", result),
    };
  }

  return {
    summary: `根据你最近的 ${exerciseName} 训练记录，当前估算 1RM 约为 ${formatMetricKg(result.totals.estimated_1rm_kg)}，观察到的最高训练重量约为 ${formatMetricKg(result.totals.max_weight_kg)}。`,
    bullets: [
      `最近共纳入 ${result.totals.workout_count} 次训练、${result.totals.set_count} 条相关训练组。`,
      `这个判断来自 ${result.evidence.workout_ids.length} 条 workout 和 ${result.evidence.set_ids.length} 条 set。`,
      "这里的 1RM 是训练信号，不是保证值，也不是医疗或专业教练建议。",
    ],
    evidence: buildEvidence("get_exercise_progress", result),
  };
}

function buildWeeklyTrainingReportAnswer(
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
    summary: `本周共记录 ${result.totals.workout_count} 次训练，${result.totals.set_count} 组，${result.totals.total_reps} 次，总训练量约 ${result.totals.total_volume.toLocaleString()} kg。`,
    bullets: [
      `本周训练频率：${result.totals.workout_count} 次。`,
      `近 ${result.frequency.range_days} 天平均训练频率：约每周 ${result.frequency.workouts_per_week} 次，用于观察长期趋势。`,
      topExercise
        ? `本周主要训练动作是 ${topExercise.exercise_name}，共 ${topExercise.set_count} 组，总量约 ${topExercise.total_volume.toLocaleString()} kg。`
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

function buildPlateauDiagnosisAnswer(input: {
  message: string;
  result: ExerciseProgressResult;
  sources: Awaited<ReturnType<typeof retrieveKnowledgeChunks>>;
}): AssistantStructuredAnswer {
  const evidence = buildEvidence("get_exercise_progress", input.result);
  const exerciseName = input.result.exercise.exercise_name ?? "selected exercise";
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

function buildRecommendationContextAnswer(
  mode: AssistantIntentMode,
  message: string,
  result: RecommendationContextResult,
): AssistantAnswerCore {
  if (result.summary.workout_count === 0) {
    return {
      summary:
        "当前还没有足够的训练记录可供判断。先记录几次训练后，我才能根据真实的 workout 和 set 给出更具体的解释。",
      bullets: [
        `统计范围：${result.range.start_date} 到 ${result.range.end_date}`,
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
    summary: `根据你最近 30 天的训练记录，下一次训练可以优先补${resolveNextFocusSuggestion(dominantArea)}。`,
    bullets: [
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
      topExercise
        ? `当前训练量最集中的动作是 ${topExercise.exercise_name}。`
        : "当前时间范围内没有明显排在最前的动作。",
      `最近 30 天共参考 ${result.summary.workout_count} 次训练和 ${result.summary.set_count} 组记录。`,
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
      firstExercise
        ? `Top 3 动作里，第一位约占 ${(firstRatio * 100).toFixed(0)}% 的训练量。`
        : "当前时间范围内还没有明显的 top exercise 分布。",
      "这个判断主要来自最近 30 天 top exercises 的训练量集中度，而不是模型主观猜测。",
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
      `当前共参考 ${result.evidence.workout_ids.length} 条 workout、${result.evidence.set_ids.length} 条 set。`,
      `目前纳入 ${result.evidence.calculation_rules.length} 条 calculation rules。`,
      "如果当前动作字典的肌群信息不完整，我会更多依据动作名称、训练量和最近训练频率来解释。",
    ],
    evidence: buildEvidence("get_recommendation_context", result),
  };
}

function buildProviderMessageAnswer(message: string): AssistantAnswerCore {
  return {
    summary: message,
    bullets: [],
    evidence: buildMockProviderEvidence(),
  };
}

function createValidationHttpError(error: AiToolValidationError): HttpError {
  return new HttpError(400, error.code, error.message, {
    issues: error.issues,
  });
}

function parseProviderSimulation(message: string): ProviderSimulationResult {
  const trimmed = message.trim();

  if (trimmed.startsWith("[mock:text]")) {
    return {
      scenario: "message",
      normalizedMessage: trimmed.slice("[mock:text]".length).trim(),
    };
  }

  if (trimmed.startsWith("[mock:error]")) {
    return {
      scenario: "error",
      normalizedMessage: trimmed.slice("[mock:error]".length).trim(),
    };
  }

  return {
    scenario: "default",
    normalizedMessage: message,
  };
}

export async function resolveRoutedIntent(
  input: MockAssistantTurnInput,
  router: LlmIntentRouter | null,
): Promise<AssistantRoutedIntent> {
  if (input.mode === "auto") {
    const keywordIntent = classifyAssistantIntent(input.message).intent;

    // Fast path: a confident keyword match wins (deterministic, eval-stable, no LLM call).
    if (keywordIntent !== "unsupported") {
      return keywordIntent;
    }

    // Slice 11.2b: keyword fell through. Genuinely out-of-scope (blocklist/empty)
    // stays a refusal; otherwise let the LLM rescue-route into the known intent
    // set (validated upstream; null → unsupported). No LLM → keep deterministic.
    if (isOutOfScopeMessage(input.message)) {
      return "unsupported";
    }

    if (router === null) {
      return "unsupported";
    }

    return (await router.classify(input.message)) ?? "unsupported";
  }

  switch (input.mode) {
    case "training_overview":
      return "summary";
    case "weekly_report":
      return "weekly_report";
    case "exercise_progress":
      return "progress";
    case "plateau_diagnosis":
      return "plateau_diagnosis";
    case "next_week_plan":
      return "next_week_plan";
    case "next_training_focus":
    case "recovery_check":
      return "recommendation";
    case "muscle_balance":
    case "training_imbalance":
      return "imbalance";
    case "evidence_explain":
      return "evidence";
    case "unsupported":
      return "unsupported";
    default:
      return "unsupported";
  }
}

function resolveExecutionModeForIntent(
  input: MockAssistantTurnInput,
  intent: AssistantRoutedIntent,
): AssistantIntentMode {
  if (input.mode !== "auto") {
    return input.mode;
  }

  switch (intent) {
    case "weekly_report":
      return "weekly_report";
    case "plateau_diagnosis":
      return input.exercise_id ? "plateau_diagnosis" : "exercise_progress";
    case "next_week_plan":
      return "next_week_plan";
    case "summary":
    case "exercise_history":
      return "training_overview";
    case "progress":
      return input.exercise_id ? "exercise_progress" : "next_training_focus";
    case "imbalance":
      return "training_imbalance";
    case "recommendation":
      return "next_training_focus";
    case "evidence":
      return "evidence_explain";
    case "mixed_tool_rag":
      return "next_training_focus";
    case "knowledge":
    case "unsupported":
      return "unsupported";
  }
}

function getAllowedToolDefinitions(
  mode: MockAssistantTurnInput["mode"],
): AssistantProviderToolDefinition[] {
  const prioritizedTools = [
    getToolDefinitionForMode(mode),
    getToolDefinitionForMode("training_overview"),
    getToolDefinitionForMode("exercise_progress"),
    getToolDefinitionForMode("weekly_report"),
    getToolDefinitionForMode("next_training_focus"),
  ];

  return prioritizedTools.filter(
    (tool, index, tools) =>
      tools.findIndex((candidate) => candidate.name === tool.name) === index,
  );
}

function buildProviderRequest(
  input: MockAssistantTurnInput,
  executionMode: AssistantIntentMode,
): AssistantProviderRequest {
  const simulation = parseProviderSimulation(input.message);

  return {
    conversation: {
      user_message: input.message,
    },
    assistant_context: {
      mode: executionMode,
      start_date: input.start_date,
      end_date: input.end_date,
      exercise_id: input.exercise_id ?? null,
    },
    allowed_tools: getAllowedToolDefinitions(executionMode),
    simulation: {
      scenario: simulation.scenario,
      normalized_message: simulation.normalizedMessage,
    },
  };
}

function ensureAllowedProviderTool(
  response: AssistantProviderResponse,
  allowedTools: AssistantProviderToolDefinition[],
): void {
  if (response.kind !== "tool_call") {
    return;
  }

  const isAllowed = allowedTools.some(
    (tool) => tool.name === response.tool_name,
  );

  if (!isAllowed) {
    throw new HttpError(
      502,
      "AI_PROVIDER_ERROR",
      `Provider requested unsupported tool ${response.tool_name}.`,
    );
  }
}

async function resolveSession(
  userId: string,
  sessionId: string | undefined,
  message: string,
): Promise<ResolvedSession> {
  if (sessionId === undefined) {
    const session = await createChatSession({
      userId,
      title: trimSessionTitle(message),
    });

    return {
      sessionId: session.id,
    };
  }

  const ownedSession = await findChatSessionByIdForUser(sessionId, userId);

  if (ownedSession !== null) {
    return {
      sessionId: ownedSession.id,
    };
  }

  if (await hasChatSessionById(sessionId)) {
    throw new HttpError(
      403,
      "FORBIDDEN",
      "You cannot access this chat session.",
    );
  }

  throw new HttpError(404, "NOT_FOUND", "Chat session was not found.");
}

async function persistMockTurnMessages(input: {
  sessionId: string;
  request: MockAssistantTurnInput;
  response: MockAssistantTurnResponseData;
}): Promise<string> {
  await createChatMessage({
    sessionId: input.sessionId,
    role: "user",
    content: buildUserMessageContent(input.request.message),
    structuredOutput: null,
    usage: null,
    metadata: {
      mode: input.request.mode,
      start_date: input.request.start_date,
      end_date: input.request.end_date,
      exercise_id: input.request.exercise_id ?? null,
    },
  });

  const assistantMessage = await createChatMessage({
    sessionId: input.sessionId,
    role: "assistant",
    content: buildAssistantMessageContent(input.response.answer),
    structuredOutput: input.response,
    usage: null,
    metadata: {
      assistant_type: input.response.assistant_type,
      mode: input.response.mode,
      tool_names: input.response.answer.evidence.tool_names,
    },
  });

  return assistantMessage.id;
}

async function emitEvent(
  options: AssistantStreamOptions | undefined,
  event: AssistantStreamEvent,
): Promise<void> {
  await options?.onEvent?.(event);
}

function formatAnswerText(
  answer: MockAssistantTurnResponseData["answer"],
): string {
  const bulletLines = answer.bullets.map((bullet) => `- ${bullet}`);

  return bulletLines.length === 0
    ? answer.summary
    : `${answer.summary}\n${bulletLines.join("\n")}`;
}

function buildAnswerDeltas(
  answer: MockAssistantTurnResponseData["answer"],
): string[] {
  const formattedAnswer = formatAnswerText(answer);

  if (formattedAnswer.length === 0) {
    return [];
  }

  const chunks: string[] = [];

  for (
    let startIndex = 0;
    startIndex < formattedAnswer.length;
    startIndex += ANSWER_DELTA_CHUNK_SIZE
  ) {
    chunks.push(
      formattedAnswer.slice(startIndex, startIndex + ANSWER_DELTA_CHUNK_SIZE),
    );
  }

  return chunks;
}

async function emitAnswerEvents(
  answer: AssistantStructuredAnswer,
  options: AssistantStreamOptions | undefined,
): Promise<void> {
  await emitEvent(options, {
    type: "state",
    state: "answering",
  });

  for (const chunk of buildAnswerDeltas(answer)) {
    await emitEvent(options, {
      type: "answer_delta",
      text: chunk,
    });
  }
}

function buildToolAnswer(
  input: MockAssistantTurnInput,
  toolName: string,
  result: unknown,
): AssistantAnswerCore {
  if (toolName === "get_training_summary") {
    return buildTrainingOverviewAnswer(result as TrainingOverviewResult);
  }

  if (toolName === "get_exercise_progress") {
    return buildExerciseProgressAnswer(result as ExerciseProgressResult);
  }

  if (toolName === "get_weekly_training_report") {
    return buildWeeklyTrainingReportAnswer(result as WeeklyTrainingReportResult);
  }

  return buildRecommendationContextAnswer(
    input.mode,
    input.message,
    result as RecommendationContextResult,
  );
}

/**
 * Aggregate per-call provider usages into one turn-level token total.
 *
 * @param usages - Usage from each LLM call this turn; `undefined` entries (mock /
 *   draft-fallback) are ignored.
 * @returns Aggregated usage with the reporting-call count, or `undefined` when no
 *   call reported usage (the deterministic mock path).
 */
function aggregateTurnTokenUsage(
  usages: ReadonlyArray<AssistantProviderUsage | undefined>,
): AssistantTurnTokenUsage | undefined {
  const reported = usages.filter(
    (usage): usage is AssistantProviderUsage => usage !== undefined,
  );

  if (reported.length === 0) {
    return undefined;
  }

  return {
    prompt_tokens: reported.reduce((sum, usage) => sum + usage.prompt_tokens, 0),
    completion_tokens: reported.reduce(
      (sum, usage) => sum + usage.completion_tokens,
      0,
    ),
    total_tokens: reported.reduce((sum, usage) => sum + usage.total_tokens, 0),
    llm_call_count: reported.length,
  };
}

export async function runMockAssistantTurn(
  userId: string,
  rawInput: unknown,
  options?: AssistantStreamOptions,
): Promise<MockAssistantTurnResponseData> {
  await emitEvent(options, {
    type: "state",
    state: "thinking",
  });

  const input = mockAssistantTurnSchema.parse(rawInput);
  const resolvedSession = await resolveSession(
    userId,
    input.session_id,
    input.message,
  );
  await emitEvent(options, {
    type: "session",
    session_id: resolvedSession.sessionId,
  });
  const intentRouter =
    options?.intentRouter !== undefined
      ? options.intentRouter
      : getConfiguredAssistantProvider() === "groq"
        ? createGroqIntentRouter()
        : null;
  const intent = await resolveRoutedIntent(input, intentRouter);
  const executionMode = resolveExecutionModeForIntent(input, intent);

  if (intent === "unsupported") {
    // Slice 11a：没听懂的提问不要直接死给。明显越界（黑名单/空）保持澄清式拒答；
    // 否则用 tokenizeKnowledgeQuery 当相关性闸门（纯无关查询返回空 token，避免向量乱答），
    // 有训练知识锚点就检索——命中知识用知识答（更有用、带 Sources + 免责），否则退回澄清。
    const canTryKnowledgeFallback =
      !isOutOfScopeMessage(input.message) &&
      tokenizeKnowledgeQuery(input.message).length > 0;
    let answer = composeUnsupportedAnswer(input.message);

    if (canTryKnowledgeFallback) {
      await emitEvent(options, {
        type: "state",
        state: "retrieving",
      });

      const retrieved = await retrieveKnowledgeChunks(input.message);
      // Slice 11a 修订（B 相关性下限）：只用与查询有词法重叠的来源，
      // 召回不够相关就退回澄清，不拿"语义最近的错 chunk"自信错答。
      const sources = filterRelevantKnowledgeChunks(retrieved, input.message);

      logRetrievalEvent({
        intent: "knowledge",
        retrievalMode: retrieved[0]?.retrieval_mode ?? "fallback",
        sources,
        fallbackReason: sources.length === 0 ? "no_relevant_sources" : undefined,
      });

      if (sources.length > 0) {
        answer = composeKnowledgeAnswer({ message: input.message, sources });
      }
    }

    await emitAnswerEvents(answer, options);

    const response: MockAssistantTurnResponseData = {
      session_id: resolvedSession.sessionId,
      mode: input.mode,
      assistant_type: "deterministic_mock",
      // 知识兜底命中时按实际行为记 knowledge，让观测/持久化更诚实；否则仍是 unsupported。
      intent: answer.intent,
      tool_calls: [],
      answer,
    };

    const messageId = await persistMockTurnMessages({
      sessionId: resolvedSession.sessionId,
      request: input,
      response,
    });
    response.message_id = messageId;

    await emitEvent(options, {
      type: "structured_output",
      output: response,
    });
    await emitEvent(options, {
      type: "done",
      message_id: messageId,
      session_id: resolvedSession.sessionId,
    });

    return response;
  }

  if (intent === "knowledge") {
    await emitEvent(options, {
      type: "state",
      state: "retrieving",
    });

    const retrieved = await retrieveKnowledgeChunks(input.message);
    // B 相关性下限：知识库很小，向量召回会返回"语义最近"的无关 chunk → 自信错答。
    // 只保留与查询有词法重叠的来源；无相关来源时 composeKnowledgeAnswer 会诚实回退到"没找到可靠资料"。
    const sources = filterRelevantKnowledgeChunks(retrieved, input.message);

    logRetrievalEvent({
      intent,
      retrievalMode: retrieved[0]?.retrieval_mode ?? "fallback",
      sources,
      fallbackReason: sources.length === 0 ? "no_relevant_sources" : undefined,
    });

    const answer = composeKnowledgeAnswer({
      message: input.message,
      sources,
    });

    await emitAnswerEvents(answer, options);

    const response: MockAssistantTurnResponseData = {
      session_id: resolvedSession.sessionId,
      mode: input.mode,
      assistant_type: "deterministic_mock",
      intent,
      tool_calls: [],
      answer,
    };

    const messageId = await persistMockTurnMessages({
      sessionId: resolvedSession.sessionId,
      request: input,
      response,
    });
    response.message_id = messageId;

    await emitEvent(options, {
      type: "structured_output",
      output: response,
    });
    await emitEvent(options, {
      type: "done",
      message_id: messageId,
      session_id: resolvedSession.sessionId,
    });

    return response;
  }

  if (intent === "next_week_plan") {
    return runNextWeekPlanAgentTurn({
      userId,
      input,
      intent,
      sessionId: resolvedSession.sessionId,
      options,
    });
  }

  const providerRequest = buildProviderRequest(input, executionMode);

  await emitEvent(options, {
    type: "provider_selected",
    provider: getConfiguredAssistantProvider(),
  });

  const rawProviderResponse = await runAssistantProvider(providerRequest);

  if (rawProviderResponse.kind === "error") {
    const error = new HttpError(
      502,
      "AI_PROVIDER_ERROR",
      rawProviderResponse.message,
      {
        provider_error_code: rawProviderResponse.error_code,
      },
    );

    await emitEvent(options, {
      type: "error",
      code: error.code,
      message: error.message,
    });

    throw error;
  }

  // Slice 11.2a safety net: provider-path intents are all data questions, so if
  // the provider answered in prose (no tool), run the mode's default tool instead
  // of degrading to a generic non-answer (fixes routing issue ①, provider-agnostic).
  const providerResponse = coerceMessageToEvidenceToolCall(
    rawProviderResponse,
    getToolDefinitionForMode(executionMode),
    {
      start_date: input.start_date,
      end_date: input.end_date,
      exercise_id: input.exercise_id,
    },
  );

  // C1 token/cost observability: capture the routing call's usage (kept off the
  // synthesized coercion result), and the phrasing call's usage if it runs.
  const routingUsage = rawProviderResponse.usage;
  let phrasingUsage: AssistantProviderUsage | undefined;

  const toolCalls: MockAssistantTurnResponseData["tool_calls"] = [];
  const toolOutputs: unknown[] = [];
  let answer: AssistantStructuredAnswer;

  if (providerResponse.kind === "message") {
    answer = normalizeStructuredAnswer(
      buildProviderMessageAnswer(providerResponse.message),
      intent,
    );
    await emitAnswerEvents(answer, options);
  } else {
    ensureAllowedProviderTool(providerResponse, providerRequest.allowed_tools);
    await emitEvent(options, {
      type: "state",
      state: "tool_calling",
    });
    await emitEvent(options, {
      type: "tool_call_started",
      tool_name: providerResponse.tool_name,
    });

    const startedAt = Date.now();
    let result: unknown;

    try {
      result = await executeAiTool(
        { userId },
        providerResponse.tool_name,
        providerResponse.tool_args,
      );

      const durationMs = Math.max(0, Date.now() - startedAt);
      toolCalls.push({
        tool_name: providerResponse.tool_name,
        status: "success",
        duration_ms: durationMs,
      });
      toolOutputs.push(result);
      await emitEvent(options, {
        type: "tool_call_finished",
        tool_name: providerResponse.tool_name,
        status: "success",
        duration_ms: durationMs,
      });
    } catch (error) {
      const durationMs = Math.max(0, Date.now() - startedAt);
      toolCalls.push({
        tool_name: providerResponse.tool_name,
        status: "error",
        duration_ms: durationMs,
      });
      await emitEvent(options, {
        type: "tool_call_finished",
        tool_name: providerResponse.tool_name,
        status: "error",
        duration_ms: durationMs,
      });

      if (error instanceof AiToolValidationError) {
        throw createValidationHttpError(error);
      }

      throw error;
    }

    if (intent === "mixed_tool_rag") {
      await emitEvent(options, {
        type: "state",
        state: "retrieving",
      });
      const retrieved = await retrieveKnowledgeChunks(input.message);
      // D33 相关性下限：混合诊断也只用与查询有词法重叠的来源，
      // 召回不够相关就不附 Sources（composer 会显示"暂无训练知识来源"），
      // 不拿"语义最近的错 chunk"自信错引用。
      const sources = filterRelevantKnowledgeChunks(retrieved, input.message);

      logRetrievalEvent({
        intent,
        retrievalMode: retrieved[0]?.retrieval_mode ?? "fallback",
        sources,
        fallbackReason: sources.length === 0 ? "no_relevant_sources" : undefined,
      });

      answer = composeMixedToolRagAnswer({
        message: input.message,
        sources,
        toolEvidence: buildEvidence(providerResponse.tool_name, result),
      });
    } else if (intent === "plateau_diagnosis") {
      await emitEvent(options, {
        type: "state",
        state: "retrieving",
      });
      const retrieved = await retrieveKnowledgeChunks(input.message);
      // D33 相关性下限：平台期诊断同样只用词法相关的来源；无相关来源时
      // 诊断仍基于确定性进展数据给出，但不附会误导的"最近 chunk"。
      const sources = filterRelevantKnowledgeChunks(retrieved, input.message);

      logRetrievalEvent({
        intent,
        retrievalMode: retrieved[0]?.retrieval_mode ?? "fallback",
        sources,
        fallbackReason: sources.length === 0 ? "no_relevant_sources" : undefined,
      });

      answer = buildPlateauDiagnosisAnswer({
        message: input.message,
        result: result as ExerciseProgressResult,
        sources,
      });
    } else {
      answer = normalizeStructuredAnswer(
        buildToolAnswer(
          {
            ...input,
            mode: executionMode,
          },
          providerResponse.tool_name,
          result,
        ),
        intent,
      );
    }

    // Slice 11.3b: optional LLM re-phrasing of the summary, gated by env + provider
    // and the runtime faithfulness check. The model only re-words `answer.summary`;
    // a rewrite that introduces an unverified number is rejected and we keep the
    // deterministic draft (numbers/conclusions stay deterministic + evidence-bound).
    if (isAssistantAnswerPhrasingEnabled()) {
      const phrasing = await runAssistantAnswerPhrasing({
        draftSummary: answer.summary,
        supportingFacts: answer.bullets,
      });
      phrasingUsage = phrasing.usage;
      answer = applyFaithfulPhrasing(answer, phrasing.summary, (candidate) =>
        verifyAnswerFaithfulness(candidate, toolOutputs),
      ).answer;
    }

    await emitAnswerEvents(answer, options);
  }

  const faithfulness =
    toolOutputs.length > 0
      ? verifyAnswerFaithfulness(answer, toolOutputs)
      : undefined;
  if (faithfulness) {
    enforceFaithfulnessInDev(faithfulness);
  }

  const response: MockAssistantTurnResponseData = {
    session_id: resolvedSession.sessionId,
    mode: input.mode,
    assistant_type: "deterministic_mock",
    intent,
    tool_calls: toolCalls,
    answer,
    faithfulness,
    token_usage: aggregateTurnTokenUsage([routingUsage, phrasingUsage]),
  };

  const messageId = await persistMockTurnMessages({
    sessionId: resolvedSession.sessionId,
    request: input,
    response,
  });
  response.message_id = messageId;

  await emitEvent(options, {
    type: "structured_output",
    output: response,
  });

  await emitEvent(options, {
    type: "done",
    message_id: messageId,
    session_id: resolvedSession.sessionId,
  });

  return response;
}

async function runNextWeekPlanAgentTurn(args: {
  userId: string;
  input: MockAssistantTurnInput;
  intent: AssistantRoutedIntent;
  sessionId: string;
  options: AssistantStreamOptions | undefined;
}): Promise<MockAssistantTurnResponseData> {
  const { userId, input, intent, sessionId, options } = args;

  await emitEvent(options, {
    type: "provider_selected",
    provider: getConfiguredAssistantProvider(),
  });
  await emitEvent(options, {
    type: "state",
    state: "planning",
  });

  let agentOutput: Awaited<ReturnType<typeof runNextWeekPlanAgent>>;
  // 聚合 agent 跨步实际执行过的工具结果集，供 faithfulness 校验使用。
  const capturedToolOutputs: unknown[] = [];
  // 运动员档案注入计划生成（个性化 + 安全）；加载失败不影响规划。
  const profile = await loadPlanProfile(userId);

  try {
    agentOutput = await runNextWeekPlanAgent(
      {
        message: input.message,
        startDate: input.start_date,
        endDate: input.end_date,
        exerciseId: input.exercise_id ?? null,
        profile,
      },
      {
        runTool: async (toolName, toolArgs) => {
          const result = await executeAiTool({ userId }, toolName, toolArgs);
          capturedToolOutputs.push(result);
          return result;
        },
        retrieve: async (query) => {
          const sources = await retrieveKnowledgeChunks(query);

          logRetrievalEvent({
            intent,
            retrievalMode: sources[0]?.retrieval_mode ?? "fallback",
            sources,
            fallbackReason: sources.length === 0 ? "no_sources" : undefined,
          });

          return sources;
        },
        onStep: async (event) => {
          if (event.phase === "started") {
            await emitEvent(options, {
              type: "agent_step_started",
              index: event.index,
              kind: event.kind,
              title: event.title,
              thought: event.thought,
              tool_name: event.tool_name,
            });
            return;
          }

          await emitEvent(options, {
            type: "agent_step_finished",
            index: event.index,
            status: event.status,
            duration_ms: event.duration_ms,
            observation: event.observation,
          });
        },
      },
    );
  } catch (error) {
    if (error instanceof AiToolValidationError) {
      await emitEvent(options, {
        type: "error",
        code: error.code,
        message: error.message,
      });

      throw createValidationHttpError(error);
    }

    const message =
      error instanceof Error ? error.message : "Next-week-plan agent failed.";

    await emitEvent(options, {
      type: "error",
      code: "AGENT_ERROR",
      message,
    });

    throw error;
  }

  await emitAnswerEvents(agentOutput.answer, options);

  const faithfulness =
    capturedToolOutputs.length > 0
      ? verifyAnswerFaithfulness(agentOutput.answer, capturedToolOutputs)
      : undefined;
  if (faithfulness) {
    enforceFaithfulnessInDev(faithfulness);
  }

  const response: MockAssistantTurnResponseData = {
    session_id: sessionId,
    mode: input.mode,
    assistant_type: "deterministic_mock",
    intent,
    tool_calls: agentOutput.tool_calls,
    answer: agentOutput.answer,
    agent_trace: agentOutput.trace,
    faithfulness,
    plan: agentOutput.plan,
  };

  const messageId = await persistMockTurnMessages({
    sessionId,
    request: input,
    response,
  });
  response.message_id = messageId;

  await emitEvent(options, {
    type: "structured_output",
    output: response,
  });

  await emitEvent(options, {
    type: "done",
    message_id: messageId,
    session_id: sessionId,
  });

  return response;
}

async function loadPlanProfile(
  userId: string,
): Promise<PlanProfileContext | null> {
  try {
    const dto = await getAthleteProfile(userId);

    return dto === null
      ? null
      : {
          goal: dto.goal,
          weeklyDays: dto.weeklyDays,
          injuryConstraints: dto.injuryConstraints,
        };
  } catch {
    // Personalization is best-effort; a profile load failure must not break planning.
    return null;
  }
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

function inferFocusAreaFromName(exerciseName: string): FocusArea {
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
      return "训练记录相对较少的部位";
  }
}

function detectTargetArea(message: string): FocusArea {
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

function describeTargetArea(area: FocusArea): string {
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

function formatMetricKg(value: number | null): string {
  if (value === null) {
    return "暂无结果";
  }

  return `${value.toLocaleString()} kg`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function getDaysSince(value: string): number {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  const diff = Math.max(0, Date.now() - date.getTime());

  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
