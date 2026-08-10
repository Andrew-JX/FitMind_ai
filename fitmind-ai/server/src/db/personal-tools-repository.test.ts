import { describe, expect, it, vi } from "vitest";

import {
  deleteAllSensitiveHealthData,
  saveBodyMeasurement,
  setMenstrualDate,
} from "./personal-tools-repository.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const POLICY_VERSION = "2026-08-09";

function createFakePool(options?: { liveConsent?: boolean }) {
  const statements: string[] = [];
  const bodyRow = {
    id: "22222222-2222-4222-8222-222222222222",
    measured_on: "2026-08-09",
    weight_kg: "70.50",
    target_weight_kg: null,
    body_fat_percent: null,
    neck_cm: null,
    shoulder_cm: null,
    chest_cm: null,
    waist_cm: null,
    hip_cm: null,
    left_upper_arm_cm: null,
    right_upper_arm_cm: null,
    left_thigh_cm: null,
    right_thigh_cm: null,
    left_calf_cm: null,
    right_calf_cm: null,
    created_at: "2026-08-09T00:00:00.000Z",
    updated_at: "2026-08-09T00:00:00.000Z",
  };

  const client = {
    query: vi.fn(async (sql: string) => {
      const normalized = sql.trim().replace(/\s+/gu, " ");
      statements.push(normalized);

      if (sql.includes("FOR UPDATE")) {
        return { rows: [{ id: USER_ID }] };
      }
      if (sql.includes("SELECT 1 FROM user_consents")) {
        return { rows: options?.liveConsent === true ? [{ found: 1 }] : [] };
      }
      if (sql.includes("INSERT INTO body_measurements")) {
        return { rows: [bodyRow] };
      }
      return { rows: [], rowCount: 1 };
    }),
    release: vi.fn(),
  };
  const pool = {
    query: vi.fn(async () => ({ rows: [] })),
    connect: vi.fn(async () => client),
  };

  return { pool, client, statements };
}

describe("personal health mutations", () => {
  it("collects consent and writes a menstrual date on the same locked client", async () => {
    const { pool, client, statements } = createFakePool();

    const result = await setMenstrualDate(
      {
        userId: USER_ID,
        date: "2026-08-09",
        isPeriod: true,
        policyVersion: POLICY_VERSION,
        consentDecision: {
          accepted: true,
          policy_version: POLICY_VERSION,
        },
      },
      pool,
    );

    expect(result).toEqual({
      status: "saved",
      value: { date: "2026-08-09", isPeriod: true },
    });
    expect(statements[0]).toBe("BEGIN");
    expect(statements[1]).toContain("FOR UPDATE");
    expect(
      statements.some((sql) => sql.includes("INSERT INTO user_consents")),
    ).toBe(true);
    expect(
      statements.some((sql) => sql.includes("INSERT INTO menstrual_records")),
    ).toBe(true);
    expect(statements.at(-1)).toBe("COMMIT");
    expect(pool.query).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("does not write a menstrual date when separate consent is missing", async () => {
    const { pool, statements } = createFakePool();

    const result = await setMenstrualDate(
      {
        userId: USER_ID,
        date: "2026-08-09",
        isPeriod: true,
        policyVersion: POLICY_VERSION,
      },
      pool,
    );

    expect(result).toEqual({ status: "consent_missing" });
    expect(
      statements.some((sql) => sql.includes("INSERT INTO menstrual_records")),
    ).toBe(false);
    expect(statements.at(-1)).toBe("COMMIT");
  });

  it("writes a body measurement under the same consent and transaction protocol", async () => {
    const { pool, statements } = createFakePool({ liveConsent: true });

    const result = await saveBodyMeasurement(
      {
        userId: USER_ID,
        measuredOn: "2026-08-09",
        values: [
          70.5,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        policyVersion: POLICY_VERSION,
      },
      pool,
    );

    expect(result.status).toBe("saved");
    expect(statements[1]).toContain("FOR UPDATE");
    expect(
      statements.some((sql) => sql.includes("INSERT INTO body_measurements")),
    ).toBe(true);
    expect(statements.at(-1)).toBe("COMMIT");
  });

  it("withdraws all health categories without touching training memos", async () => {
    const { pool, statements } = createFakePool({ liveConsent: true });

    await deleteAllSensitiveHealthData(USER_ID, pool);

    expect(
      statements.some((sql) => sql.includes("UPDATE athlete_profiles")),
    ).toBe(true);
    expect(
      statements.some((sql) => sql.includes("DELETE FROM menstrual_records")),
    ).toBe(true);
    expect(
      statements.some((sql) => sql.includes("DELETE FROM body_measurements")),
    ).toBe(true);
    expect(statements.some((sql) => sql.includes("UPDATE user_consents"))).toBe(
      true,
    );
    expect(statements.some((sql) => sql.includes("training_memos"))).toBe(
      false,
    );
    expect(statements.at(-1)).toBe("COMMIT");
  });
});
