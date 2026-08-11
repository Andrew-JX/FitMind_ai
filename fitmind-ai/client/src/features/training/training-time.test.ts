import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import * as trainingTime from "./training-time";

const {
  formatDateTimeLocalValue,
  formatTimeOnly,
  formatTrainingTimeSummary,
  getDurationMinutesFromLocalValues,
  parseDateTimeLocalValue,
} = trainingTime;
const trainingDirectory = dirname(fileURLToPath(import.meta.url));
const helperNames = [
  "formatDateTimeLocalValue",
  "formatTimeOnly",
  "formatTrainingTimeSummary",
  "getDurationMinutesFromLocalValues",
  "parseDateTimeLocalValue",
] as const;

describe("training time characterization", () => {
  it("keeps the public helper surface exact", () => {
    expect(Object.keys(trainingTime).sort()).toEqual([...helperNames]);
  });

  it("keeps one definition owner and a one-way module dependency", () => {
    const composerSource = readFileSync(
      join(trainingDirectory, "TrainingSessionComposer.tsx"),
      "utf8",
    );
    const timeSource = readFileSync(
      join(trainingDirectory, "training-time.ts"),
      "utf8",
    );

    for (const helperName of helperNames) {
      const definition = new RegExp(`export function ${helperName}\\b`, "g");
      const definitionCount =
        (composerSource.match(definition) ?? []).length +
        (timeSource.match(definition) ?? []).length;
      expect(definitionCount, helperName).toBe(1);
    }

    const composerDependsOnTime = composerSource.includes(
      'from "./training-time"',
    );
    const timeDependsOnComposer = timeSource.includes(
      'from "./TrainingSessionComposer"',
    );
    expect(Number(composerDependsOnTime) + Number(timeDependsOnComposer)).toBe(
      1,
    );
  });

  it("prioritizes a start/end range over duration and performed date", () => {
    const startedAt = new Date(2026, 7, 11, 9, 5).toISOString();
    const endedAt = new Date(2026, 7, 11, 10, 35).toISOString();

    expect(
      formatTrainingTimeSummary({
        durationMin: 90,
        endedAt,
        performedAt: startedAt,
        startedAt,
      }),
    ).toBe("09:05 - 10:35");
  });

  it("falls through the remaining summary branches in order", () => {
    expect(
      formatTrainingTimeSummary({
        durationMin: 45,
        endedAt: null,
        performedAt: "2026-08-11",
        startedAt: null,
      }),
    ).toBe("45 分钟");
    expect(
      formatTrainingTimeSummary({
        durationMin: null,
        endedAt: null,
        performedAt: "2026-08-11",
        startedAt: null,
      }),
    ).toBe("仅记录了训练日期");
    expect(
      formatTrainingTimeSummary({
        durationMin: null,
        endedAt: null,
        performedAt: null,
        startedAt: null,
      }),
    ).toBe("未设置");
  });

  it("formats valid local times and preserves invalid display input", () => {
    const localDate = new Date(2026, 7, 11, 9, 5);

    expect(formatTimeOnly(localDate.toISOString())).toBe("09:05");
    expect(formatTimeOnly("not-a-date")).toBe("not-a-date");
    expect(formatDateTimeLocalValue(localDate.toISOString())).toBe(
      "2026-08-11T09:05",
    );
    expect(formatDateTimeLocalValue("not-a-date")).toBe("");
    expect(formatDateTimeLocalValue(null)).toBe("");
    expect(formatDateTimeLocalValue(undefined)).toBe("");
  });

  it("parses local input to ISO and rejects blank or invalid values", () => {
    const localValue = "2026-08-11T09:05";

    expect(parseDateTimeLocalValue(localValue)).toBe(
      new Date(localValue).toISOString(),
    );
    expect(parseDateTimeLocalValue("  ")).toBeNull();
    expect(parseDateTimeLocalValue("not-a-date")).toBeNull();
  });

  it("keeps positive duration rounding and the one-minute floor", () => {
    expect(
      getDurationMinutesFromLocalValues("2026-08-11T09:00", "2026-08-11T10:30"),
    ).toBe(90);
    expect(
      getDurationMinutesFromLocalValues(
        "2026-08-11T09:00",
        "2026-08-11T09:29:30",
      ),
    ).toBe(30);
    expect(
      getDurationMinutesFromLocalValues(
        "2026-08-11T09:00",
        "2026-08-11T09:00:01",
      ),
    ).toBe(1);
  });

  it("rejects missing, equal, or reversed duration endpoints", () => {
    expect(
      getDurationMinutesFromLocalValues("", "2026-08-11T10:00"),
    ).toBeNull();
    expect(
      getDurationMinutesFromLocalValues("2026-08-11T09:00", "2026-08-11T09:00"),
    ).toBeNull();
    expect(
      getDurationMinutesFromLocalValues("2026-08-11T10:00", "2026-08-11T09:00"),
    ).toBeNull();
    expect(
      getDurationMinutesFromLocalValues("not-a-date", "also-not-a-date"),
    ).toBeNull();
  });
});
