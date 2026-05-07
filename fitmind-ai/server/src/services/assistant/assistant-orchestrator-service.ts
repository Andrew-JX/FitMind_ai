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
import type {
  AssistantStreamEvent,
  AssistantStreamOptions,
} from "./assistant-stream-types.js";
import type {
  AssistantProviderRequest,
  AssistantProviderResponse,
  AssistantProviderToolDefinition,
} from "./provider-types.js";

const assistantModeSchema = z.enum([
  "training_overview",
  "exercise_progress",
  "recommendation_context",
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
  }>;
  recent_workouts: Array<{
    workout_id: string;
  }>;
  evidence: {
    workout_ids: string[];
    set_ids: string[];
    calculation_rules: string[];
  };
}

export interface MockAssistantTurnInput {
  mode: "training_overview" | "exercise_progress" | "recommendation_context";
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
  tool_calls: Array<{
    tool_name: string;
    status: "success" | "error";
    duration_ms: number;
  }>;
  answer: {
    summary: string;
    bullets: string[];
    evidence: {
      source: "deterministic_tool_executor" | "deterministic_mock_provider";
      tool_names: string[];
      workout_ids: string[];
      set_ids: string[];
      calculation_rules: string[];
    };
  };
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

const ANSWER_DELTA_CHUNK_SIZE = 24;

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
  answer: MockAssistantTurnResponseData["answer"],
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

function buildEvidence(toolName: string, result: unknown) {
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

function buildMockProviderEvidence(): MockAssistantTurnResponseData["answer"]["evidence"] {
  return {
    source: "deterministic_mock_provider",
    tool_names: [],
    workout_ids: [],
    set_ids: [],
    calculation_rules: [],
  };
}

function buildTrainingOverviewAnswer(
  result: TrainingOverviewResult,
): MockAssistantTurnResponseData["answer"] {
  const topExercise = result.by_exercise[0];

  if (result.totals.workout_count === 0) {
    return {
      summary:
        "最近 30 天还没有训练记录。先完成一次训练，系统就能为你生成训练总览和 AI 可用上下文。",
      bullets: [
        `统计范围：${result.range.start_date} 至 ${result.range.end_date}`,
        "训练次数：0 次",
        "训练容量：0 kg",
      ],
      evidence: buildEvidence("get_training_summary", result),
    };
  }

  return {
    summary: `最近 30 天你共记录了 ${result.totals.workout_count} 次训练、${result.totals.set_count} 组训练组，总次数 ${result.totals.total_reps} 次，总训练容量 ${result.totals.total_volume} kg。`,
    bullets: [
      topExercise === undefined
        ? "当前范围内还没有主要训练动作。"
        : `当前主要训练动作是 ${topExercise.exercise_name}，总容量为 ${topExercise.total_volume} kg。`,
      `本次分析基于 ${result.evidence.workout_ids.length} 条 workout 记录。`,
      `统计范围：${result.range.start_date} 至 ${result.range.end_date}`,
    ],
    evidence: buildEvidence("get_training_summary", result),
  };
}

function buildExerciseProgressAnswer(
  result: ExerciseProgressResult,
): MockAssistantTurnResponseData["answer"] {
  const exerciseName = result.exercise.exercise_name ?? "当前动作";

  if (result.totals.workout_count === 0) {
    return {
      summary: `最近 30 天里还没有 ${exerciseName} 的训练记录，暂时无法给出 1RM 或进展结果。`,
      bullets: [
        `统计范围：${result.range.start_date} 至 ${result.range.end_date}`,
        "最近训练次数：0 次",
        "请先记录这个动作，或在分析页切换到已有数据的动作。",
      ],
      evidence: buildEvidence("get_exercise_progress", result),
    };
  }

  return {
    summary: `根据你最近的 ${exerciseName} 训练记录，当前系统预估你的 1RM 约为 ${result.totals.estimated_1rm_kg ?? "暂无结果"} kg。这个结果来自后端确定性计算规则，而不是模型猜测。`,
    bullets: [
      `最近记录中最高训练重量为 ${result.totals.max_weight_kg ?? "暂无结果"} kg。`,
      `最近 ${result.sessions.length} 次记录共关联 ${result.evidence.workout_ids.length} 条 workout 和 ${result.evidence.set_ids.length} 条 set。`,
      `calculation_rules：${result.evidence.calculation_rules[0] ?? "当前未返回规则说明"}`,
    ],
    evidence: buildEvidence("get_exercise_progress", result),
  };
}

function buildRecommendationContextAnswer(
  result: RecommendationContextResult,
): MockAssistantTurnResponseData["answer"] {
  const topExercise = result.summary.by_exercise[0];

  if (result.summary.workout_count === 0) {
    return {
      summary:
        "当前还没有可用于推荐上下文的训练记录。先完成训练记录，系统才会生成可供助手读取的确定性上下文。",
      bullets: [
        `统计范围：${result.range.start_date} 至 ${result.range.end_date}`,
        "重点动作：0 个",
        "最近训练：0 条",
      ],
      evidence: buildEvidence("get_recommendation_context", result),
    };
  }

  return {
    summary: `AI 助手当前会读取一份确定性上下文预览，其中包含 ${result.summary.workout_count} 次训练、${result.summary.set_count} 组训练组、${result.summary.total_reps} 次总次数和 ${result.summary.total_volume} kg 总容量。`,
    bullets: [
      `这是一份 deterministic context preview，不是 AI 自动生成的训练建议。`,
      `当前重点动作 ${result.focus_exercises.length} 个，最近训练 ${result.recent_workouts.length} 条。`,
      topExercise === undefined
        ? "当前范围内没有可展示的主要动作。"
        : `主要动作是 ${topExercise.exercise_name}，总容量为 ${topExercise.total_volume} kg。`,
    ],
    evidence: buildEvidence("get_recommendation_context", result),
  };
}

function buildProviderMessageAnswer(
  mode: MockAssistantTurnInput["mode"],
  message: string,
): MockAssistantTurnResponseData["answer"] {
  const isProductMessage =
    !message.startsWith("Deterministic mock provider message:") &&
    !message.startsWith("Deterministic mock provider error:");

  return {
    summary: message,
    bullets: isProductMessage
      ? ["本次没有执行内部工具调用。"]
      : [`Mode: ${mode}`, "Provider path: message", "No internal tool was executed."],
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
    case "recommendation_context":
      return {
        name: "get_recommendation_context",
        description: "Return a deterministic recommendation context package.",
        input_fields: ["start_date", "end_date"],
      };
  }
}

function getAllowedToolDefinitions(
  mode: MockAssistantTurnInput["mode"],
): AssistantProviderToolDefinition[] {
  const prioritizedTools = [
    getToolDefinitionForMode(mode),
    getToolDefinitionForMode("training_overview"),
    getToolDefinitionForMode("exercise_progress"),
    getToolDefinitionForMode("recommendation_context"),
  ];

  return prioritizedTools.filter(
    (tool, index, tools) =>
      tools.findIndex((candidate) => candidate.name === tool.name) === index,
  );
}

function buildProviderRequest(
  input: MockAssistantTurnInput,
): AssistantProviderRequest {
  const simulation = parseProviderSimulation(input.message);

  return {
    conversation: {
      user_message: input.message,
    },
    assistant_context: {
      mode: input.mode,
      start_date: input.start_date,
      end_date: input.end_date,
      exercise_id: input.exercise_id ?? null,
    },
    allowed_tools: getAllowedToolDefinitions(input.mode),
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

  const isAllowed = allowedTools.some((tool) => tool.name === response.tool_name);

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
    throw new HttpError(403, "FORBIDDEN", "You cannot access this chat session.");
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

function formatAnswerText(answer: MockAssistantTurnResponseData["answer"]): string {
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
  answer: MockAssistantTurnResponseData["answer"],
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
  toolName: string,
  result: unknown,
): MockAssistantTurnResponseData["answer"] {
  if (toolName === "get_training_summary") {
    return buildTrainingOverviewAnswer(result as TrainingOverviewResult);
  }

  if (toolName === "get_exercise_progress") {
    return buildExerciseProgressAnswer(result as ExerciseProgressResult);
  }

  return buildRecommendationContextAnswer(result as RecommendationContextResult);
}

/**
 * Execute one deterministic mock assistant turn through the internal tool executor.
 *
 * @param userId - Authenticated user id from middleware context.
 * @param rawInput - Raw request body for the mock assistant turn.
 * @param options - Optional stream event sink for SSE responses.
 * @returns Deterministic mock assistant response assembled from tool output.
 */
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
  const providerRequest = buildProviderRequest(input);

  await emitEvent(options, {
    type: "provider_selected",
    provider: getConfiguredAssistantProvider(),
  });

  const providerResponse = await runAssistantProvider(providerRequest);

  if (providerResponse.kind === "error") {
    const error = new HttpError(502, "AI_PROVIDER_ERROR", providerResponse.message, {
      provider_error_code: providerResponse.error_code,
    });

    await emitEvent(options, {
      type: "error",
      code: error.code,
      message: error.message,
    });

    throw error;
  }

  const toolCalls: MockAssistantTurnResponseData["tool_calls"] = [];
  let answer: MockAssistantTurnResponseData["answer"];

  if (providerResponse.kind === "message") {
    answer = buildProviderMessageAnswer(input.mode, providerResponse.message);
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

    answer = buildToolAnswer(providerResponse.tool_name, result);
    await emitAnswerEvents(answer, options);
  }

  const response: MockAssistantTurnResponseData = {
    session_id: resolvedSession.sessionId,
    mode: input.mode,
    assistant_type: "deterministic_mock",
    tool_calls: toolCalls,
    answer,
  };

  await persistMockTurnMessages({
    sessionId: resolvedSession.sessionId,
    request: input,
    response,
  });

  await emitEvent(options, {
    type: "done",
    session_id: resolvedSession.sessionId,
  });

  return response;
}
