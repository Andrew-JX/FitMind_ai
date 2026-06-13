import type { RetrievedKnowledgeChunk } from "../rag/knowledge-retriever.js";
import type {
  AssistantAnswerEvidence,
  AssistantAnswerSource,
  AssistantStructuredAnswer,
} from "../assistant/assistant-answer-composer.js";
import type {
  AgentStepEvent,
  AgentStepKind,
  AgentStepStatus,
  AgentToolCallSummary,
  AgentTrace,
  AgentTraceStep,
  NextWeekPlanAgentDeps,
  NextWeekPlanAgentInput,
  NextWeekPlanAgentOutput,
  ProgressionMode,
} from "./react-planner-types.js";
import {
  generateNextWeekPlan,
  type NextWeekPlanGeneratorInput,
} from "./next-week-plan-generator.js";

const AGENT_GOAL = "基于训练记录与知识，规划一份保守的下周训练草案";
const AGENT_MAX_STEPS = 5;
/** workouts/week at or above this leans toward consolidation / fatigue control. */
const HIGH_WEEKLY_FREQUENCY = 5;
/** workouts/week at or below this leaves room to add a session. */
const LOW_WEEKLY_FREQUENCY = 2;

interface StepAccumulator {
  steps: AgentTraceStep[];
  toolCalls: AgentToolCallSummary[];
  workoutIds: Set<string>;
  setIds: Set<string>;
  calculationRules: Set<string>;
  toolNames: Set<string>;
}

/**
 * Runs the multi-step ReAct planner for the `next_week_plan` intent.
 *
 * The deterministic policy gathers weekly capacity, finds weak/imbalanced areas,
 * optionally inspects a specific exercise's progress, retrieves training
 * knowledge, then synthesizes a conservative draft — emitting one trace step per
 * thought → action → observation.
 *
 * @param input - User message, date range, and optional focus exercise id
 * @param deps - Injected tool runner, retriever, optional step callback and clock
 * @returns The trace, per-tool summaries, and the structured answer
 */
export async function runNextWeekPlanAgent(
  input: NextWeekPlanAgentInput,
  deps: NextWeekPlanAgentDeps,
): Promise<NextWeekPlanAgentOutput> {
  const now = deps.now ?? Date.now;
  const accumulator: StepAccumulator = {
    steps: [],
    toolCalls: [],
    workoutIds: new Set<string>(),
    setIds: new Set<string>(),
    calculationRules: new Set<string>(),
    toolNames: new Set<string>(),
  };

  // Step 1 — capacity overview (critical; failures propagate).
  const weeklyResult = await runToolStep(accumulator, deps, now, {
    title: "查训练容量",
    thought: "先看本周训练量、频率和肌群分布，作为下周计划的基线。",
    toolName: "get_weekly_training_report",
    args: buildRangeArgs(input),
  });

  if (isEmptyWeeklyReport(weeklyResult)) {
    // Step 1 already emitted its observation; stop the loop early with no data.
    return {
      trace: buildTrace(accumulator.steps, "no_data"),
      tool_calls: accumulator.toolCalls,
      answer: buildNoDataAnswer(input, accumulator),
    };
  }

  // Step 2 — distribution / weak-area scan (best-effort).
  const recommendationResult = await runToolStep(accumulator, deps, now, {
    title: "找训练弱项",
    thought: "结合最近训练量分布，判断有没有明显偏科或记录偏少的部位。",
    toolName: "get_recommendation_context",
    args: buildRangeArgs(input),
    safe: true,
  });

  // Step 3 — single-exercise progress, only when a focus exercise is known.
  let progressResult: unknown = null;

  if (input.exerciseId) {
    progressResult = await runToolStep(accumulator, deps, now, {
      title: "查动作进展",
      thought: "已指定具体动作，查它的 1RM 与重量趋势，判断还能不能继续推进。",
      toolName: "get_exercise_progress",
      args: { ...buildRangeArgs(input), exercise_id: input.exerciseId },
      safe: true,
    });
  } else {
    recordStep(accumulator, {
      kind: "tool",
      title: "查动作进展",
      thought: "未指定具体动作，跳过单动作进展查询，改用整体分布规划。",
      toolName: "get_exercise_progress",
      status: "skipped",
      durationMs: 0,
      observation: "已跳过（无指定动作）。",
    });
    await emitStartedFor(deps, accumulator.steps.at(-1));
    await emitFinishedFor(deps, accumulator.steps.at(-1));
  }

  // Step 4 — retrieve training knowledge for progression / deload / volume.
  const weakArea = resolveWeakArea(weeklyResult, recommendationResult);
  const retrievalQuery = `${input.message} 训练容量 渐进超负荷 deload ${weakArea ?? ""}`.trim();
  const sources = await runRetrievalStep(accumulator, deps, now, retrievalQuery);

  // Step 5 — synthesize the conservative draft.
  const progressionMode = resolveProgressionMode(weeklyResult);
  const answer = await runSynthesisStep(accumulator, deps, now, {
    input,
    weeklyResult,
    weakArea,
    progressionMode,
    progressResult,
    sources,
  });

  // Structured executable draft (动作 × 组 × 次 × 目标重量); rides on structured_output.
  const plan = generateNextWeekPlan(
    buildGeneratorInput({ weeklyResult, weakArea, progressionMode, progressResult }),
  );

  return {
    trace: buildTrace(accumulator.steps, "completed"),
    tool_calls: accumulator.toolCalls,
    answer,
    plan,
  };
}

function buildGeneratorInput(context: {
  weeklyResult: unknown;
  weakArea: string | null;
  progressionMode: ProgressionMode;
  progressResult: unknown;
}): NextWeekPlanGeneratorInput {
  const weekly = asRecord(context.weeklyResult);
  const topExercises = asArray(weekly?.top_exercises)
    .map((item) => {
      const record = asRecord(item);
      const exerciseName = readString(record?.exercise_name);

      return exerciseName === null
        ? null
        : { exerciseName, setCount: readNumber(record?.set_count) ?? 0 };
    })
    .filter(
      (item): item is { exerciseName: string; setCount: number } =>
        item !== null,
    );

  const progress = asRecord(context.progressResult);
  const exercise = asRecord(progress?.exercise);
  const totals = asRecord(progress?.totals);
  const focusName = readString(exercise?.exercise_name);

  return {
    progressionMode: context.progressionMode,
    weakArea: context.weakArea,
    topExercises,
    focusExercise:
      focusName === null
        ? null
        : {
            exerciseName: focusName,
            estimated1RmKg: readNumber(totals?.estimated_1rm_kg),
            maxWeightKg: readNumber(totals?.max_weight_kg),
          },
  };
}

async function runToolStep(
  accumulator: StepAccumulator,
  deps: NextWeekPlanAgentDeps,
  now: () => number,
  config: {
    title: string;
    thought: string;
    toolName: string;
    args: unknown;
    safe?: boolean;
  },
): Promise<unknown> {
  const index = accumulator.steps.length + 1;
  await emitStarted(deps, {
    index,
    kind: "tool",
    title: config.title,
    thought: config.thought,
    tool_name: config.toolName,
  });

  const startedAt = now();

  try {
    const result = await deps.runTool(config.toolName, config.args);
    const durationMs = Math.max(0, now() - startedAt);

    accumulator.toolCalls.push({
      tool_name: config.toolName,
      status: "success",
      duration_ms: durationMs,
    });
    accumulateEvidence(accumulator, config.toolName, result);

    const observation = summarizeToolObservation(config.toolName, result);
    recordStep(accumulator, {
      kind: "tool",
      title: config.title,
      thought: config.thought,
      toolName: config.toolName,
      status: "success",
      durationMs,
      observation,
    });
    await emitFinished(deps, index, "success", durationMs, observation);

    return result;
  } catch (error) {
    const durationMs = Math.max(0, now() - startedAt);
    accumulator.toolCalls.push({
      tool_name: config.toolName,
      status: "error",
      duration_ms: durationMs,
    });

    const observation = `工具执行失败：${getErrorMessage(error)}`;
    recordStep(accumulator, {
      kind: "tool",
      title: config.title,
      thought: config.thought,
      toolName: config.toolName,
      status: "error",
      durationMs,
      observation,
    });
    await emitFinished(deps, index, "error", durationMs, observation);

    if (!config.safe) {
      throw error;
    }

    return null;
  }
}

async function runRetrievalStep(
  accumulator: StepAccumulator,
  deps: NextWeekPlanAgentDeps,
  now: () => number,
  query: string,
): Promise<RetrievedKnowledgeChunk[]> {
  const index = accumulator.steps.length + 1;
  const thought = "检索渐进超负荷、训练容量与减量相关的训练知识，给草案提供依据。";
  await emitStarted(deps, {
    index,
    kind: "retrieval",
    title: "检索训练知识",
    thought,
    tool_name: null,
  });

  const startedAt = now();

  try {
    const sources = await deps.retrieve(query);
    const durationMs = Math.max(0, now() - startedAt);
    const observation =
      sources.length > 0
        ? `检索到 ${sources.length} 条来源：${sources.map((source) => source.title).join("、")}。`
        : "没有检索到可用训练知识来源。";

    recordStep(accumulator, {
      kind: "retrieval",
      title: "检索训练知识",
      thought,
      toolName: null,
      status: "success",
      durationMs,
      observation,
    });
    await emitFinished(deps, index, "success", durationMs, observation);

    return sources;
  } catch (error) {
    const durationMs = Math.max(0, now() - startedAt);
    const observation = `检索失败，改用无来源草案：${getErrorMessage(error)}`;
    recordStep(accumulator, {
      kind: "retrieval",
      title: "检索训练知识",
      thought,
      toolName: null,
      status: "error",
      durationMs,
      observation,
    });
    await emitFinished(deps, index, "error", durationMs, observation);

    return [];
  }
}

async function runSynthesisStep(
  accumulator: StepAccumulator,
  deps: NextWeekPlanAgentDeps,
  now: () => number,
  context: {
    input: NextWeekPlanAgentInput;
    weeklyResult: unknown;
    weakArea: string | null;
    progressionMode: ProgressionMode;
    progressResult: unknown;
    sources: RetrievedKnowledgeChunk[];
  },
): Promise<AssistantStructuredAnswer> {
  const index = accumulator.steps.length + 1;
  const thought = "综合容量、弱项、进展与知识来源，给出只改一个变量的保守下周草案。";
  await emitStarted(deps, {
    index,
    kind: "synthesis",
    title: "生成下周草案",
    thought,
    tool_name: null,
  });

  const startedAt = now();
  const answer = buildPlanAnswer(accumulator, context);
  const durationMs = Math.max(0, now() - startedAt);
  const observation = `已生成下周草案（策略：${describeProgressionMode(context.progressionMode)}）。`;

  recordStep(accumulator, {
    kind: "synthesis",
    title: "生成下周草案",
    thought,
    toolName: null,
    status: "success",
    durationMs,
    observation,
  });
  await emitFinished(deps, index, "success", durationMs, observation);

  return answer;
}

function buildPlanAnswer(
  accumulator: StepAccumulator,
  context: {
    input: NextWeekPlanAgentInput;
    weeklyResult: unknown;
    weakArea: string | null;
    progressionMode: ProgressionMode;
    progressResult: unknown;
    sources: RetrievedKnowledgeChunk[];
  },
): AssistantStructuredAnswer {
  const weekly = asRecord(context.weeklyResult);
  const totals = asRecord(weekly?.totals);
  const frequency = asRecord(weekly?.frequency);
  const workoutCount = readNumber(totals?.workout_count) ?? 0;
  const setCount = readNumber(totals?.set_count) ?? 0;
  const workoutsPerWeek = readNumber(frequency?.workouts_per_week);

  const bullets = [
    `容量基线：范围内记录 ${workoutCount} 次训练、${setCount} 组${
      workoutsPerWeek === null ? "" : `，近期约每周 ${workoutsPerWeek} 次`
    }。`,
    context.weakArea
      ? `弱项：${context.weakArea} 记录偏少，可小幅、可控地补一点关注。`
      : "弱项：当前分布相对均衡，没有明显被忽略的部位。",
    buildProgressBullet(context.progressResult),
    `策略：${describeProgressionGuidance(context.progressionMode)}，一次只改一个变量（组数 / 重量 / 次数 / 休息）。`,
    context.sources.length > 0
      ? `Sources：${context.sources.map((source) => source.title).join("、")}。`
      : "本次没有检索到可用训练知识来源，草案仅基于训练记录。",
  ];

  return {
    summary:
      "下面是一份基于你的训练 Evidence、弱项分析和训练知识 Sources 的保守下周训练草案。请把它当作规划草案，而不是处方。",
    bullets,
    conclusion:
      "多步规划只整合已记录训练与检索到的通用训练知识，给出下一步草案，而不是完整训练处方。",
    recommendation: describeProgressionRecommendation(context.progressionMode, context.weakArea),
    evidence: buildAggregatedEvidence(accumulator),
    sources: toAnswerSources(context.sources),
    intent: "next_week_plan",
    limitations: [
      "这不是医疗建议、康复指导或专业教练处方。",
      "如果出现疼痛、麻木或异常疲劳，不要硬按草案执行。",
      "这份草案只反映已记录训练和检索到的通用训练知识。",
    ],
  };
}

function buildNoDataAnswer(
  input: NextWeekPlanAgentInput,
  accumulator: StepAccumulator,
): AssistantStructuredAnswer {
  return {
    summary:
      "这段时间还没有足够的训练记录来规划下周计划。先记录几次包含组数、次数和重量的训练，多步规划才能基于真实 Evidence 给出草案。",
    bullets: [
      `统计范围：${input.startDate} 到 ${input.endDate}。`,
      "当前记录训练次数：0 次，规划在第一步就停止了。",
      "没有可用于容量、弱项或进展分析的 Evidence。",
    ],
    conclusion: "没有训练数据时，更安全的行为是停止规划并提示先记录训练。",
    recommendation: "先完成几次训练记录，然后再让助手规划下周。",
    evidence: buildAggregatedEvidence(accumulator),
    sources: [],
    intent: "next_week_plan",
    limitations: [
      "这不是医疗建议、康复指导或专业教练处方。",
      "在没有训练记录时，助手不会编造训练量或进展数字。",
    ],
  };
}

function buildProgressBullet(progressResult: unknown): string {
  const progress = asRecord(progressResult);

  if (!progress) {
    return "进展：未指定具体动作，下周草案按整体训练分布安排。";
  }

  const exercise = asRecord(progress.exercise);
  const totals = asRecord(progress.totals);
  const exerciseName = readString(exercise?.exercise_name) ?? "所选动作";
  const oneRm = readNumber(totals?.estimated_1rm_kg);
  const maxWeight = readNumber(totals?.max_weight_kg);

  return `进展：${exerciseName} 估算 1RM ${formatKg(oneRm)}、最高重量 ${formatKg(maxWeight)}，作为推进幅度参考。`;
}

function resolveWeakArea(
  weeklyResult: unknown,
  recommendationResult: unknown,
): string | null {
  const weekly = asRecord(weeklyResult);
  const lowVolumeGroups = asArray(weekly?.low_volume_muscle_groups);
  const firstLow = asRecord(lowVolumeGroups[0]);
  const lowName = readString(firstLow?.muscle_group_name);

  if (lowName) {
    return lowName;
  }

  const recommendation = asRecord(recommendationResult);
  const summary = asRecord(recommendation?.summary);
  const byExercise = asArray(summary?.by_exercise);
  const firstExercise = asRecord(byExercise[0]);

  return readString(firstExercise?.exercise_name);
}

function resolveProgressionMode(weeklyResult: unknown): ProgressionMode {
  const weekly = asRecord(weeklyResult);
  const frequency = asRecord(weekly?.frequency);
  const workoutsPerWeek = readNumber(frequency?.workouts_per_week);

  if (workoutsPerWeek === null) {
    return "maintain";
  }

  if (workoutsPerWeek >= HIGH_WEEKLY_FREQUENCY) {
    return "consolidate";
  }

  if (workoutsPerWeek <= LOW_WEEKLY_FREQUENCY) {
    return "add_frequency";
  }

  return "maintain";
}

function describeProgressionMode(mode: ProgressionMode): string {
  switch (mode) {
    case "consolidate":
      return "巩固 / 控制疲劳";
    case "add_frequency":
      return "可小幅加量";
    case "maintain":
      return "维持基线";
  }
}

function describeProgressionGuidance(mode: ProgressionMode): string {
  switch (mode) {
    case "consolidate":
      return "近期频率偏高，下周以巩固和控制疲劳为主，不要再大幅加量";
    case "add_frequency":
      return "近期频率偏低，下周可以保守地补一次训练或小幅加量";
    case "maintain":
      return "频率适中，下周维持基线、只做小幅优化";
  }
}

function describeProgressionRecommendation(
  mode: ProgressionMode,
  weakArea: string | null,
): string {
  const weakClause = weakArea
    ? `并给 ${weakArea} 安排一点可控的补充`
    : "并保持整体均衡";

  switch (mode) {
    case "consolidate":
      return `下周建议保持相近频率甚至略降疲劳，${weakClause}，只设定一个重点推进目标。`;
    case "add_frequency":
      return `下周可以保守地增加一次训练，${weakClause}，记录完后再复盘。`;
    case "maintain":
      return `下周保持相近频率、略微改善分布，${weakClause}，只设定一个重点推进目标。`;
  }
}

function summarizeToolObservation(toolName: string, result: unknown): string {
  const record = asRecord(result);

  if (toolName === "get_weekly_training_report") {
    const totals = asRecord(record?.totals);
    const frequency = asRecord(record?.frequency);
    const topMuscle = asRecord(asArray(record?.top_muscle_groups)[0]);
    const lowMuscle = asRecord(asArray(record?.low_volume_muscle_groups)[0]);

    return [
      `训练 ${readNumber(totals?.workout_count) ?? 0} 次 / ${readNumber(totals?.set_count) ?? 0} 组`,
      `约每周 ${readNumber(frequency?.workouts_per_week) ?? 0} 次`,
      topMuscle ? `占比最高：${readString(topMuscle.muscle_group_name) ?? "未知"}` : null,
      lowMuscle ? `偏少：${readString(lowMuscle.muscle_group_name) ?? "未知"}` : null,
    ]
      .filter((part): part is string => part !== null)
      .join("；");
  }

  if (toolName === "get_recommendation_context") {
    const summary = asRecord(record?.summary);
    const byExercise = asArray(summary?.by_exercise);
    const firstExercise = asRecord(byExercise[0]);

    return [
      `参考 ${readNumber(summary?.workout_count) ?? 0} 次训练`,
      firstExercise
        ? `训练量最集中：${readString(firstExercise.exercise_name) ?? "未知"}`
        : "暂无集中动作",
    ].join("；");
  }

  if (toolName === "get_exercise_progress") {
    const exercise = asRecord(record?.exercise);
    const totals = asRecord(record?.totals);

    return `${readString(exercise?.exercise_name) ?? "所选动作"}：1RM ${formatKg(readNumber(totals?.estimated_1rm_kg))}、最高 ${formatKg(readNumber(totals?.max_weight_kg))}`;
  }

  return "已获取结果。";
}

function buildAggregatedEvidence(accumulator: StepAccumulator): AssistantAnswerEvidence {
  return {
    source: "deterministic_tool_executor",
    tool_names: [...accumulator.toolNames],
    workout_ids: [...accumulator.workoutIds],
    set_ids: [...accumulator.setIds],
    calculation_rules: [...accumulator.calculationRules],
  };
}

function accumulateEvidence(
  accumulator: StepAccumulator,
  toolName: string,
  result: unknown,
): void {
  accumulator.toolNames.add(toolName);

  const evidence = asRecord(asRecord(result)?.evidence);

  for (const id of asStringArray(evidence?.workout_ids)) {
    accumulator.workoutIds.add(id);
  }

  for (const id of asStringArray(evidence?.set_ids)) {
    accumulator.setIds.add(id);
  }

  for (const rule of asStringArray(evidence?.calculation_rules)) {
    accumulator.calculationRules.add(rule);
  }
}

function recordStep(
  accumulator: StepAccumulator,
  step: {
    kind: AgentStepKind;
    title: string;
    thought: string;
    toolName: string | null;
    status: AgentStepStatus;
    durationMs: number;
    observation: string;
  },
): void {
  accumulator.steps.push({
    index: accumulator.steps.length + 1,
    kind: step.kind,
    title: step.title,
    thought: step.thought,
    tool_name: step.toolName,
    observation: step.observation,
    status: step.status,
    duration_ms: step.durationMs,
  });
}

function buildTrace(
  steps: AgentTraceStep[],
  stopReason: AgentTrace["stop_reason"],
): AgentTrace {
  return {
    goal: AGENT_GOAL,
    steps,
    max_steps: AGENT_MAX_STEPS,
    stop_reason: stopReason,
  };
}

function buildRangeArgs(input: NextWeekPlanAgentInput): {
  start_date: string;
  end_date: string;
} {
  return {
    start_date: input.startDate,
    end_date: input.endDate,
  };
}

function isEmptyWeeklyReport(result: unknown): boolean {
  const record = asRecord(result);

  if (readString(record?.status) === "empty") {
    return true;
  }

  const totals = asRecord(record?.totals);

  return (readNumber(totals?.workout_count) ?? 0) === 0;
}

function toAnswerSources(
  chunks: RetrievedKnowledgeChunk[],
): AssistantAnswerSource[] {
  return chunks.map((chunk) => ({
    id: chunk.id,
    title: chunk.title,
    category: chunk.category,
    chunk_text: chunk.chunk_text,
    source_type: chunk.source_type,
    tags: chunk.tags,
  }));
}

async function emitStarted(
  deps: NextWeekPlanAgentDeps,
  event: Omit<Extract<AgentStepEvent, { phase: "started" }>, "phase">,
): Promise<void> {
  await deps.onStep?.({ phase: "started", ...event });
}

async function emitFinished(
  deps: NextWeekPlanAgentDeps,
  index: number,
  status: AgentStepStatus,
  durationMs: number,
  observation: string,
): Promise<void> {
  await deps.onStep?.({
    phase: "finished",
    index,
    status,
    duration_ms: durationMs,
    observation,
  });
}

async function emitStartedFor(
  deps: NextWeekPlanAgentDeps,
  step: AgentTraceStep | undefined,
): Promise<void> {
  if (!step) {
    return;
  }

  await emitStarted(deps, {
    index: step.index,
    kind: step.kind,
    title: step.title,
    thought: step.thought,
    tool_name: step.tool_name,
  });
}

async function emitFinishedFor(
  deps: NextWeekPlanAgentDeps,
  step: AgentTraceStep | undefined,
): Promise<void> {
  if (!step) {
    return;
  }

  await emitFinished(deps, step.index, step.status, step.duration_ms, step.observation);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  return asArray(value).filter((item): item is string => typeof item === "string");
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function formatKg(value: number | null): string {
  return value === null ? "暂无结果" : `${value.toLocaleString()} kg`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
}
