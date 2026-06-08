import type {
  AssistantChatMessage,
  AssistantMessageEvidence,
  AssistantMessageSource,
  AssistantStructuredOutput,
} from "./assistant-types";

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
          intent: output.intent,
          limitations: output.answer?.limitations ?? [],
          messageId: output.message_id ?? message.messageId,
          sources: normalizeSources(output),
        }
      : message,
  );
}
