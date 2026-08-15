import type {
  AssistantChatMessage,
  AssistantClarification,
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

/**
 * Normalizes a clarification payload, dropping anything malformed.
 *
 * @remarks
 * A half-valid clarification is worse than none: the buttons would submit an
 * id the server never offered, so incomplete options are dropped rather than
 * rendered.
 *
 * An exercise clarification with zero options is still kept — that is the
 * server's `unresolved` state, meaning "type the exercise name", and the
 * message must stay marked as a clarification so it cannot be saved as an
 * insight. A date-range clarification with zero options carries nothing at all
 * and degrades to `undefined`.
 *
 * @param output - Raw structured output from the stream
 * @returns The normalized clarification, or undefined when unusable
 */
function normalizeClarification(
  output: AssistantStructuredOutput,
): AssistantClarification | undefined {
  const clarification = output.clarification;

  if (!clarification) {
    return undefined;
  }

  if (clarification.kind === "exercise") {
    // Unknown future values fall back to "unresolved", the conservative
    // "cannot proceed" bucket, rather than collapsing the known ones.
    const reason =
      clarification.reason === "ambiguous" || clarification.reason === "missing"
        ? clarification.reason
        : "unresolved";
    const options = (clarification.options ?? []).flatMap((option) =>
      option.exercise_id && option.exercise_name
        ? [
            {
              exerciseId: option.exercise_id,
              exerciseName: option.exercise_name,
            },
          ]
        : [],
    );

    return { kind: "exercise", options, reason };
  }

  if (clarification.kind === "date_range") {
    const options = (clarification.options ?? []).flatMap((option) =>
      option.label && option.start_date && option.end_date
        ? [
            {
              endDate: option.end_date,
              label: option.label,
              startDate: option.start_date,
            },
          ]
        : [],
    );

    return options.length > 0
      ? { kind: "date_range", options, reason: "ambiguous" }
      : undefined;
  }

  return undefined;
}

const PLAN_STRATEGIES: readonly AssistantPlanStrategy[] = [
  "consolidate",
  "add_frequency",
  "maintain",
];

function normalizePlanStrategy(
  value: string | undefined,
): AssistantPlanStrategy {
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
    exercises: exercises.map(normalizePlanExercise),
    sessions: (plan.sessions ?? []).map((session, index) => ({
      sessionIndex: session.session_index ?? index + 1,
      title: session.title ?? `训练日 ${index + 1}`,
      focusAreas: session.focus_areas ?? [],
      estimatedDurationMinutes: session.estimated_duration_minutes ?? 0,
      exercises: (session.exercises ?? []).map(normalizePlanExercise),
    })),
    notes: plan.notes ?? [],
  };
}

function normalizePlanExercise(
  exercise: NonNullable<
    NonNullable<AssistantStructuredOutput["plan"]>["exercises"]
  >[number],
) {
  return {
    ...(exercise.exercise_id ? { exerciseId: exercise.exercise_id } : {}),
    exerciseName: exercise.exercise_name ?? "未命名动作",
    sets: exercise.sets ?? 0,
    repMin: exercise.rep_min ?? 0,
    repMax: exercise.rep_max ?? 0,
    targetWeightKg: exercise.target_weight_kg ?? null,
    restSeconds: exercise.rest_seconds ?? 90,
    equipment: exercise.equipment ?? null,
    movementPattern: exercise.movement_pattern ?? null,
    primaryMuscles: exercise.primary_muscles ?? [],
    alternatives: (exercise.alternatives ?? [])
      .filter(
        (alternative) =>
          Boolean(alternative.exercise_id) &&
          Boolean(alternative.exercise_name),
      )
      .map((alternative) => ({
        exerciseId: alternative.exercise_id ?? "",
        exerciseName: alternative.exercise_name ?? "未命名动作",
        equipment: alternative.equipment ?? null,
        movementPattern: alternative.movement_pattern ?? null,
        primaryMuscles: alternative.primary_muscles ?? [],
        restSeconds: alternative.rest_seconds ?? 90,
      })),
    basis: exercise.basis ?? "",
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
          clarification: normalizeClarification(output),
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
