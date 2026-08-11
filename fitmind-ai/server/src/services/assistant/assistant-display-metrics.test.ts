import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import * as displayMetrics from "./assistant-display-metrics.js";

const { formatMetricKg, formatPercent, getDaysSince } = displayMetrics;
const assistantDirectory = dirname(fileURLToPath(import.meta.url));
const helperNames = [
  "formatMetricKg",
  "formatPercent",
  "getDaysSince",
] as const;

afterEach(() => {
  vi.useRealTimers();
});

describe("assistant display metrics characterization", () => {
  it("keeps the runtime helper surface exact", () => {
    expect(Object.keys(displayMetrics).sort()).toEqual([...helperNames]);
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
    const metricsSource = readFileSync(
      join(assistantDirectory, "assistant-display-metrics.ts"),
      "utf8",
    );

    for (const helperName of helperNames) {
      const definition = new RegExp(`export function ${helperName}\\b`, "g");
      const definitionCount =
        (orchestratorSource.match(definition) ?? []).length +
        (answersSource.match(definition) ?? []).length +
        (metricsSource.match(definition) ?? []).length;
      expect(definitionCount, helperName).toBe(1);
    }

    expect(orchestratorSource).toContain(
      'from "./assistant-deterministic-answers.js"',
    );
    expect(answersSource).toContain('from "./assistant-display-metrics.js"');
    expect(orchestratorSource).not.toContain(
      'from "./assistant-display-metrics.js"',
    );
    expect(metricsSource).not.toContain(
      'from "./assistant-orchestrator-service.js"',
    );
    expect(metricsSource).not.toContain(
      'from "./assistant-deterministic-answers.js"',
    );
    expect(metricsSource).not.toContain("as unknown as");
    expect(metricsSource).not.toMatch(/\bany\b/);
  });

  it.each([
    { input: null, expected: "暂无结果" },
    { input: 0, expected: "0 kg" },
    { input: 100.24, expected: "100 kg" },
    { input: 100.25, expected: "100.5 kg" },
    { input: -1.26, expected: "-1.5 kg" },
    { input: 12_000, expected: "12,000 kg" },
  ])("formats metric kilograms for $input", ({ input, expected }) => {
    expect(formatMetricKg(input)).toBe(expected);
  });

  it.each([
    { input: 0, expected: "0.0%" },
    { input: 0.4, expected: "40.0%" },
    { input: 0.1236, expected: "12.4%" },
    { input: -0.1, expected: "-10.0%" },
    { input: 1.25, expected: "125.0%" },
  ])("formats percentages for $input", ({ input, expected }) => {
    expect(formatPercent(input)).toBe(expected);
  });

  it("floors elapsed 24-hour buckets and clamps invalid or future dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T12:00:00.000Z"));

    expect(getDaysSince("not-a-date")).toBe(0);
    expect(getDaysSince("2026-08-12T12:00:00.000Z")).toBe(0);
    expect(getDaysSince("2026-08-10T12:00:01.000Z")).toBe(0);
    expect(getDaysSince("2026-08-10T12:00:00.000Z")).toBe(1);
    expect(getDaysSince("2026-08-09T14:24:00.000Z")).toBe(1);
  });
});
