import { describe, expect, it } from "vitest";

import { getToolDefinitionForMode } from "./assistant-orchestrator-service.js";
import { coerceMessageToEvidenceToolCall } from "./assistant-provider-fallback.js";
import type { AssistantIntentMode } from "./provider-types.js";
import { trainingAiTools } from "../ai/tools/training-tools.js";

/**
 * Every assistant intent mode that getToolDefinitionForMode can be asked about.
 * Mirrors the AssistantIntentMode union so a new mode forces a compile error here.
 */
const ALL_MODES: AssistantIntentMode[] = [
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
];

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

/** Build a fully-valid arg object for a tool so we can probe one missing field at a time. */
function validArgsForTool(toolName: string): Record<string, string> {
  const base = { start_date: "2026-05-19", end_date: "2026-06-17" };

  if (toolName === "get_exercise_progress") {
    return { ...base, exercise_id: VALID_UUID };
  }

  return base;
}

describe("assistant provider tool contract", () => {
  it("declares input_fields that are all REQUIRED by the matching real zod schema (no drift)", () => {
    for (const mode of ALL_MODES) {
      const definition = getToolDefinitionForMode(mode);
      const realTool = trainingAiTools.find(
        (tool) => tool.name === definition.name,
      );

      expect(
        realTool,
        `${definition.name} (mode=${mode}) must exist in trainingAiTools`,
      ).toBeDefined();
      if (realTool === undefined) {
        continue;
      }

      // Sanity: a full valid arg set parses. Use exercise_id only for tools that take it.
      const fullArgs = validArgsForTool(definition.name);
      expect(
        realTool.inputSchema.safeParse(fullArgs).success,
        `${definition.name} should accept its valid full args`,
      ).toBe(true);

      // Each declared input_field must be genuinely required: omitting it must fail.
      for (const field of definition.input_fields) {
        const probed: Record<string, string> = { ...fullArgs };
        delete probed[field];

        expect(
          realTool.inputSchema.safeParse(probed).success,
          `${definition.name}.input_fields lists "${field}" as required, but the real schema treats it as optional (contract drift)`,
        ).toBe(false);
      }
    }
  });

  it("coerces a weekly-report prose reply into a tool call even without an exercise_id (P1 regression)", () => {
    const definition = getToolDefinitionForMode("weekly_report");

    const result = coerceMessageToEvidenceToolCall(
      { kind: "message", message: "这是你的周报概述……" },
      definition,
      { start_date: "2026-05-19", end_date: "2026-06-17" },
    );

    expect(result).toEqual({
      kind: "tool_call",
      tool_name: "get_weekly_training_report",
      tool_args: { start_date: "2026-05-19", end_date: "2026-06-17" },
    });
  });
});
