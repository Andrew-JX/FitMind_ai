import { describe, expect, it } from "vitest";

import { createAiRateLimiter } from "./ai-rate-limiter.js";

describe("createAiRateLimiter", () => {
  it("allows requests up to the per-minute cap, then returns RATE_LIMITED", () => {
    const now = 0;
    const limiter = createAiRateLimiter({
      perMinute: 3,
      perDay: 100,
      now: () => now,
    });

    expect(limiter.consume("u1").allowed).toBe(true);
    expect(limiter.consume("u1").allowed).toBe(true);
    expect(limiter.consume("u1").allowed).toBe(true);

    const blocked = limiter.consume("u1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.code).toBe("RATE_LIMITED");
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the minute window after 60s", () => {
    let now = 0;
    const limiter = createAiRateLimiter({
      perMinute: 1,
      perDay: 100,
      now: () => now,
    });

    expect(limiter.consume("u1").allowed).toBe(true);
    expect(limiter.consume("u1").allowed).toBe(false);

    now += 60_000;
    expect(limiter.consume("u1").allowed).toBe(true);
  });

  it("enforces the per-day quota with AI_QUOTA_EXCEEDED", () => {
    const now = 0;
    const limiter = createAiRateLimiter({
      perMinute: 100,
      perDay: 2,
      now: () => now,
    });

    expect(limiter.consume("u1").allowed).toBe(true);
    expect(limiter.consume("u1").allowed).toBe(true);

    const blocked = limiter.consume("u1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.code).toBe("AI_QUOTA_EXCEEDED");
  });

  it("does not consume the day counter when the minute cap blocks the request", () => {
    let now = 0;
    const limiter = createAiRateLimiter({
      perMinute: 1,
      perDay: 5,
      now: () => now,
    });

    expect(limiter.consume("u1").allowed).toBe(true); // day=1, minute=1
    expect(limiter.consume("u1").allowed).toBe(false); // blocked by minute, day stays 1

    // New minute window; day should still have budget (was not consumed while blocked).
    now += 60_000;
    expect(limiter.consume("u1").allowed).toBe(true); // day=2
    expect(limiter.consume("u1").allowed).toBe(false); // minute cap again
  });

  it("tracks users independently", () => {
    const now = 0;
    const limiter = createAiRateLimiter({
      perMinute: 1,
      perDay: 5,
      now: () => now,
    });

    expect(limiter.consume("u1").allowed).toBe(true);
    expect(limiter.consume("u2").allowed).toBe(true);
    expect(limiter.consume("u1").allowed).toBe(false);
  });

  it("can reset the daily window at UTC midnight", () => {
    let now = Date.UTC(2026, 6, 11, 23, 59, 59);
    const limiter = createAiRateLimiter({
      perMinute: 100,
      perDay: 1,
      now: () => now,
      dayWindow: "utc_calendar_day",
    });

    expect(limiter.consume("ai:instance:real-provider:calls").allowed).toBe(
      true,
    );
    expect(limiter.consume("ai:instance:real-provider:calls").allowed).toBe(
      false,
    );

    now = Date.UTC(2026, 6, 12, 0, 0, 0);
    expect(limiter.consume("ai:instance:real-provider:calls").allowed).toBe(
      true,
    );
  });

  it("returns additive minute and day counter telemetry", () => {
    let now = 0;
    const limiter = createAiRateLimiter({
      perMinute: 1,
      perDay: 2,
      now: () => now,
    });

    expect(limiter.consume("u1")).toEqual({
      allowed: true,
      minuteCount: 1,
      minuteLimit: 1,
      dayCount: 1,
      dayLimit: 2,
    });
    expect(limiter.consume("u1")).toMatchObject({
      allowed: false,
      code: "RATE_LIMITED",
      minuteCount: 1,
      minuteLimit: 1,
      dayCount: 1,
      dayLimit: 2,
    });

    now += 60_000;
    expect(limiter.consume("u1")).toMatchObject({
      allowed: true,
      minuteCount: 1,
      dayCount: 2,
    });
    expect(limiter.consume("u1")).toMatchObject({
      allowed: false,
      code: "AI_QUOTA_EXCEEDED",
      minuteCount: 1,
      dayCount: 2,
    });
  });
});
