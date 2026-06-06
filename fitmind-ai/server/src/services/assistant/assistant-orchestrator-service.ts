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
import { runAssistantProvider } from "./provider-adapter.js";
import { getConfiguredAssistantProvider } from "./provider-config.js";
import {
  composeKnowledgeAnswer,
  composeMixedToolRagAnswer,
  composeUnsupportedAnswer,
  type AssistantAnswerEvidence,
  type AssistantStructuredAnswer,
} from "./assistant-answer-composer.js";
import {
  classifyAssistantIntent,
  type AssistantRoutedIntent,
} from "./assistant-intent-router.js";
import { retrieveKnowledgeChunks } from "../rag/knowledge-retriever.js";
import type {
  AssistantStreamEvent,
  AssistantStreamOptions,
} from "./assistant-stream-types.js";
import type {
  AssistantIntentMode,
  AssistantProviderRequest,
  AssistantProviderResponse,
  AssistantProviderToolDefinition,
} from "./provider-types.js";

const assistantModeSchema = z.enum([
  "auto",
  "training_overview",
  "exercise_progress",
  "next_training_focus",
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
  mode: string;
  assistant_type: "deterministic_mock";
  intent: AssistantRoutedIntent;
  tool_calls: Array<{
    tool_name: string;
    status: "success" | "error";
    duration_ms: number;
  }>;
  answer: AssistantStructuredAnswer;
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

function getToolDefinitionForMode(
  mode: MockAssistantTurnInput["mode"],
): AssistantProviderToolDefinition {
  switch (mode) {
    case "auto":
      return {
        name: "get_recommendation_context",
        description: "Return a deterministic recommendation context package.",
        input_fields: ["start_date", "end_date"],
      };
    case "training_overview":
      return {
        name: "get_training_summary",
        description: "Return one deterministic training range summary.",
        input_fields: ["start_date", "end_date"],
      };
    case "exercise_progress":
      return {
        name: "get_exercise_progress",
        description: "Return deterministic progress data for one exercise.",
        input_fields: ["exercise_id", "start_date", "end_date"],
      };
    case "next_training_focus":
    case "muscle_balance":
    case "training_imbalance":
    case "recovery_check":
    case "evidence_explain":
    case "unsupported":
      return {
        name: "get_recommendation_context",
        description: "Return a deterministic recommendation context package.",
        input_fields: ["start_date", "end_date"],
      };
  }
}

function resolveRoutedIntent(
  input: MockAssistantTurnInput,
): AssistantRoutedIntent {
  if (input.mode === "auto") {
    return classifyAssistantIntent(input.message).intent;
  }

  switch (input.mode) {
    case "training_overview":
      return "summary";
    case "exercise_progress":
      return "progress";
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
}): Promise<void> {
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

  await createChatMessage({
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

  return buildRecommendationContextAnswer(
    input.mode,
    input.message,
    result as RecommendationContextResult,
  );
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
  const intent = resolveRoutedIntent(input);
  const executionMode = resolveExecutionModeForIntent(input, intent);

  if (intent === "unsupported") {
    const answer = composeUnsupportedAnswer(input.message);

    await emitAnswerEvents(answer, options);

    const response: MockAssistantTurnResponseData = {
      session_id: resolvedSession.sessionId,
      mode: input.mode,
      assistant_type: "deterministic_mock",
      intent,
      tool_calls: [],
      answer,
    };

    await persistMockTurnMessages({
      sessionId: resolvedSession.sessionId,
      request: input,
      response,
    });

    await emitEvent(options, {
      type: "structured_output",
      output: response,
    });
    await emitEvent(options, {
      type: "done",
      session_id: resolvedSession.sessionId,
    });

    return response;
  }

  if (intent === "knowledge") {
    await emitEvent(options, {
      type: "state",
      state: "retrieving",
    });

    const answer = composeKnowledgeAnswer({
      message: input.message,
      sources: retrieveKnowledgeChunks(input.message),
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

    await persistMockTurnMessages({
      sessionId: resolvedSession.sessionId,
      request: input,
      response,
    });

    await emitEvent(options, {
      type: "structured_output",
      output: response,
    });
    await emitEvent(options, {
      type: "done",
      session_id: resolvedSession.sessionId,
    });

    return response;
  }

  const providerRequest = buildProviderRequest(input, executionMode);

  await emitEvent(options, {
    type: "provider_selected",
    provider: getConfiguredAssistantProvider(),
  });

  const providerResponse = await runAssistantProvider(providerRequest);

  if (providerResponse.kind === "error") {
    const error = new HttpError(
      502,
      "AI_PROVIDER_ERROR",
      providerResponse.message,
      {
        provider_error_code: providerResponse.error_code,
      },
    );

    await emitEvent(options, {
      type: "error",
      code: error.code,
      message: error.message,
    });

    throw error;
  }

  const toolCalls: MockAssistantTurnResponseData["tool_calls"] = [];
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
      answer = composeMixedToolRagAnswer({
        message: input.message,
        sources: retrieveKnowledgeChunks(input.message),
        toolEvidence: buildEvidence(providerResponse.tool_name, result),
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
    await emitAnswerEvents(answer, options);
  }

  const response: MockAssistantTurnResponseData = {
    session_id: resolvedSession.sessionId,
    mode: input.mode,
    assistant_type: "deterministic_mock",
    intent,
    tool_calls: toolCalls,
    answer,
  };

  await persistMockTurnMessages({
    sessionId: resolvedSession.sessionId,
    request: input,
    response,
  });

  await emitEvent(options, {
    type: "structured_output",
    output: response,
  });

  await emitEvent(options, {
    type: "done",
    session_id: resolvedSession.sessionId,
  });

  return response;
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

function getDaysSince(value: string): number {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  const diff = Math.max(0, Date.now() - date.getTime());

  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
