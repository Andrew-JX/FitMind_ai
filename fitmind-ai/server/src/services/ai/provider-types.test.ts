import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type {
  AssistantIntentMode,
  AssistantProviderUsage,
  OpenAiCompatibleProviderName,
} from "./provider-types.js";

type ExpectedAssistantIntentMode =
  | "auto"
  | "training_overview"
  | "weekly_report"
  | "exercise_progress"
  | "plateau_diagnosis"
  | "next_training_focus"
  | "next_week_plan"
  | "muscle_balance"
  | "training_imbalance"
  | "recovery_check"
  | "evidence_explain"
  | "unsupported";

type IsExactIntentUnion = [AssistantIntentMode] extends [
  ExpectedAssistantIntentMode,
]
  ? [ExpectedAssistantIntentMode] extends [AssistantIntentMode]
    ? true
    : false
  : false;

const serviceDirectory = dirname(fileURLToPath(import.meta.url));

describe("neutral AI provider primitive types characterization", () => {
  it("keeps the provider names, intent union, and usage shape exact", () => {
    const providers: OpenAiCompatibleProviderName[] = [
      "groq",
      "openai_compatible",
    ];
    const exactIntentUnion: IsExactIntentUnion = true;
    const usage: AssistantProviderUsage = {
      prompt_tokens: 3,
      completion_tokens: 2,
      total_tokens: 5,
    };

    // @ts-expect-error Anthropic is not an OpenAI-compatible provider name.
    const invalidProvider: OpenAiCompatibleProviderName = "anthropic";
    // @ts-expect-error Usage always includes the aggregate token count.
    const incompleteUsage: AssistantProviderUsage = {
      prompt_tokens: 3,
      completion_tokens: 2,
    };

    expect(providers).toEqual(["groq", "openai_compatible"]);
    expect(exactIntentUnion).toBe(true);
    expect(usage).toEqual({
      prompt_tokens: 3,
      completion_tokens: 2,
      total_tokens: 5,
    });
    expect(invalidProvider).toBe("anthropic");
    expect(incompleteUsage).not.toHaveProperty("total_tokens");
  });

  it("keeps one definition owner and a one-way module dependency", () => {
    const neutralSource = readFileSync(
      join(serviceDirectory, "provider-types.ts"),
      "utf8",
    );
    const assistantSource = readFileSync(
      join(serviceDirectory, "../assistant/provider-types.ts"),
      "utf8",
    );
    const definitions = [
      /export type OpenAiCompatibleProviderName\b/g,
      /export type AssistantIntentMode\b/g,
      /export interface AssistantProviderUsage\b/g,
    ];

    for (const definition of definitions) {
      expect(
        (neutralSource.match(definition) ?? []).length +
          (assistantSource.match(definition) ?? []).length,
      ).toBe(1);
    }

    const neutralDependsOnAssistant = neutralSource.includes(
      'from "../assistant/provider-types.js"',
    );
    const assistantDependsOnNeutral = assistantSource.includes(
      'from "../ai/provider-types.js"',
    );
    expect(
      Number(neutralDependsOnAssistant) + Number(assistantDependsOnNeutral),
    ).toBe(1);
    expect(neutralSource).not.toContain("as unknown as");
    expect(neutralSource).not.toMatch(/\bany\b/u);
    expect(neutralSource).not.toContain("@ts-ignore");
  });
});
