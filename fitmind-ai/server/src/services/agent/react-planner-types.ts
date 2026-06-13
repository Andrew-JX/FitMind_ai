import type { RetrievedKnowledgeChunk } from "../rag/knowledge-retriever.js";
import type { AssistantStructuredAnswer } from "../assistant/assistant-answer-composer.js";

/** Each step is either a deterministic tool call, a RAG retrieval, or the final synthesis. */
export type AgentStepKind = "tool" | "retrieval" | "synthesis";

/** Outcome of a single ReAct step. `skipped` means the policy chose not to run it. */
export type AgentStepStatus = "success" | "error" | "skipped";

/** Why the ReAct loop stopped. */
export type AgentStopReason = "completed" | "no_data" | "max_steps" | "error";

/**
 * One persisted ReAct step: the thought (why), the action (tool/retrieval), and
 * the observation (summarized result). Rendered as a trace timeline in the UI.
 */
export interface AgentTraceStep {
  index: number;
  kind: AgentStepKind;
  title: string;
  thought: string;
  tool_name: string | null;
  observation: string;
  status: AgentStepStatus;
  duration_ms: number;
}

export interface AgentTrace {
  goal: string;
  steps: AgentTraceStep[];
  max_steps: number;
  stop_reason: AgentStopReason;
}

export interface AgentToolCallSummary {
  tool_name: string;
  status: "success" | "error";
  duration_ms: number;
}

export interface NextWeekPlanAgentOutput {
  trace: AgentTrace;
  tool_calls: AgentToolCallSummary[];
  answer: AssistantStructuredAnswer;
}

/** Live event emitted while the loop runs, mirroring the persisted trace steps. */
export type AgentStepEvent =
  | {
      phase: "started";
      index: number;
      kind: AgentStepKind;
      title: string;
      thought: string;
      tool_name: string | null;
    }
  | {
      phase: "finished";
      index: number;
      status: AgentStepStatus;
      duration_ms: number;
      observation: string;
    };

export interface NextWeekPlanAgentInput {
  message: string;
  startDate: string;
  endDate: string;
  exerciseId?: string | null | undefined;
}

export interface NextWeekPlanAgentDeps {
  /** Executes a deterministic training tool by name; returns the raw tool result. */
  runTool: (toolName: string, args: unknown) => Promise<unknown>;
  /** Retrieves knowledge chunks for the synthesis step. */
  retrieve: (query: string) => Promise<RetrievedKnowledgeChunk[]>;
  /** Optional live step callback for SSE streaming. */
  onStep?: ((event: AgentStepEvent) => void | Promise<void>) | undefined;
  /** Injectable clock for deterministic step durations in tests. */
  now?: (() => number) | undefined;
}
