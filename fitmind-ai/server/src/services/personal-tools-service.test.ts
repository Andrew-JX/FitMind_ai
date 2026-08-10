import { describe, expect, it } from "vitest";

import {
  createTrainingMemoSchema,
  menstrualDateParamSchema,
  saveBodyMeasurementSchema,
  setMenstrualDateSchema,
  updateTrainingMemoSchema,
} from "./personal-tools-service.js";

describe("personal tools validation", () => {
  it("accepts a real menstrual date and rejects an impossible one", () => {
    expect(
      menstrualDateParamSchema.safeParse({ date: "2026-08-09" }).success,
    ).toBe(true);
    expect(
      menstrualDateParamSchema.safeParse({ date: "2026-02-30" }).success,
    ).toBe(false);
  });

  it("keeps health consent separate on menstrual writes", () => {
    expect(
      setMenstrualDateSchema.parse({
        isPeriod: true,
        sensitiveHealthConsent: {
          accepted: true,
          policy_version: "2026-08-09",
        },
      }),
    ).toMatchObject({ isPeriod: true });
  });

  it("requires at least one body value and applies safe ranges", () => {
    expect(
      saveBodyMeasurementSchema.safeParse({ measuredOn: "2026-08-09" }).success,
    ).toBe(false);
    expect(
      saveBodyMeasurementSchema.safeParse({
        measuredOn: "2026-08-09",
        weightKg: 70.5,
        bodyFatPercent: 18,
      }).success,
    ).toBe(true);
    expect(
      saveBodyMeasurementSchema.safeParse({
        measuredOn: "2026-08-09",
        bodyFatPercent: 95,
      }).success,
    ).toBe(false);
  });

  it("bounds memo text and refuses an empty patch", () => {
    expect(
      createTrainingMemoSchema.safeParse({
        title: "下次练胸",
        content: "卧推先热身",
      }).success,
    ).toBe(true);
    expect(updateTrainingMemoSchema.safeParse({}).success).toBe(false);
  });
});
