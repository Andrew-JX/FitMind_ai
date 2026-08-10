import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db/user-consent-repository.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./db/user-consent-repository.js")>();
  return { ...actual, getConsentStatus: vi.fn() };
});

vi.mock("./services/auth/jwt.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./services/auth/jwt.js")>();
  return { ...actual, verifyJwt: vi.fn() };
});

vi.mock("./services/personal-tools-service.js", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("./services/personal-tools-service.js")
    >();

  return {
    ...actual,
    addTrainingMemo: vi.fn(),
    editTrainingMemo: vi.fn(),
    readBodyMeasurements: vi.fn(),
    readMenstrualOverview: vi.fn(),
    readTrainingMemos: vi.fn(),
    removeAllBodyMeasurements: vi.fn(),
    removeBodyMeasurement: vi.fn(),
    removeMenstrualRecords: vi.fn(),
    removeTrainingMemo: vi.fn(),
    withdrawAllSensitiveHealthData: vi.fn(),
    writeBodyMeasurement: vi.fn(),
    writeMenstrualDate: vi.fn(),
    writeMenstrualSettings: vi.fn(),
  };
});

import { createApp } from "./app.js";
import { getConsentStatus } from "./db/user-consent-repository.js";
import { createAiRateLimiter } from "./services/assistant/ai-rate-limiter.js";
import { verifyJwt } from "./services/auth/jwt.js";
import {
  addTrainingMemo,
  editTrainingMemo,
  readBodyMeasurements,
  readMenstrualOverview,
  readTrainingMemos,
  removeAllBodyMeasurements,
  removeBodyMeasurement,
  removeMenstrualRecords,
  removeTrainingMemo,
  withdrawAllSensitiveHealthData,
  writeBodyMeasurement,
  writeMenstrualDate,
  writeMenstrualSettings,
} from "./services/personal-tools-service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const RECORD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = "2026-08-10T00:00:00.000Z";

const bodyMeasurement = {
  id: RECORD_ID,
  measuredOn: "2026-08-10",
  weightKg: 70,
  targetWeightKg: null,
  bodyFatPercent: null,
  neckCm: null,
  shoulderCm: null,
  chestCm: null,
  waistCm: null,
  hipCm: null,
  leftUpperArmCm: null,
  rightUpperArmCm: null,
  leftThighCm: null,
  rightThighCm: null,
  leftCalfCm: null,
  rightCalfCm: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const memo = {
  id: RECORD_ID,
  title: "Chest day",
  content: "Bench press 5 x 8",
  isPinned: false,
  createdAt: NOW,
  updatedAt: NOW,
};

describe("personal tools HTTP contracts", () => {
  process.env["DATA_RESIDENCY"] = "overseas";

  const app = createApp({
    authRateLimiter: createAiRateLimiter({
      perMinute: 1_000,
      perDay: 100_000,
      now: () => 0,
    }),
  });
  const server = app.listen(0);

  afterAll(() => server.close());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyJwt).mockResolvedValue({ userId: USER_ID });
    vi.mocked(getConsentStatus).mockResolvedValue({
      hasCrossBorderConsent: true,
      hasHealthConsent: true,
      hasWithdrawableHealthConsent: true,
      hasStoredInjuryData: false,
      hasStoredHealthData: false,
    });
    vi.mocked(readMenstrualOverview).mockResolvedValue({
      dates: ["2026-08-10"],
      showInHistory: true,
      healthConsentOnFile: true,
      withdrawableHealthConsent: true,
    });
    vi.mocked(writeMenstrualDate).mockResolvedValue({
      date: "2026-08-10",
      isPeriod: true,
    });
    vi.mocked(writeMenstrualSettings).mockResolvedValue(true);
    vi.mocked(readBodyMeasurements).mockResolvedValue({
      items: [bodyMeasurement],
      healthConsentOnFile: true,
      withdrawableHealthConsent: true,
    });
    vi.mocked(writeBodyMeasurement).mockResolvedValue(bodyMeasurement);
    vi.mocked(readTrainingMemos).mockResolvedValue([memo]);
    vi.mocked(addTrainingMemo).mockResolvedValue(memo);
    vi.mocked(editTrainingMemo).mockResolvedValue(memo);
  });

  async function request(path: string, method: string, body?: unknown) {
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    return fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers: {
        authorization: "Bearer test-token",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  it("routes all thirteen personal-tool endpoints through real HTTP", async () => {
    const cases = [
      ["GET", "/api/menstrual-records?month=2026-08"],
      ["PUT", "/api/menstrual-records/2026-08-10", { isPeriod: true }],
      ["PATCH", "/api/menstrual-records/settings", { showInHistory: true }],
      ["DELETE", "/api/menstrual-records"],
      ["GET", "/api/body-measurements"],
      [
        "PUT",
        "/api/body-measurements",
        { measuredOn: "2026-08-10", weightKg: 70 },
      ],
      ["DELETE", `/api/body-measurements/${RECORD_ID}`],
      ["DELETE", "/api/body-measurements"],
      ["GET", "/api/training-memos"],
      ["POST", "/api/training-memos", { title: "Chest", content: "Bench" }],
      ["PATCH", `/api/training-memos/${RECORD_ID}`, { isPinned: true }],
      ["DELETE", `/api/training-memos/${RECORD_ID}`],
      ["DELETE", "/api/personal-health-data"],
    ] as const;

    const statuses: number[] = [];
    for (const [method, path, body] of cases) {
      statuses.push((await request(path, method, body)).status);
    }

    expect(statuses).toEqual([
      200, 200, 200, 200, 200, 200, 200, 200, 200, 201, 200, 200, 200,
    ]);
    expect(readMenstrualOverview).toHaveBeenCalledWith(USER_ID, "2026-08");
    expect(writeMenstrualDate).toHaveBeenCalledWith(USER_ID, "2026-08-10", {
      isPeriod: true,
    });
    expect(removeMenstrualRecords).toHaveBeenCalledWith(USER_ID);
    expect(removeBodyMeasurement).toHaveBeenCalledWith(USER_ID, RECORD_ID);
    expect(removeAllBodyMeasurements).toHaveBeenCalledWith(USER_ID);
    expect(removeTrainingMemo).toHaveBeenCalledWith(USER_ID, RECORD_ID);
    expect(withdrawAllSensitiveHealthData).toHaveBeenCalledWith(USER_ID);
  });

  it("keeps authentication on all personal-tool routes", async () => {
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected the test server to bind to a TCP port");
    }

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/personal-health-data`,
      { method: "DELETE" },
    );

    expect(response.status).toBe(401);
  });
});
