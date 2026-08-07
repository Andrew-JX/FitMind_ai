import { describe, expect, it, vi } from "vitest";

import type { WeeklyReportDigestRow } from "../../db/weekly-report-digest-repository.js";
import type { ServerEnv } from "../../env.js";
import type { PendingConsent } from "../auth/consent-service.js";
import {
  buildWeeklyReportDigestSnapshot,
  dismissWeeklyReportDigest,
  getLatestWeeklyReportDigest,
  getPreviousIsoWeekRange,
  runWeeklyReportDigestCron,
} from "./weekly-report-digest-service.js";
import type { WeeklyTrainingReportResponseData } from "./weekly-training-report-service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DIGEST_ID = "22222222-2222-4222-8222-222222222222";

function createReport(
  status: WeeklyTrainingReportResponseData["status"] = "ready",
): WeeklyTrainingReportResponseData {
  return {
    range: { start_date: "2026-06-22", end_date: "2026-06-28" },
    status,
    totals: {
      workout_count: status === "empty" ? 0 : 2,
      set_count: status === "empty" ? 0 : 12,
      total_reps: status === "empty" ? 0 : 96,
      total_volume: status === "empty" ? 0 : 4200,
      total_weighted_volume: status === "empty" ? 0 : 4200,
    },
    frequency: {
      range_days: 7,
      workouts_per_week: status === "empty" ? 0 : 2,
    },
    top_exercises:
      status === "empty"
        ? []
        : [
            {
              exercise_id: "33333333-3333-4333-8333-333333333333",
              exercise_name: "Bench Press",
              set_count: 6,
              total_reps: 48,
              total_volume: 2400,
              max_weight_kg: 80,
              estimated_1rm_kg: 96,
            },
          ],
    top_muscle_groups: [],
    low_volume_muscle_groups: [],
    selected_exercise_progress: null,
    recovery_notes: [],
    limitations: [],
    evidence: {
      workout_ids:
        status === "empty" ? [] : ["44444444-4444-4444-8444-444444444444"],
      set_ids:
        status === "empty" ? [] : ["55555555-5555-4555-8555-555555555555"],
      calculation_sources: ["training_summary"],
      calculation_rules: ["weekly_report_aggregation"],
    },
  };
}

function createDigestRow(overrides: Partial<WeeklyReportDigestRow> = {}) {
  return {
    id: DIGEST_ID,
    user_id: USER_ID,
    iso_year: 2026,
    iso_week: 26,
    week_start_date: "2026-06-22",
    week_end_date: "2026-06-28",
    status: "ready" as const,
    title: "Weekly report 2026-06-22 to 2026-06-28",
    summary: "Recorded 2 workouts and 12 sets from 2026-06-22 to 2026-06-28.",
    report_snapshot: createReport(),
    generated_at: "2026-07-01T00:00:00.000Z",
    dismissed_at: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function createServerEnv(overrides: Partial<ServerEnv> = {}): ServerEnv {
  return {
    nodeEnv: "test",
    port: 3000,
    assistantProvider: "mock",
    assistantPhrasing: false,
    assistantPlanAdherenceContext: false,
    weeklyReportDeliveryEnabled: true,
    ragRerankingEnabled: false,
    assistantSafetyGate: true,
    registrationInviteOnly: true,
    dataResidency: "overseas",
    workoutIntakeLlmProvider: "mock",
    ...overrides,
  };
}

function createDependencies() {
  const dismissDigest = vi.fn(
    async (): Promise<WeeklyReportDigestRow | null> =>
      createDigestRow({ dismissed_at: "now" }),
  );

  return {
    getReport: vi.fn(async () => createReport()),
    // Defaults to "owes nothing"; the gate tests override it. The cron cannot
    // rely on the HTTP consent gate, so this is one of the two places that
    // stops an unconsented account from being processed in the background.
    getPendingConsentsFor: vi.fn(async (): Promise<PendingConsent[]> => []),
    getPolicy: vi.fn(() => ({
      registration_open: true,
      policy_version: "2026-08-04",
      data_residency: "overseas" as const,
      cross_border_consent_required: true,
    })),
    listActiveUsers: vi.fn(async () => [USER_ID]),
    loadEnv: vi.fn(() => createServerEnv()),
    now: () => new Date("2026-07-01T12:00:00.000Z"),
    readLatest: vi.fn(async () => createDigestRow()),
    dismissDigest,
    upsertDigest: vi.fn(async () => ({
      inserted: true,
      row: createDigestRow(),
    })),
  };
}

describe("weekly-report-digest-service", () => {
  it("calculates the previous ISO week in UTC", () => {
    expect(
      getPreviousIsoWeekRange(new Date("2026-07-01T12:00:00.000Z")),
    ).toEqual({
      isoYear: 2026,
      isoWeek: 26,
      startDate: "2026-06-22",
      endDate: "2026-06-28",
    });
  });

  it("keeps cron disabled by default", async () => {
    const dependencies = createDependencies();
    dependencies.loadEnv.mockReturnValueOnce(
      createServerEnv({
        weeklyReportDeliveryEnabled: false,
      }),
    );

    await expect(runWeeklyReportDigestCron(dependencies)).resolves.toEqual({
      enabled: false,
      attempted: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    });
    expect(dependencies.listActiveUsers).not.toHaveBeenCalled();
  });

  it("generates idempotent digests for active users", async () => {
    const dependencies = createDependencies();

    const result = await runWeeklyReportDigestCron(dependencies);

    expect(dependencies.listActiveUsers).toHaveBeenCalledWith("2026-06-01", {
      policyVersion: "2026-08-04",
      crossBorderRequired: true,
    });
    expect(dependencies.getReport).toHaveBeenCalledWith(USER_ID, {
      start_date: "2026-06-22",
      end_date: "2026-06-28",
    });
    expect(dependencies.upsertDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        isoYear: 2026,
        isoWeek: 26,
        status: "ready",
      }),
    );
    expect(result).toEqual({
      enabled: true,
      attempted: 1,
      created: 1,
      updated: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it("counts updates separately from new digests", async () => {
    const dependencies = createDependencies();
    dependencies.upsertDigest.mockResolvedValueOnce({
      inserted: false,
      row: createDigestRow(),
    });

    await expect(
      runWeeklyReportDigestCron(dependencies),
    ).resolves.toMatchObject({
      created: 0,
      updated: 1,
    });
  });

  it("isolates one user's failure from the rest of the batch", async () => {
    const dependencies = createDependencies();
    dependencies.listActiveUsers.mockResolvedValueOnce([USER_ID, DIGEST_ID]);
    dependencies.getReport
      .mockRejectedValueOnce(new Error("db unavailable"))
      .mockResolvedValueOnce(createReport());

    await expect(runWeeklyReportDigestCron(dependencies)).resolves.toEqual({
      enabled: true,
      attempted: 2,
      created: 1,
      updated: 0,
      skipped: 0,
      failed: 1,
    });
  });

  it("builds summaries only from report facts", () => {
    expect(
      buildWeeklyReportDigestSnapshot(
        {
          isoYear: 2026,
          isoWeek: 26,
          startDate: "2026-06-22",
          endDate: "2026-06-28",
        },
        createReport(),
      ),
    ).toEqual({
      title: "Weekly report 2026-06-22 to 2026-06-28",
      summary:
        "Recorded 2 workouts and 12 sets from 2026-06-22 to 2026-06-28. Top exercise: Bench Press.",
    });
  });

  it("returns the latest visible digest", async () => {
    const dependencies = createDependencies();

    await expect(
      getLatestWeeklyReportDigest(USER_ID, dependencies),
    ).resolves.toEqual(
      expect.objectContaining({
        id: DIGEST_ID,
        report_snapshot: createReport(),
      }),
    );
  });

  it("throws 404 when dismissing a non-owned digest", async () => {
    const dependencies = createDependencies();
    dependencies.dismissDigest.mockResolvedValueOnce(null);

    await expect(
      dismissWeeklyReportDigest(
        { id: DIGEST_ID, userId: USER_ID },
        dependencies,
      ),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    });
  });
});

describe("weekly digest consent gate", () => {
  // The HTTP gate cannot reach a cron run — there is no request to refuse — so
  // an account blocked from every endpoint for owing a consent would still have
  // had its training data read and a report built from it. The flag defaulting
  // to off only kept that dormant.
  it("skips a user who still owes a consent", async () => {
    const dependencies = createDependencies();
    dependencies.getPendingConsentsFor.mockResolvedValueOnce([
      {
        consent_type: "cross_border_transfer" as const,
        policy_version: "2026-08-04",
      },
    ]);

    const result = await runWeeklyReportDigestCron(dependencies);

    expect(dependencies.getReport).not.toHaveBeenCalled();
    expect(dependencies.upsertDigest).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
  });

  it("processes a user who owes nothing", async () => {
    const dependencies = createDependencies();

    const result = await runWeeklyReportDigestCron(dependencies);

    expect(dependencies.getReport).toHaveBeenCalled();
    expect(result.created).toBe(1);
  });

  // The SQL filter is the first line; this asserts it is actually asked for the
  // right policy rather than left to a default.
  it("passes the current policy to the user query", async () => {
    const dependencies = createDependencies();

    await runWeeklyReportDigestCron(dependencies);

    expect(dependencies.listActiveUsers).toHaveBeenCalledWith(
      expect.any(String),
      { policyVersion: "2026-08-04", crossBorderRequired: true },
    );
  });
});
