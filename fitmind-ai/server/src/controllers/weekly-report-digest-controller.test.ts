import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../env.js", async () => {
  const actual = await vi.importActual<typeof import("../env.js")>("../env.js");

  return {
    ...actual,
    loadServerEnv: vi.fn(() => ({
      nodeEnv: "test",
      port: 3000,
      assistantProvider: "mock",
      assistantPhrasing: false,
      assistantPlanAdherenceContext: false,
      weeklyReportDeliveryEnabled: true,
      weeklyReportCronSecret: "cron-secret",
      assistantSafetyGate: true,
      workoutIntakeLlmProvider: "mock",
    })),
  };
});

vi.mock("../services/training/weekly-report-digest-service.js", () => ({
  dismissWeeklyReportDigest: vi.fn(),
  getLatestWeeklyReportDigest: vi.fn(),
  runWeeklyReportDigestCron: vi.fn(),
}));

import {
  dismissWeeklyReportDigest,
  getLatestWeeklyReportDigest,
  runWeeklyReportDigestCron,
} from "../services/training/weekly-report-digest-service.js";
import {
  getWeeklyReportDigestController,
  patchWeeklyReportDigestController,
  postWeeklyReportCronController,
} from "./weekly-report-digest-controller.js";

const mockedRunCron = vi.mocked(runWeeklyReportDigestCron);
const mockedGetLatest = vi.mocked(getLatestWeeklyReportDigest);
const mockedDismiss = vi.mocked(dismissWeeklyReportDigest);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DIGEST_ID = "22222222-2222-4222-8222-222222222222";

function createResponse() {
  const response = {
    json: vi.fn(),
    locals: { userId: USER_ID },
    status: vi.fn(),
  };
  response.status.mockReturnValue(response);

  return response as unknown as Response<unknown, { userId: string }>;
}

function createRequest(input: {
  authorization?: string | undefined;
  body?: unknown;
  params?: unknown;
}): Request {
  return {
    body: input.body,
    params: input.params,
    header: vi.fn((name: string) =>
      name.toLowerCase() === "authorization" ? input.authorization : undefined,
    ),
  } as unknown as Request;
}

describe("weekly-report-digest-controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects cron requests without the bearer secret", async () => {
    await expect(
      postWeeklyReportCronController(createRequest({}), createResponse()),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      statusCode: 401,
    });
    expect(mockedRunCron).not.toHaveBeenCalled();
  });

  it("runs cron with the correct bearer secret and returns counts only", async () => {
    mockedRunCron.mockResolvedValueOnce({
      enabled: true,
      attempted: 1,
      created: 1,
      updated: 0,
      skipped: 0,
      failed: 0,
    });
    const response = createResponse();

    await postWeeklyReportCronController(
      createRequest({ authorization: "Bearer cron-secret" }),
      response,
    );

    expect(response.json).toHaveBeenCalledWith({
      ok: true,
      data: {
        enabled: true,
        attempted: 1,
        created: 1,
        updated: 0,
        skipped: 0,
        failed: 0,
      },
    });
  });

  it("returns the authenticated user's latest digest", async () => {
    mockedGetLatest.mockResolvedValueOnce(null);
    const response = createResponse();

    await getWeeklyReportDigestController(createRequest({}), response);

    expect(mockedGetLatest).toHaveBeenCalledWith(USER_ID);
    expect(response.json).toHaveBeenCalledWith({
      ok: true,
      data: { digest: null },
    });
  });

  it("dismisses only an owner-scoped digest", async () => {
    mockedDismiss.mockResolvedValueOnce({
      id: DIGEST_ID,
      iso_year: 2026,
      iso_week: 26,
      week_start_date: "2026-06-22",
      week_end_date: "2026-06-28",
      status: "ready",
      title: "Weekly report",
      summary: "Digest",
      report_snapshot: {},
      generated_at: "2026-07-01T00:00:00.000Z",
      dismissed_at: "2026-07-01T00:00:00.000Z",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    });
    const response = createResponse();

    await patchWeeklyReportDigestController(
      createRequest({ params: { id: DIGEST_ID }, body: { dismissed: true } }),
      response,
    );

    expect(mockedDismiss).toHaveBeenCalledWith({
      id: DIGEST_ID,
      userId: USER_ID,
    });
    expect(response.json).toHaveBeenCalledWith({
      ok: true,
      data: { dismissed: true, id: DIGEST_ID },
    });
  });

  it("rejects dismiss bodies other than dismissed=true", async () => {
    await expect(
      patchWeeklyReportDigestController(
        createRequest({
          params: { id: DIGEST_ID },
          body: { dismissed: false },
        }),
        createResponse(),
      ),
    ).rejects.toBeTruthy();
    expect(mockedDismiss).not.toHaveBeenCalled();
  });
});
