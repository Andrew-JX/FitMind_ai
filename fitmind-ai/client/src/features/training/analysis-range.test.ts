import { describe, expect, it } from "vitest";

import {
  createAnalysisRange,
  createWeeklyBuckets,
  formatMonthDay,
} from "./analysis-range";

// 2026-07-26 is a Sunday, so it is both "today" and the current week's start.
const SUNDAY = new Date(2026, 6, 26);
// 2026-07-29 is the Wednesday of that same week.
const WEDNESDAY = new Date(2026, 6, 29);

describe("createAnalysisRange", () => {
  it("makes 近 7 天 an inclusive 7-day window ending today", () => {
    expect(createAnalysisRange("last7", WEDNESDAY)).toEqual({
      end_date: "2026-07-29",
      start_date: "2026-07-23",
    });
  });

  it("makes 近 30 天 an inclusive 30-day window ending today", () => {
    expect(createAnalysisRange("last30", WEDNESDAY)).toEqual({
      end_date: "2026-07-29",
      start_date: "2026-06-30",
    });
  });

  it("asks 全部 from a floor date that predates any training log", () => {
    expect(createAnalysisRange("all", WEDNESDAY)).toEqual({
      end_date: "2026-07-29",
      start_date: "2000-01-01",
    });
  });
});

describe("createWeeklyBuckets", () => {
  it("ends the current bucket today and keeps older weeks Sunday to Saturday", () => {
    expect(createWeeklyBuckets(4, WEDNESDAY)).toEqual([
      {
        label: "W1",
        range: { end_date: "2026-07-11", start_date: "2026-07-05" },
      },
      {
        label: "W2",
        range: { end_date: "2026-07-18", start_date: "2026-07-12" },
      },
      {
        label: "W3",
        range: { end_date: "2026-07-25", start_date: "2026-07-19" },
      },
      {
        label: "本周",
        range: { end_date: "2026-07-29", start_date: "2026-07-26" },
      },
    ]);
  });

  it("treats Sunday as the first day of the current week, not the last", () => {
    const buckets = createWeeklyBuckets(4, SUNDAY);

    expect(buckets[3]).toEqual({
      label: "本周",
      range: { end_date: "2026-07-26", start_date: "2026-07-26" },
    });
    expect(buckets[2]?.range).toEqual({
      end_date: "2026-07-25",
      start_date: "2026-07-19",
    });
  });
});

describe("formatMonthDay", () => {
  it("zero-pads a date-only string", () => {
    expect(formatMonthDay("2026-06-28")).toBe("06/28");
  });

  it("uses the local calendar day of a timestamp", () => {
    const timestamp = new Date(2026, 6, 2, 21, 30).toISOString();

    expect(formatMonthDay(timestamp)).toBe("07/02");
  });

  it("returns the input when it cannot be parsed", () => {
    expect(formatMonthDay("not-a-date")).toBe("not-a-date");
  });
});
