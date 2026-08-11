import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import * as focusArea from "./assistant-focus-area.js";
import type { FocusArea } from "./assistant-focus-area.js";

const {
  describeTargetArea,
  detectTargetArea,
  inferDominantFocusArea,
  inferFocusAreaFromName,
  resolveNextFocusSuggestion,
} = focusArea;
const assistantDirectory = dirname(fileURLToPath(import.meta.url));
const helperNames = [
  "describeTargetArea",
  "detectTargetArea",
  "inferDominantFocusArea",
  "inferFocusAreaFromName",
  "resolveNextFocusSuggestion",
] as const;

describe("assistant focus-area characterization", () => {
  it("keeps the runtime helper surface exact", () => {
    expect(Object.keys(focusArea).sort()).toEqual([...helperNames]);
  });

  it("keeps one definition owner behind the deterministic-answer boundary", () => {
    const orchestratorSource = readFileSync(
      join(assistantDirectory, "assistant-orchestrator-service.ts"),
      "utf8",
    );
    const answersSource = readFileSync(
      join(assistantDirectory, "assistant-deterministic-answers.ts"),
      "utf8",
    );
    const focusSource = readFileSync(
      join(assistantDirectory, "assistant-focus-area.ts"),
      "utf8",
    );

    for (const helperName of helperNames) {
      const definition = new RegExp(`export function ${helperName}\\b`, "g");
      const definitionCount =
        (orchestratorSource.match(definition) ?? []).length +
        (answersSource.match(definition) ?? []).length +
        (focusSource.match(definition) ?? []).length;
      expect(definitionCount, helperName).toBe(1);
    }

    expect(orchestratorSource).toContain(
      'from "./assistant-deterministic-answers.js"',
    );
    expect(answersSource).toContain('from "./assistant-focus-area.js"');
    expect(orchestratorSource).not.toContain(
      'from "./assistant-focus-area.js"',
    );
    expect(focusSource).not.toContain(
      'from "./assistant-orchestrator-service.js"',
    );
    expect(focusSource).not.toContain(
      'from "./assistant-deterministic-answers.js"',
    );
  });

  it("preserves exercise-name classification and overlapping regex priority", () => {
    expect(inferFocusAreaFromName("Barbell Bench Press")).toBe("chest");
    expect(inferFocusAreaFromName("Romanian Deadlift")).toBe("back");
    expect(inferFocusAreaFromName("Bulgarian Split Squat")).toBe("legs");
    expect(inferFocusAreaFromName("Dumbbell Lateral Raise")).toBe("shoulders");
    expect(inferFocusAreaFromName("Overhead Press")).toBe("shoulders");
    expect(inferFocusAreaFromName("Pilates Roll Up")).toBe("unknown");
    expect(inferFocusAreaFromName("Lat Pulldown")).toBe("back");
    expect(inferFocusAreaFromName("Lats")).toBe("back");
    expect(inferFocusAreaFromName("Barbell Curl")).toBe("unknown");
  });

  it("detects Chinese and English target-area messages", () => {
    expect(detectTargetArea("今天练胸")).toBe("chest");
    expect(detectTargetArea("安排一些划船动作")).toBe("back");
    expect(detectTargetArea("深蹲怎么加重量")).toBe("legs");
    expect(detectTargetArea("add lateral raise")).toBe("shoulders");
    expect(detectTargetArea("今天练肩")).toBe("shoulders");
    expect(detectTargetArea("latest news")).toBe("unknown");
    expect(detectTargetArea("train lats")).toBe("back");
    expect(detectTargetArea("lat pulldown")).toBe("back");
  });

  it("does not route neighboring non-fitness topics", () => {
    expect(detectTargetArea("模型训练进度怎么样")).toBe("unknown");
    expect(detectTargetArea("我女朋友生气了")).toBe("unknown");
    expect(detectTargetArea("帮我总结本周计划")).toBe("unknown");
  });

  it("uses accumulated volume for a single dominant area", () => {
    expect(
      inferDominantFocusArea([
        { exercise_name: "Bench Press", total_volume: 60 },
        { exercise_name: "Push-up", total_volume: 40 },
        { exercise_name: "Barbell Row", total_volume: 70 },
      ]),
    ).toBe("chest");
  });

  it("keeps empty, mixed, and exact 1.25 dominance boundaries", () => {
    expect(inferDominantFocusArea([])).toBe("unknown");
    expect(
      inferDominantFocusArea([
        { exercise_name: "Bench Press", total_volume: 100 },
        { exercise_name: "Barbell Row", total_volume: 90 },
      ]),
    ).toBe("mixed");
    expect(
      inferDominantFocusArea([
        { exercise_name: "Bench Press", total_volume: 100 },
        { exercise_name: "Barbell Row", total_volume: 80 },
      ]),
    ).toBe("chest");
  });

  it("keeps every suggestion and description string exact", () => {
    const expected: Record<
      FocusArea,
      { description: string; suggestion: string }
    > = {
      back: { description: "背部", suggestion: "腿部或胸推动作" },
      chest: { description: "胸部", suggestion: "背部或腿部" },
      legs: { description: "腿部", suggestion: "背部或胸推动作" },
      mixed: {
        description: "多部位",
        suggestion: "最近训练量相对没那么集中的部位",
      },
      shoulders: { description: "肩部", suggestion: "背部或腿部" },
      unknown: {
        description: "这类部位",
        suggestion: "训练记录相对较少的部位",
      },
    };

    for (const area of Object.keys(expected) as FocusArea[]) {
      expect(describeTargetArea(area), area).toBe(expected[area].description);
      expect(resolveNextFocusSuggestion(area), area).toBe(
        expected[area].suggestion,
      );
    }
  });
});
