import { describe, expect, it } from "vitest";

import { parseWorkoutDateHint } from "./workout-intake-date-parser.js";

const referenceIso = "2026-05-30T10:00:00.000+10:00";

describe("parseWorkoutDateHint", () => {
  it("resolves relative Chinese date hints from the local reference date", () => {
    expect(
      parseWorkoutDateHint("\u6628\u5929\u7ec3\u4e86\u9ad8\u4f4d\u4e0b\u62c9", referenceIso),
    ).toMatchObject({
      date_label: "\u6628\u5929",
      date_source: "explicit_text",
      performed_at: "2026-05-29T10:00:00.000+10:00",
    });

    expect(
      parseWorkoutDateHint("\u524d\u5929\u7ec3\u4e86\u9ad8\u4f4d\u4e0b\u62c9", referenceIso),
    ).toMatchObject({
      date_label: "\u524d\u5929",
      date_source: "explicit_text",
      performed_at: "2026-05-28T10:00:00.000+10:00",
    });
  });

  it("resolves Chinese absolute month-day text using the reference year", () => {
    expect(
      parseWorkoutDateHint(
        "\u4e94\u6708\u4e8c\u5341\u4e5d\u53f7\u7ec3\u4e86\u9ad8\u4f4d\u4e0b\u62c9",
        referenceIso,
      ),
    ).toMatchObject({
      date_label: "2026-05-29",
      date_source: "explicit_text",
      performed_at: "2026-05-29T10:00:00.000+10:00",
    });
  });

  it("resolves numeric month-day and ISO date text", () => {
    expect(
      parseWorkoutDateHint("5\u670829\u53f7\u7ec3\u4e86\u9ad8\u4f4d\u4e0b\u62c9", referenceIso),
    ).toMatchObject({
      date_label: "2026-05-29",
      date_source: "explicit_text",
      performed_at: "2026-05-29T10:00:00.000+10:00",
    });

    expect(
      parseWorkoutDateHint("2026-05-29 \u7ec3\u4e86\u9ad8\u4f4d\u4e0b\u62c9", referenceIso),
    ).toMatchObject({
      date_label: "2026-05-29",
      date_source: "explicit_text",
      performed_at: "2026-05-29T10:00:00.000+10:00",
    });
  });

  it("falls back to request performed_at when text has no date hint", () => {
    expect(
      parseWorkoutDateHint("\u9ad8\u4f4d\u4e0b\u62c9\u4e09\u7ec4", referenceIso),
    ).toMatchObject({
      date_label: null,
      date_source: "request_performed_at",
      performed_at: referenceIso,
    });
  });
});
