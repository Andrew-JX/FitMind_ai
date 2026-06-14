import type {
  AssistantChatMessage,
  AssistantMessageEvidence,
  AssistantMessageFaithfulness,
  AssistantMessageSource,
  AssistantPlanDraft,
  AssistantPlanStrategy,
  AssistantStructuredOutput,
} from "./assistant-types";

function normalizeFaithfulness(
  output: AssistantStructuredOutput,
): AssistantMessageFaithfulness | undefined {
  const faithfulness = output.faithfulness;

  if (
    !faithfulness ||
    (faithfulness.status !== "verified" && faithfulness.status !== "flagged")
  ) {
    return undefined;
  }

  return {
    status: faithfulness.status,
    checkedNumbers: faithfulness.checkedNumbers ?? 0,
    unverifiedClaimCount: faithfulness.unverifiedClaims?.length ?? 0,
  };
}

const PLAN_STRATEGIES: readonly AssistantPlanStrategy[] = [
  "consolidate",
  "add_frequency",
  "maintain",
];

function normalizePlanStrategy(value: string | undefined): AssistantPlanStrategy {
  return PLAN_STRATEGIES.find((strategy) => strategy === value) ?? "maintain";
}

function normalizePlan(
  output: AssistantStructuredOutput,
): AssistantPlanDraft | undefined {
  const plan = output.plan;
  const exercises = plan?.exercises ?? [];

  if (!plan || exercises.length === 0) {
    return undefined;
  }

  return {
    strategy: normalizePlanStrategy(plan.strategy),
    exercises: exercises.map((exercise) => ({
      exerciseName: exercise.exercise_name ?? "未命名动作",
      sets: exercise.sets ?? 0,
      repMin: exercise.rep_min ?? 0,
      repMax: exercise.rep_max ?? 0,
      targetWeightKg: exercise.target_weight_kg ?? null,
      basis: exercise.basis ?? "",
    })),
    notes: plan.notes ?? [],
  };
}

function normalizeEvidence(
  output: AssistantStructuredOutput,
): AssistantMessageEvidence | undefined {
  const evidence = output.answer?.evidence;

  if (!evidence) {
    return undefined;
  }

  return {
    calculationRules: evidence.calculation_rules ?? [],
    setIds: evidence.set_ids ?? [],
    toolNames: evidence.tool_names ?? [],
    workoutIds: evidence.workout_ids ?? [],
  };
}

function normalizeSources(
  output: AssistantStructuredOutput,
): AssistantMessageSource[] {
  return (output.answer?.sources ?? []).map((source) => ({
    category: source.category ?? "unknown",
    chunkText: source.chunk_text ?? "",
    id: source.id ?? source.title ?? "source",
    sourceType: source.source_type ?? "unknown",
    tags: source.tags ?? [],
    title: source.title ?? "未命名来源",
  }));
}

export function mergeStructuredOutputIntoMessage(
  messages: AssistantChatMessage[],
  assistantMessageId: string,
  output: AssistantStructuredOutput,
): AssistantChatMessage[] {
  return messages.map((message) =>
    message.id === assistantMessageId
      ? {
          ...message,
          evidence: normalizeEvidence(output),
          faithfulness: normalizeFaithfulness(output),
          intent: output.intent,
          limitations: output.answer?.limitations ?? [],
          messageId: output.message_id ?? message.messageId,
          plan: normalizePlan(output),
          sources: normalizeSources(output),
        }
      : message,
  );
}
