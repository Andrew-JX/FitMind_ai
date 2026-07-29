import { describe, expect, it } from "vitest";

import { resolveAssistantDateRequest } from "./assistant-date-request.js";

const SHANGHAI = "Asia/Shanghai";
/** Wednesday 2026-07-29; that week starts Sunday 2026-07-26. */
const WEDNESDAY = new Date("2026-07-29T04:00:00.000Z");

function resolve(input: {
  end_date?: string;
  message: string;
  start_date?: string;
  timeZone?: string;
}) {
  return resolveAssistantDateRequest({
    ...input,
    now: WEDNESDAY,
    timeZone: input.timeZone ?? SHANGHAI,
  });
}

describe("precedence", () => {
  it("uses an explicit range above everything else", () => {
    expect(
      resolve({
        end_date: "2026-06-30",
        message: "本周练得怎么样",
        start_date: "2026-06-01",
      }),
    ).toEqual({
      range: { end_date: "2026-06-30", start_date: "2026-06-01" },
      source: "explicit",
      status: "range",
    });
  });

  it("never rewrites an explicit range from time language in the same message", () => {
    const outcome = resolve({
      end_date: "2026-06-30",
      message: "本周和上周分别练了多少",
      start_date: "2026-06-01",
    });

    // Two periods would be ambiguous on their own; the explicit range wins and
    // no clarification is raised.
    expect(outcome.status).toBe("range");
  });

  it("falls through to a supported term when no explicit range is sent", () => {
    expect(resolve({ message: "本周练得怎么样" })).toEqual({
      label: "本周",
      range: { end_date: "2026-07-29", start_date: "2026-07-26" },
      source: "term",
      status: "range",
    });
  });

  it("ignores a half-specified range and keeps resolving the message", () => {
    expect(
      resolve({ message: "上周练了多少", start_date: "2026-06-01" }),
    ).toEqual({
      label: "上周",
      range: { end_date: "2026-07-25", start_date: "2026-07-19" },
      source: "term",
      status: "range",
    });
  });

  it("falls back to the 30-day default when nothing is specified", () => {
    expect(resolve({ message: "卧推有没有进步" })).toEqual({
      range: { end_date: "2026-07-29", start_date: "2026-06-30" },
      source: "default",
      status: "range",
    });
  });
});

describe("unsupported time language", () => {
  it("uses the default window for 最近三个月 and reports it as default", () => {
    const outcome = resolve({ message: "最近三个月练得怎么样" });

    // The answer must be free to label this as the 30-day window it really is,
    // never as three months.
    expect(outcome).toEqual({
      range: { end_date: "2026-07-29", start_date: "2026-06-30" },
      source: "default",
      status: "range",
    });
  });

  it("does not let 下周 pull the evidence window forward", () => {
    expect(resolve({ message: "给我一个下周训练草案" })).toMatchObject({
      source: "default",
    });
  });
});

describe("ambiguity", () => {
  it("asks instead of picking when two periods are named", () => {
    const outcome = resolve({ message: "本周和上周分别练了多少" });

    expect(outcome.status).toBe("ambiguous");
    expect(outcome.status === "ambiguous" ? outcome.options : []).toEqual([
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

  it("resolves the continuation of that clarification through the explicit range", () => {
    // Tapping 上周 sends its own range back, which precedence rule 1 accepts.
    expect(
      resolve({
        end_date: "2026-07-25",
        message: "上周",
        start_date: "2026-07-19",
      }),
    ).toEqual({
      range: { end_date: "2026-07-25", start_date: "2026-07-19" },
      source: "explicit",
      status: "range",
    });
  });
});

describe("time zone", () => {
  it("computes the default window against the requested zone", () => {
    const instant = new Date("2026-07-26T20:00:00.000Z");
    const shanghai = resolveAssistantDateRequest({
      message: "卧推有没有进步",
      now: instant,
      timeZone: SHANGHAI,
    });
    const utc = resolveAssistantDateRequest({
      message: "卧推有没有进步",
      now: instant,
      timeZone: "UTC",
    });

    expect(shanghai).toMatchObject({ range: { end_date: "2026-07-27" } });
    expect(utc).toMatchObject({ range: { end_date: "2026-07-26" } });
  });

  it("still produces a default range when the zone is unusable", () => {
    const outcome = resolveAssistantDateRequest({
      message: "卧推有没有进步",
      now: WEDNESDAY,
      timeZone: "Not/AZone",
    });

    // Falls back to UTC rather than failing the turn.
    expect(outcome).toEqual({
      range: { end_date: "2026-07-29", start_date: "2026-06-30" },
      source: "default",
      status: "range",
    });
  });
});
