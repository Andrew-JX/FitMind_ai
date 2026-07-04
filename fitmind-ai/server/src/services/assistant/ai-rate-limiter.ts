/** AGENTS §7.3: AI 接口每用户每分钟最多 20 次。 */
const AI_REQUESTS_PER_MINUTE = 20;
/** AGENTS §7.3: 每用户每天最多 50 次 AI 调用。 */
const AI_REQUESTS_PER_DAY = 50;
/** 每分钟固定窗口长度。 */
const MINUTE_WINDOW_MS = 60_000;
/** 每天固定窗口长度。 */
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type AiRateLimitCode = "RATE_LIMITED" | "AI_QUOTA_EXCEEDED";

export interface AiRateLimitDecision {
  allowed: boolean;
  code?: AiRateLimitCode;
  retryAfterSeconds?: number;
}

export interface AiRateLimiter {
  /** Records one AI request for the user and returns whether it is allowed. */
  consume(userId: string): AiRateLimitDecision;
}

interface UserWindowState {
  minuteWindowStart: number;
  minuteCount: number;
  dayWindowStart: number;
  dayCount: number;
}

/**
 * Creates an in-memory fixed-window AI rate limiter enforcing the AGENTS §7.3
 * promise: per-user 20/min (→ `RATE_LIMITED`) and 50/day (→ `AI_QUOTA_EXCEEDED`).
 *
 * Deterministic and injectable (clock + limits) for unit tests. Counters are
 * only consumed when the request is fully allowed.
 *
 * @param options - Optional per-minute / per-day caps and an injectable clock
 * @returns A limiter whose `consume` records and decides one request
 *
 * @remarks
 * State is per-process and in-memory: on a multi-instance / serverless
 * deployment each instance counts independently. A distributed deployment would
 * back this with Redis or a DB counter; the seam (this interface) stays the same.
 */
export function createAiRateLimiter(options?: {
  perMinute?: number;
  perDay?: number;
  now?: () => number;
}): AiRateLimiter {
  const perMinute = options?.perMinute ?? AI_REQUESTS_PER_MINUTE;
  const perDay = options?.perDay ?? AI_REQUESTS_PER_DAY;
  const clock = options?.now ?? Date.now;
  const states = new Map<string, UserWindowState>();

  return {
    consume(userId: string): AiRateLimitDecision {
      const now = clock();
      const state = resolveState(states, userId, now);

      if (state.dayCount >= perDay) {
        return {
          allowed: false,
          code: "AI_QUOTA_EXCEEDED",
          retryAfterSeconds: secondsUntil(
            state.dayWindowStart + DAY_WINDOW_MS,
            now,
          ),
        };
      }

      if (state.minuteCount >= perMinute) {
        return {
          allowed: false,
          code: "RATE_LIMITED",
          retryAfterSeconds: secondsUntil(
            state.minuteWindowStart + MINUTE_WINDOW_MS,
            now,
          ),
        };
      }

      state.minuteCount += 1;
      state.dayCount += 1;

      return { allowed: true };
    },
  };
}

function resolveState(
  states: Map<string, UserWindowState>,
  userId: string,
  now: number,
): UserWindowState {
  const existing = states.get(userId);

  if (existing === undefined) {
    const fresh: UserWindowState = {
      minuteWindowStart: now,
      minuteCount: 0,
      dayWindowStart: now,
      dayCount: 0,
    };
    states.set(userId, fresh);

    return fresh;
  }

  if (now - existing.minuteWindowStart >= MINUTE_WINDOW_MS) {
    existing.minuteWindowStart = now;
    existing.minuteCount = 0;
  }

  if (now - existing.dayWindowStart >= DAY_WINDOW_MS) {
    existing.dayWindowStart = now;
    existing.dayCount = 0;
  }

  return existing;
}

function secondsUntil(boundaryMs: number, now: number): number {
  return Math.max(1, Math.ceil((boundaryMs - now) / 1000));
}
