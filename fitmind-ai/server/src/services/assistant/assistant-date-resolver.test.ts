import { describe, expect, it } from "vitest";

import { resolveAssistantDateRange } from "./assistant-date-resolver.js";

const SHANGHAI = "Asia/Shanghai";

/** 2026-07-29 is a Wednesday; that week starts Sunday 2026-07-26. */
const WEDNESDAY = new Date("2026-07-29T04:00:00.000Z");

function resolve(message: string, now: Date = WEDNESDAY, timeZone = SHANGHAI) {
  return resolveAssistantDateRange({ message, now, timeZone });
}

describe("supported vocabulary", () => {
  it("resolves 本周 as Sunday through today", () => {
    expect(resolve("本周练得怎么样")).toEqual({
      option: {
        end_date: "2026-07-29",
        label: "本周",
        start_date: "2026-07-26",
        term: "this_week",
      },
      status: "resolved",
    });
  });

  it("treats 这周 and 这个星期 as the same term", () => {
    for (const message of ["这周练得怎么样", "这个星期练得怎么样"]) {
      expect(resolve(message)).toMatchObject({
        option: { start_date: "2026-07-26", term: "this_week" },
        status: "resolved",
      });
    }
  });

  it("resolves 上周 as the previous complete Sunday-to-Saturday week", () => {
    expect(resolve("上周练了多少")).toEqual({
      option: {
        end_date: "2026-07-25",
        label: "上周",
        start_date: "2026-07-19",
        term: "last_week",
      },
      status: "resolved",
    });
  });

  it("treats 上一周 and 上个星期 as the same term", () => {
    for (const message of ["上一周练了多少", "上个星期练了多少"]) {
      expect(resolve(message)).toMatchObject({
        option: { end_date: "2026-07-25", start_date: "2026-07-19" },
        status: "resolved",
      });
    }
  });

  it("resolves 本月 as the first of the month through today", () => {
    expect(resolve("本月总量")).toEqual({
      option: {
        end_date: "2026-07-29",
        label: "本月",
        start_date: "2026-07-01",
        term: "this_month",
      },
      status: "resolved",
    });
  });
});

describe("boundaries", () => {
  it("makes 本周 a single day when today is Sunday", () => {
    expect(resolve("本周", new Date("2026-07-26T04:00:00.000Z"))).toMatchObject(
      {
        option: { end_date: "2026-07-26", start_date: "2026-07-26" },
      },
    );
  });

  it("keeps Saturday inside the current week, not the next one", () => {
    expect(resolve("本周", new Date("2026-08-01T04:00:00.000Z"))).toMatchObject(
      {
        option: { end_date: "2026-08-01", start_date: "2026-07-26" },
      },
    );
  });

  it("crosses a month boundary for 上周", () => {
    // Wednesday 2026-08-05; previous week is 2026-07-26 .. 2026-08-01.
    expect(resolve("上周", new Date("2026-08-05T04:00:00.000Z"))).toMatchObject(
      {
        option: { end_date: "2026-08-01", start_date: "2026-07-26" },
      },
    );
  });

  it("crosses a year boundary for 上周", () => {
    // Friday 2027-01-01; previous week is 2026-12-20 .. 2026-12-26.
    expect(resolve("上周", new Date("2027-01-01T04:00:00.000Z"))).toMatchObject(
      {
        option: { end_date: "2026-12-26", start_date: "2026-12-20" },
      },
    );
  });

  it("starts 本月 on the first even on the first", () => {
    expect(resolve("本月", new Date("2026-08-01T04:00:00.000Z"))).toMatchObject(
      {
        option: { end_date: "2026-08-01", start_date: "2026-08-01" },
      },
    );
  });
});

describe("time zones", () => {
  it("reads the calendar day of the requested zone, not of UTC", () => {
    // 2026-07-26T20:00Z is already Monday 2026-07-27 in Shanghai (UTC+8),
    // so the week that started Sunday 2026-07-26 now spans two days.
    const instant = new Date("2026-07-26T20:00:00.000Z");

    expect(resolve("本周", instant, SHANGHAI)).toMatchObject({
      option: { end_date: "2026-07-27", start_date: "2026-07-26" },
    });
    expect(resolve("本周", instant, "UTC")).toMatchObject({
      option: { end_date: "2026-07-26", start_date: "2026-07-26" },
    });
  });

  it("survives a DST transition inside the resolved week", () => {
    // US DST ended Sunday 2026-11-01. A week containing it must still be
    // exactly Sunday 2026-11-01 through Wednesday 2026-11-04 — day arithmetic,
    // not 7 * 24h of milliseconds.
    expect(
      resolve("本周", new Date("2026-11-04T17:00:00.000Z"), "America/New_York"),
    ).toMatchObject({
      option: { end_date: "2026-11-04", start_date: "2026-11-01" },
    });
  });

  it("falls back to absent on an unusable zone rather than guessing", () => {
    expect(resolve("本周", WEDNESDAY, "Not/AZone")).toEqual({
      status: "absent",
    });
  });

  it("falls back to absent on an invalid reference instant", () => {
    expect(resolve("本周", new Date("nonsense"))).toEqual({ status: "absent" });
  });
});

describe("unsupported and shadowed language", () => {
  it("does not parse 最近三个月", () => {
    expect(resolve("最近三个月练得怎么样")).toEqual({ status: "absent" });
  });

  it("does not parse 下周 as an evidence range", () => {
    expect(resolve("给我一个下周训练草案")).toEqual({ status: "absent" });
  });

  it("refuses to read 上上周 as 上周", () => {
    expect(resolve("上上周练了多少")).toEqual({ status: "absent" });
  });

  it("refuses to read 下个星期 as 这个星期", () => {
    expect(resolve("下个星期怎么安排")).toEqual({ status: "absent" });
  });

  it("still resolves a real term sitting beside a shadowed one", () => {
    expect(resolve("上上周和本周比怎么样")).toMatchObject({
      option: { term: "this_week" },
      status: "resolved",
    });
  });

  it("returns absent for a message with no time language", () => {
    expect(resolve("卧推有没有进步")).toEqual({ status: "absent" });
  });
});

describe("conflicting terms", () => {
  it("reports both periods instead of picking the first match", () => {
    const result = resolve("本周和上周分别练了多少");

    expect(result.status).toBe("ambiguous");
    expect(result.status === "ambiguous" ? result.options : []).toEqual([
      {
        end_date: "2026-07-29",
        label: "本周",
        start_date: "2026-07-26",
        term: "this_week",
      },
      {
        end_date: "2026-07-25",
        label: "上周",
        start_date: "2026-07-19",
        term: "last_week",
      },
    ]);
  });

  it("does not treat two spellings of one term as a conflict", () => {
    expect(resolve("本周…这周到底练了多少")).toMatchObject({
      status: "resolved",
    });
  });

  it("reports a week-versus-month conflict", () => {
    expect(resolve("本月和本周差多少")).toMatchObject({ status: "ambiguous" });
  });
});
