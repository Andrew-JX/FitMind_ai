import { z } from "zod";

import {
  createChatMessage,
  createChatSession,
  findChatSessionByIdForUser,
  listMessagesForSession,
  type ChatMessageRow,
} from "../../db/chat-repository.js";
import { loadServerEnv } from "../../env.js";
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
  PlanAdherenceContext,
  PlanProfileContext,
} from "../agent/react-planner-types.js";
import { getAthleteProfile } from "../athlete-profile-service.js";
import { getPlanAdherenceContextForPlanner } from "../planned-workout-service.js";
import { searchDictionaryExercises } from "../training/dictionary-service.js";
import {
  matchExercise,
  type ExerciseMatchingDictionaryItem,
} from "../training/exercise-matching-service.js";
import {
  enforceFaithfulnessInDev,
  verifyAnswerFaithfulness,
  type AnswerFaithfulnessResult,
} from "./answer-faithfulness.js";
import {
  runAssistantAnswerPhrasing,
  runAssistantProvider,
} from "./provider-adapter.js";
import {
  coerceMessageToEvidenceToolCall,
  decideDeterministicProviderFallback,
  decideProviderErrorFallback,
  type NonErrorProviderResponse,
  type ProviderErrorFallbackTelemetry,
} from "./assistant-provider-fallback.js";
import { applyFaithfulPhrasing } from "./answer-phrasing.js";
import { getToolDefinitionForMode } from "./assistant-tool-routing.js";
import {
  classifyAssistantSafety,
  composeMedicalSafetyAnswer,
  isAssistantSafetyGateEnabled,
  type AssistantSafetyReason,
} from "./assistant-safety.js";
import {
  estimateAssistantProviderCallCostUsd,
  summarizeTurnLlmCalls,
  type AssistantLlmCallRecord,
  type AssistantTurnLlmSummary,
  type ToolArgumentFallbackTelemetry,
} from "./assistant-turn-observability.js";
import {
  getDefaultAssistantProviderGuard,
  type AssistantProviderBudgetFallbackTelemetry,
  type AssistantProviderGuard,
} from "./assistant-provider-guard.js";
import type {
  AssistantIpBudgetFallbackTelemetry,
  AssistantIpGuardDecision,
} from "../../middleware/assistant-ip-rate-limit-middleware.js";
import {
  createOpenAiCompatibleIntentRouter,
  type LlmIntentRouter,
} from "./llm-intent-router.js";
import {
  getConfiguredAssistantProvider,
  isAssistantAnswerPhrasingEnabled,
  type AssistantProviderName,
} from "./provider-config.js";
import {
  composeKnowledgeAnswer,
  composeDateRangeClarificationAnswer,
  composeExerciseClarificationAnswer,
  composeMixedToolRagAnswer,
  composeUnsupportedAnswer,
  assistantClarificationSchema,
  type AssistantClarification,
  type AssistantStructuredAnswer,
} from "./assistant-answer-composer.js";
import {
  buildExerciseProgressAnswer,
  buildPlateauDiagnosisAnswer,
  buildProviderErrorFallbackGuidance,
  buildProviderMessageAnswer,
  buildRecommendationContextAnswer,
  buildTrainingOverviewAnswer,
  buildWeeklyTrainingReportAnswer,
  normalizeStructuredAnswer,
  type AssistantAnswerCore,
  type ExerciseProgressResult,
  type RecommendationContextResult,
  type TrainingOverviewResult,
  type WeeklyTrainingReportResult,
} from "./assistant-deterministic-answers.js";
import {
  ASSISTANT_DEFAULT_RANGE_DAYS,
  resolveAssistantDateRequest,
} from "./assistant-date-request.js";
import { computeAssistantDefaultRange } from "./assistant-date-resolver.js";

/**
 * Zone used when a client sends none. UTC keeps "today" deterministic instead
 * of inheriting whatever zone the server host happens to run in.
 */
const ASSISTANT_FALLBACK_TIME_ZONE = "UTC";
import {
  resolveAssistantExerciseEntity,
  type AssistantExerciseEntityResolution,
} from "./assistant-entity-resolver.js";
import {
  isOutOfScopeMessage,
  type AssistantRoutedIntent,
} from "./assistant-intent-router.js";
import { classifyUnsupportedScope } from "./assistant-refusal-scope.js";
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
  AssistantProviderToolDefinition,
} from "./provider-types.js";
import {
  buildProviderRequest,
  ensureAllowedProviderTool,
  resolveExecutionModeForIntent,
  resolveRoutedIntent,
} from "./assistant-turn-routing.js";

export { resolveRoutedIntent } from "./assistant-turn-routing.js";

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
    // ER-2B: optional. A client may still send an explicit window (that is how
    // a tapped date clarification continues, and how pre-ER-2 clients keep
    // working); otherwise the server resolves the range itself.
    start_date: z
      .string()
      .refine(isValidDateOnly, "start_date must use YYYY-MM-DD.")
      .optional(),
    end_date: z
      .string()
      .refine(isValidDateOnly, "end_date must use YYYY-MM-DD.")
      .optional(),
    timezone: z.string().trim().min(1).optional(),
    exercise_id: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasStart = value.start_date !== undefined;
    const hasEnd = value.end_date !== undefined;

    if (hasStart !== hasEnd) {
      // Half a window is not a window. Accepting one side would silently pair
      // it with a server-chosen other side and answer over a range nobody asked
      // for.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [hasStart ? "end_date" : "start_date"],
        message: "start_date and end_date must be provided together.",
      });
      return;
    }

    if (
      hasStart &&
      hasEnd &&
      (value.start_date as string) > (value.end_date as string)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: "end_date must be on or after start_date.",
      });
    }
  });

const assistantRoutedIntentSchema = z.enum([
  "weekly_report",
  "plateau_diagnosis",
  "next_week_plan",
  "summary",
  "progress",
  "imbalance",
  "recommendation",
  "exercise_history",
  "evidence",
  "knowledge",
  "mixed_tool_rag",
  "unsupported",
]);

const assistantExerciseClarificationContextSchema = z
  .object({
    version: z.literal(1),
    clarification: assistantClarificationSchema,
    original_request: z
      .object({
        mode: assistantModeSchema,
        message: z.string().trim().min(1),
        start_date: z.string().refine(isValidDateOnly),
        end_date: z.string().refine(isValidDateOnly),
      })
      .strict(),
    resolved_intent: assistantRoutedIntentSchema,
    resolved_entities: z
      .object({
        exercise: z
          .object({
            status: z.enum(["absent", "ambiguous", "unresolved"]),
            matched_exercise_id: z.null(),
            matched_exercise_name: z.null(),
            candidate_exercises: z
              .array(
                z
                  .object({
                    exercise_id: z.string().uuid(),
                    exercise_name: z.string().trim().min(1),
                    confidence: z.number().min(0).max(1),
                  })
                  .strict(),
              )
              .max(5),
          })
          .strict(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.clarification.kind !== "exercise") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clarification", "kind"],
        message: "ER-1 clarification context must target an exercise.",
      });

      return;
    }

    // A `version: 1` context must stay readable by builds that predate ER-3.
    // Those builds only accept ambiguous|unresolved and drop the whole context
    // on any other value, which would silently break a pending clarification
    // during a rollback or a rolling deploy. The layered reason belongs to the
    // response, not to persisted state.
    if (value.clarification.reason === "missing") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clarification", "reason"],
        message:
          "Persisted v1 clarification context must use a pre-ER-3 reason.",
      });
    }
  });

type AssistantExerciseClarificationContext = z.infer<
  typeof assistantExerciseClarificationContextSchema
>;

export interface MockAssistantTurnInput {
  mode: AssistantIntentMode;
  session_id?: string | undefined;
  message: string;
  start_date: string;
  end_date: string;
  /** IANA zone the client is in; used to read "today" and supported periods. */
  timezone?: string | undefined;
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
  clarification?: AssistantClarification | undefined;
  agent_trace?: AgentTrace | undefined;
  faithfulness?: AnswerFaithfulnessResult | undefined;
  plan?: NextWeekPlanDraft | undefined;
}

/**
 * Server-side operational metadata for one turn (NOT part of the public response
 * DTO): token usage now, and a natural home for `trace_id`, model, and per-call
 * latency/cost later. The controller logs this and strips it before responding,
 * so clients never depend on Groq/OpenAI usage shapes (C1).
 */
export interface AssistantTurnTelemetry {
  /** Aggregated LLM call/token telemetry (Groq); undefined on deterministic/mock paths. */
  llm?: AssistantTurnLlmSummary | undefined;
  /** Server-only marker for a provider error completed via deterministic fallback. */
  providerErrorFallback?: ProviderErrorFallbackTelemetry | undefined;
  /** Server-only marker for a turn completed after an IP/instance budget denial. */
  budgetFallback?: AssistantBudgetFallbackTelemetry | undefined;
  /** Server-only marker for request/provider tool arguments completed via guidance. */
  toolArgumentFallback?: ToolArgumentFallbackTelemetry | undefined;
  /** Server-only safety marker for pre-routing medical boundary hits. */
  safety?:
    | { boundary: "medical_boundary"; reason: AssistantSafetyReason }
    | undefined;
}

export type AssistantBudgetFallbackTelemetry =
  | AssistantProviderBudgetFallbackTelemetry
  | AssistantIpBudgetFallbackTelemetry;

export interface AssistantOrchestratorOptions extends AssistantStreamOptions {
  /** Request-scoped AR-1c decision; Commit 2 will pass it from HTTP locals. */
  assistantIpGuardDecision?: AssistantIpGuardDecision | undefined;
  /** Injectable AR-1b guard for deterministic orchestration tests. */
  providerGuard?: AssistantProviderGuard | undefined;
}

/** Internal envelope: the public response plus server-only telemetry. */
export interface AssistantTurnExecutionResult {
  response: MockAssistantTurnResponseData;
  telemetry: AssistantTurnTelemetry;
}

/**
 * HttpError that also carries the turn's server-only telemetry, so a failed turn
 * (e.g. a Groq 429/500 on the routing call) can still be logged with its LLM
 * attempt/error/model/usage. `turnTelemetry` is never serialized to the client.
 */
export class AssistantTurnError extends HttpError {
  public readonly turnTelemetry: AssistantTurnTelemetry;

  public constructor(
    statusCode: number,
    code: "AI_PROVIDER_ERROR",
    message: string,
    details: Record<string, unknown> | undefined,
    turnTelemetry: AssistantTurnTelemetry,
  ) {
    super(statusCode, code, message, details);
    this.name = "AssistantTurnError";
    this.turnTelemetry = turnTelemetry;
  }
}

interface PersistedTextBlock {
  type: "text";
  text: string;
}

interface ResolvedSession {
  sessionId: string;
}

interface ResolvedExerciseTurnInput {
  entityResolution: AssistantExerciseEntityResolution | null;
  input: MockAssistantTurnInput;
  resumedIntent: AssistantRoutedIntent | null;
}

const ANSWER_DELTA_CHUNK_SIZE = 24;
const NO_LLM_CALL: AssistantLlmCallRecord = {
  attempted: false,
  errored: false,
  provider: null,
  model: null,
};

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

function resolveInvalidToolArgumentFields(
  error: AiToolValidationError,
  defaultTool: AssistantProviderToolDefinition,
): string[] {
  const inputFields = new Set(defaultTool.input_fields);
  const invalidFields = error.issues
    .map((issue) => issue.path.split(".")[0])
    .filter(
      (field): field is string =>
        field !== undefined && field.length > 0 && inputFields.has(field),
    );

  return invalidFields.length > 0
    ? [...new Set(invalidFields)]
    : [...defaultTool.input_fields];
}

function createValidationHttpError(error: AiToolValidationError): HttpError {
  return new HttpError(400, error.code, error.message, {
    issues: error.issues,
  });
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

  throw new HttpError(404, "NOT_FOUND", "Chat session was not found.");
}

function findLatestExerciseClarificationContext(
  messages: ChatMessageRow[],
): AssistantExerciseClarificationContext | null {
  const latestMessage = messages.at(-1);

  if (latestMessage?.role !== "assistant") {
    return null;
  }

  const metadata = z
    .object({
      clarification_context: assistantExerciseClarificationContextSchema,
    })
    .passthrough()
    .safeParse(latestMessage.metadata);

  return metadata.success ? metadata.data.clarification_context : null;
}

async function loadExerciseMatchingDictionary(): Promise<
  ExerciseMatchingDictionaryItem[]
> {
  const dictionary = await searchDictionaryExercises({});

  return dictionary.items;
}

async function resolveExerciseTurnInput(input: {
  request: MockAssistantTurnInput;
  sessionId: string;
  userId: string;
}): Promise<ResolvedExerciseTurnInput> {
  const messages =
    input.request.session_id === undefined
      ? []
      : await listMessagesForSession(input.sessionId, input.userId);
  const pendingContext = findLatestExerciseClarificationContext(messages);
  const needsDictionary =
    input.request.exercise_id === undefined || pendingContext !== null;
  const dictionary = needsDictionary
    ? await loadExerciseMatchingDictionary()
    : [];

  if (
    pendingContext !== null &&
    pendingContext.clarification.kind === "exercise"
  ) {
    const directReply = matchExercise(
      input.request.message.replace(/[，。！？?,.!]/gu, ""),
      dictionary,
    );
    const replyExerciseId =
      input.request.exercise_id ?? directReply.matched_exercise_id;
    const isDirectAllowedReply =
      directReply.match_status === "matched" &&
      directReply.matched_exercise_id === replyExerciseId &&
      replyExerciseId !== null &&
      pendingContext.clarification.options.some(
        (option) => option.exercise_id === replyExerciseId,
      );

    if (isDirectAllowedReply) {
      return {
        entityResolution: {
          candidate_exercises: directReply.candidate_exercises,
          matched_exercise_id: replyExerciseId,
          matched_exercise_name: directReply.matched_exercise_name,
          match_confidence: directReply.match_confidence,
          status: "matched",
        },
        input: {
          ...pendingContext.original_request,
          session_id: input.request.session_id,
          exercise_id: replyExerciseId,
        },
        resumedIntent: pendingContext.resolved_intent,
      };
    }
  }

  if (input.request.exercise_id !== undefined) {
    return {
      entityResolution: null,
      input: input.request,
      resumedIntent: null,
    };
  }

  const entityResolution = resolveAssistantExerciseEntity(
    input.request.message,
    dictionary,
  );

  return {
    entityResolution,
    input:
      entityResolution.status === "matched" &&
      entityResolution.matched_exercise_id !== null
        ? {
            ...input.request,
            exercise_id: entityResolution.matched_exercise_id,
          }
        : input.request,
    resumedIntent: null,
  };
}

/**
 * Map an entity-resolution status onto the clarification copy it deserves.
 *
 * @param status - Deterministic exercise entity status for this turn
 * @returns The clarification reason the composer renders
 *
 * @remarks
 * `absent` (the user named no exercise) and `unresolved` (they named one that
 * is not in the dictionary) used to collapse into a single reason, so someone
 * who typed a real but unknown exercise was told to "告诉我具体动作名" as if they
 * had typed nothing — advice they had already followed.
 */
function resolveExerciseClarificationReason(
  status: AssistantExerciseEntityResolution["status"],
): "ambiguous" | "missing" | "unresolved" {
  if (status === "ambiguous") {
    return "ambiguous";
  }

  return status === "unresolved" ? "unresolved" : "missing";
}

/**
 * Collapse a layered reason back to the value set persisted contexts allow.
 *
 * @param reason - Reason shown to the user this turn
 * @returns The pre-ER-3 reason safe to store in a `version: 1` context
 */
function toPersistedClarificationReason(
  reason: "ambiguous" | "missing" | "unresolved",
): "ambiguous" | "unresolved" {
  return reason === "ambiguous" ? "ambiguous" : "unresolved";
}

function requiresExerciseEntity(intent: AssistantRoutedIntent): boolean {
  return intent === "progress" || intent === "plateau_diagnosis";
}

function buildExerciseClarificationContext(input: {
  intent: AssistantRoutedIntent;
  request: MockAssistantTurnInput;
  resolution: AssistantExerciseEntityResolution;
}): AssistantExerciseClarificationContext {
  const options = input.resolution.candidate_exercises.map((candidate) => ({
    exercise_id: candidate.exercise_id,
    exercise_name: candidate.exercise_name,
  }));
  // Persisted state stays on the pre-ER-3 value set; the layered reason is a
  // response concern. Resuming a clarification matches on the options and the
  // original request, never on this field.
  const clarification = assistantClarificationSchema.parse({
    kind: "exercise",
    reason: toPersistedClarificationReason(
      resolveExerciseClarificationReason(input.resolution.status),
    ),
    options,
  });

  return assistantExerciseClarificationContextSchema.parse({
    version: 1,
    clarification,
    original_request: {
      mode: input.request.mode,
      message: input.request.message,
      start_date: input.request.start_date,
      end_date: input.request.end_date,
    },
    resolved_intent: input.intent,
    resolved_entities: {
      exercise: {
        status: input.resolution.status,
        matched_exercise_id: null,
        matched_exercise_name: null,
        candidate_exercises: input.resolution.candidate_exercises,
      },
    },
  });
}

async function persistMockTurnMessages(input: {
  sessionId: string;
  request: MockAssistantTurnInput;
  response: MockAssistantTurnResponseData;
  clarificationContext?: AssistantExerciseClarificationContext | undefined;
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
      ...(input.clarificationContext === undefined
        ? {}
        : { clarification_context: input.clarificationContext }),
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
    return buildWeeklyTrainingReportAnswer(
      result as WeeklyTrainingReportResult,
    );
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
/**
 * Build the per-turn telemetry envelope from the LLM call records made this turn.
 * provider/model come from the records themselves (the actual client results).
 *
 * @param records - One entry per LLM call site reached (router / routing / phrasing).
 * @returns Telemetry with an aggregated `llm` summary (undefined when no call ran).
 */
function buildTurnTelemetry(
  records: AssistantLlmCallRecord[],
  providerErrorFallback?: ProviderErrorFallbackTelemetry,
  budgetFallback?: AssistantBudgetFallbackTelemetry,
  toolArgumentFallback?: ToolArgumentFallbackTelemetry,
): AssistantTurnTelemetry {
  const telemetry: AssistantTurnTelemetry = {
    llm: summarizeTurnLlmCalls(records),
  };

  if (providerErrorFallback !== undefined) {
    telemetry.providerErrorFallback = providerErrorFallback;
  }

  if (budgetFallback !== undefined) {
    telemetry.budgetFallback = budgetFallback;
  }

  if (toolArgumentFallback !== undefined) {
    telemetry.toolArgumentFallback = toolArgumentFallback;
  }

  return telemetry;
}

type ProviderAttemptGateDecision = { kind: "allow" } | { kind: "fallback" };

interface TurnProviderGate {
  guardRealProviderAttempt(): ProviderAttemptGateDecision;
  recordCompletedCall(call: AssistantLlmCallRecord): void;
  getBudgetFallback(): AssistantBudgetFallbackTelemetry | undefined;
}

function createTurnProviderGate(args: {
  configuredProvider: AssistantProviderName;
  ipDecision: AssistantIpGuardDecision | undefined;
  providerGuard: AssistantProviderGuard;
}): TurnProviderGate {
  const isMock = args.configuredProvider === "mock";
  let budgetFallback: AssistantBudgetFallbackTelemetry | undefined =
    !isMock && args.ipDecision?.kind === "fallback"
      ? args.ipDecision.telemetry
      : undefined;

  return {
    guardRealProviderAttempt(): ProviderAttemptGateDecision {
      if (isMock) {
        return { kind: "allow" };
      }

      if (budgetFallback !== undefined) {
        return { kind: "fallback" };
      }

      const decision = args.providerGuard.guardRealProviderAttempt();
      if (decision.kind === "fallback") {
        budgetFallback = decision.telemetry;
        return { kind: "fallback" };
      }

      return { kind: "allow" };
    },

    recordCompletedCall(call: AssistantLlmCallRecord): void {
      if (!isMock) {
        args.providerGuard.recordCost(
          estimateAssistantProviderCallCostUsd(call),
        );
      }
    },

    getBudgetFallback(): AssistantBudgetFallbackTelemetry | undefined {
      return budgetFallback;
    },
  };
}

function guardIntentRouter(
  router: LlmIntentRouter | null,
  providerGate: TurnProviderGate,
): LlmIntentRouter | null {
  if (router === null) {
    return null;
  }

  return {
    async classify(message) {
      if (providerGate.guardRealProviderAttempt().kind === "fallback") {
        return { intent: null, call: NO_LLM_CALL };
      }

      const classification = await router.classify(message);
      providerGate.recordCompletedCall(classification.call);
      return classification;
    },
  };
}

export async function runMockAssistantTurn(
  userId: string,
  rawInput: unknown,
  options?: AssistantOrchestratorOptions,
): Promise<AssistantTurnExecutionResult> {
  await emitEvent(options, {
    type: "state",
    state: "thinking",
  });

  const parsedInput = mockAssistantTurnSchema.parse(rawInput);
  const requestTimeZone = parsedInput.timezone ?? ASSISTANT_FALLBACK_TIME_ZONE;
  const dateRequest = resolveAssistantDateRequest({
    end_date: parsedInput.end_date,
    message: parsedInput.message,
    start_date: parsedInput.start_date,
    timeZone: requestTimeZone,
  });
  // An ambiguous turn short-circuits below without running a tool, so the range
  // carried here is only ever persisted beside an answer that cites no range.
  const requestInput: MockAssistantTurnInput = {
    ...parsedInput,
    ...(dateRequest.status === "range"
      ? dateRequest.range
      : computeAssistantDefaultRange({
          days: ASSISTANT_DEFAULT_RANGE_DAYS,
          timeZone: requestTimeZone,
        })),
  };
  const resolvedSession = await resolveSession(
    userId,
    requestInput.session_id,
    requestInput.message,
  );
  await emitEvent(options, {
    type: "session",
    session_id: resolvedSession.sessionId,
  });

  if (isAssistantSafetyGateEnabled()) {
    const safetyClassification = classifyAssistantSafety(requestInput.message);

    if (
      safetyClassification.boundary === "medical_boundary" &&
      safetyClassification.reason !== null
    ) {
      const answer = composeMedicalSafetyAnswer(safetyClassification);

      await emitAnswerEvents(answer, options);

      const response: MockAssistantTurnResponseData = {
        session_id: resolvedSession.sessionId,
        mode: requestInput.mode,
        assistant_type: "deterministic_mock",
        intent: "unsupported",
        tool_calls: [],
        answer,
      };

      const messageId = await persistMockTurnMessages({
        sessionId: resolvedSession.sessionId,
        request: requestInput,
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

      return {
        response,
        telemetry: {
          ...(options?.assistantIpGuardDecision?.kind !== "fallback"
            ? {}
            : {
                budgetFallback: options.assistantIpGuardDecision.telemetry,
              }),
          safety: {
            boundary: "medical_boundary",
            reason: safetyClassification.reason,
          },
        },
      };
    }
  }

  // ER-2B: two named periods in one message are a conflict, never a first
  // match. This runs after safety and before intent routing, because the range
  // is an input to everything downstream — and it costs no provider call.
  if (dateRequest.status === "ambiguous") {
    const clarification = assistantClarificationSchema.parse({
      kind: "date_range",
      reason: "ambiguous",
      options: dateRequest.options.map((option) => ({
        label: option.label,
        start_date: option.start_date,
        end_date: option.end_date,
      })),
    });

    if (clarification.kind !== "date_range") {
      throw new Error("ER-2 produced a non-date clarification.");
    }

    const answer = composeDateRangeClarificationAnswer(clarification);
    await emitAnswerEvents(answer, options);

    const response: MockAssistantTurnResponseData = {
      session_id: resolvedSession.sessionId,
      mode: requestInput.mode,
      assistant_type: "deterministic_mock",
      intent: "unsupported",
      tool_calls: [],
      answer,
      clarification,
    };
    const messageId = await persistMockTurnMessages({
      sessionId: resolvedSession.sessionId,
      request: requestInput,
      response,
    });
    response.message_id = messageId;

    await emitEvent(options, { type: "structured_output", output: response });
    await emitEvent(options, {
      type: "done",
      message_id: messageId,
      session_id: resolvedSession.sessionId,
    });

    return {
      response,
      telemetry: {
        ...(options?.assistantIpGuardDecision?.kind !== "fallback"
          ? {}
          : { budgetFallback: options.assistantIpGuardDecision.telemetry }),
      },
    };
  }

  const exerciseTurn = await resolveExerciseTurnInput({
    request: requestInput,
    sessionId: resolvedSession.sessionId,
    userId,
  });
  const input = exerciseTurn.input;

  // Safety is intentionally evaluated before the call-level provider budget
  // gate. The per-IP decision is already request-scoped at this boundary, but
  // no instance guard may run for a safety-short-circuited turn.
  const configuredProvider = getConfiguredAssistantProvider();
  const providerGate = createTurnProviderGate({
    configuredProvider,
    ipDecision: options?.assistantIpGuardDecision,
    providerGuard: options?.providerGuard ?? getDefaultAssistantProviderGuard(),
  });

  const intentRouter =
    options?.intentRouter !== undefined
      ? options.intentRouter
      : configuredProvider === "groq" ||
          configuredProvider === "openai_compatible"
        ? createOpenAiCompatibleIntentRouter()
        : null;
  const routed =
    exerciseTurn.resumedIntent === null
      ? await resolveRoutedIntent(
          input,
          guardIntentRouter(intentRouter, providerGate),
        )
      : { intent: exerciseTurn.resumedIntent, routerCall: NO_LLM_CALL };
  const intent = routed.intent;
  // Router rescue call is billed; its record must be counted on every path below.
  const routerRecord = routed.routerCall;
  const executionMode = resolveExecutionModeForIntent(input, intent);

  if (
    requiresExerciseEntity(intent) &&
    input.exercise_id === undefined &&
    exerciseTurn.entityResolution !== null
  ) {
    const clarificationContext = buildExerciseClarificationContext({
      intent,
      request: requestInput,
      resolution: exerciseTurn.entityResolution,
    });
    const persistedClarification = clarificationContext.clarification;

    if (persistedClarification.kind !== "exercise") {
      throw new Error("ER-1 produced a non-exercise clarification.");
    }

    // The response carries the layered ER-3 reason; the stored context above
    // keeps the pre-ER-3 one so an older build can still resume it.
    const clarification = assistantClarificationSchema.parse({
      ...persistedClarification,
      reason: resolveExerciseClarificationReason(
        exerciseTurn.entityResolution.status,
      ),
    }) as Extract<AssistantClarification, { kind: "exercise" }>;

    const answer = composeExerciseClarificationAnswer(clarification);
    await emitAnswerEvents(answer, options);

    const response: MockAssistantTurnResponseData = {
      session_id: resolvedSession.sessionId,
      mode: requestInput.mode,
      assistant_type: "deterministic_mock",
      intent,
      tool_calls: [],
      answer,
      clarification,
    };
    const messageId = await persistMockTurnMessages({
      sessionId: resolvedSession.sessionId,
      request: requestInput,
      response,
      clarificationContext,
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

    return {
      response,
      telemetry: buildTurnTelemetry(
        [routerRecord],
        undefined,
        providerGate.getBudgetFallback(),
      ),
    };
  }

  if (intent === "unsupported") {
    // Slice 11a：没听懂的提问不要直接死给。明显越界（黑名单/空）保持澄清式拒答；
    // 否则用 tokenizeKnowledgeQuery 当相关性闸门（纯无关查询返回空 token，避免向量乱答），
    // 有训练知识锚点就检索——命中知识用知识答（更有用、带 Sources + 免责），否则退回澄清。
    const canTryKnowledgeFallback =
      !isOutOfScopeMessage(input.message) &&
      tokenizeKnowledgeQuery(input.message).length > 0;
    // ER-3: an understood-but-unanswerable topic and a training question we
    // failed to parse are different failures, so they get different copy. The
    // existing blocklist stays authoritative for the topics it names.
    const unsupportedScope = isOutOfScopeMessage(input.message)
      ? "out_of_scope"
      : classifyUnsupportedScope({
          message: input.message,
          // Only a dictionary hit counts as a training signal. `unresolved`
          // means an unknown phrase survived framing removal, which any
          // off-topic message produces — treating that as evidence of training
          // sent the spec's own reference case (生酮饮食) down the
          // "unrecognized" path.
          hasExerciseSignal:
            exerciseTurn.entityResolution !== null &&
            (exerciseTurn.entityResolution.status === "matched" ||
              exerciseTurn.entityResolution.status === "ambiguous"),
        });
    let answer = composeUnsupportedAnswer(unsupportedScope);

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
        fallbackReason:
          sources.length === 0 ? "no_relevant_sources" : undefined,
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
      request: requestInput,
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

    return {
      response,
      telemetry: buildTurnTelemetry(
        [routerRecord],
        undefined,
        providerGate.getBudgetFallback(),
      ),
    };
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
      request: requestInput,
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

    return {
      response,
      telemetry: buildTurnTelemetry(
        [routerRecord],
        undefined,
        providerGate.getBudgetFallback(),
      ),
    };
  }

  if (intent === "next_week_plan") {
    // Deterministic ReAct agent path makes no billed provider call, but the rescue
    // router call (if any) still counts.
    const planResponse = await runNextWeekPlanAgentTurn({
      userId,
      input,
      intent,
      sessionId: resolvedSession.sessionId,
      options,
    });

    return {
      response: planResponse,
      telemetry: buildTurnTelemetry(
        [routerRecord],
        undefined,
        providerGate.getBudgetFallback(),
      ),
    };
  }

  const defaultTool = getToolDefinitionForMode(executionMode);
  const fallbackArgSource = {
    start_date: input.start_date,
    end_date: input.end_date,
    exercise_id: input.exercise_id,
  };
  const requestArgFallback = decideDeterministicProviderFallback(
    defaultTool,
    fallbackArgSource,
  );
  let toolArgumentFallback: ToolArgumentFallbackTelemetry | undefined =
    requestArgFallback.kind === "missing_required_args"
      ? {
          tool_argument_fallback: true,
          fallback_reason: "missing_required_request_args",
          tool_name: defaultTool.name,
          argument_fields: requestArgFallback.missing_input_fields,
          validation_error_code: null,
        }
      : undefined;

  const providerRequest = buildProviderRequest(input, executionMode);
  const toolSelectionGate =
    requestArgFallback.kind === "missing_required_args"
      ? ({ kind: "fallback" } as const)
      : providerGate.guardRealProviderAttempt();

  await emitEvent(options, {
    type: "provider_selected",
    provider:
      toolSelectionGate.kind === "fallback" ? "mock" : configuredProvider,
  });

  const rawProviderResponse =
    toolSelectionGate.kind === "fallback"
      ? null
      : await runAssistantProvider(providerRequest);

  // C1 token/cost observability: the routing tool-selection call's telemetry comes
  // straight from the provider response (present even on error → failed turns are
  // still countable); mock makes no billed call → NO_LLM_CALL.
  const routingRecord: AssistantLlmCallRecord =
    rawProviderResponse?.telemetry ?? NO_LLM_CALL;
  if (rawProviderResponse !== null) {
    providerGate.recordCompletedCall(routingRecord);
  }

  let providerResponse: NonErrorProviderResponse;
  let providerErrorFallback: ProviderErrorFallbackTelemetry | undefined;

  if (rawProviderResponse === null) {
    const fallback = decideDeterministicProviderFallback(
      defaultTool,
      fallbackArgSource,
    );
    providerResponse =
      fallback.kind === "tool_call"
        ? fallback.response
        : {
            kind: "message",
            message: buildProviderErrorFallbackGuidance(
              fallback.missing_input_fields,
            ),
          };
  } else if (rawProviderResponse.kind === "error") {
    const fallback = decideProviderErrorFallback(
      rawProviderResponse,
      defaultTool,
      fallbackArgSource,
    );
    providerErrorFallback = fallback.telemetry;
    providerResponse =
      fallback.kind === "tool_call"
        ? fallback.response
        : {
            kind: "message",
            message: buildProviderErrorFallbackGuidance(
              fallback.missing_input_fields,
            ),
          };
  } else {
    // Slice 11.2a safety net: provider-path intents are all data questions, so if
    // the provider answered in prose (no tool), run the mode's default tool.
    providerResponse = coerceMessageToEvidenceToolCall(
      rawProviderResponse,
      defaultTool,
      fallbackArgSource,
    );
  }

  let phrasingRecord: AssistantLlmCallRecord | undefined;

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
    let validationGuidance: string | undefined;

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
        const invalidFields = resolveInvalidToolArgumentFields(
          error,
          defaultTool,
        );
        toolArgumentFallback = {
          tool_argument_fallback: true,
          fallback_reason: "tool_validation_error",
          tool_name: providerResponse.tool_name,
          argument_fields: invalidFields,
          validation_error_code: error.code,
        };
        validationGuidance = buildProviderErrorFallbackGuidance(invalidFields);
      } else {
        throw error;
      }
    }

    if (validationGuidance !== undefined) {
      answer = normalizeStructuredAnswer(
        buildProviderMessageAnswer(validationGuidance),
        intent,
      );
    } else if (intent === "mixed_tool_rag") {
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
        fallbackReason:
          sources.length === 0 ? "no_relevant_sources" : undefined,
      });

      answer = composeMixedToolRagAnswer({
        message: input.message,
        sources,
        toolEvidence: buildToolAnswer(input, providerResponse.tool_name, result)
          .evidence,
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
        fallbackReason:
          sources.length === 0 ? "no_relevant_sources" : undefined,
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
    if (
      validationGuidance === undefined &&
      providerErrorFallback === undefined &&
      isAssistantAnswerPhrasingEnabled()
    ) {
      const phrasingGate = providerGate.guardRealProviderAttempt();
      if (phrasingGate.kind === "allow") {
        const phrasing = await runAssistantAnswerPhrasing({
          draftSummary: answer.summary,
          supportingFacts: answer.bullets,
        });
        phrasingRecord = phrasing.call;
        providerGate.recordCompletedCall(phrasing.call);
        answer = applyFaithfulPhrasing(answer, phrasing.summary, (candidate) =>
          verifyAnswerFaithfulness(candidate, toolOutputs),
        ).answer;
      }
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
  };

  const messageId = await persistMockTurnMessages({
    sessionId: resolvedSession.sessionId,
    request: requestInput,
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

  return {
    response,
    telemetry: buildTurnTelemetry(
      phrasingRecord === undefined
        ? [routerRecord, routingRecord]
        : [routerRecord, routingRecord, phrasingRecord],
      providerErrorFallback,
      providerGate.getBudgetFallback(),
      toolArgumentFallback,
    ),
  };
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
  const planAdherence = await loadPlanAdherenceContext(userId, input);

  try {
    agentOutput = await runNextWeekPlanAgent(
      {
        message: input.message,
        startDate: input.start_date,
        endDate: input.end_date,
        exerciseId: input.exercise_id ?? null,
        profile,
        planAdherence,
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

async function loadPlanAdherenceContext(
  userId: string,
  input: MockAssistantTurnInput,
): Promise<PlanAdherenceContext | null> {
  if (!loadServerEnv().assistantPlanAdherenceContext) {
    return null;
  }

  try {
    return await getPlanAdherenceContextForPlanner(userId, {
      startDate: input.start_date,
      endDate: input.end_date,
    });
  } catch {
    // Learning-loop context is best-effort; a load failure must not break planning.
    return null;
  }
}
