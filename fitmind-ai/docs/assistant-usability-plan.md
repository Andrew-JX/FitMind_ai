# Assistant usability plan: plan-card lifecycle + ER-2/ER-3 sequencing

Status: **plan only, awaiting review**. No code in this document has been
written. Authored 2026-07-27 after the user's first real-device pass over the
finished UI (main at `2ac9411`).

The trigger was two reports from that pass:

1. tapping 放弃计划 showed 放弃失败;
2. a plan created during earlier testing still renders as 本周计划, weeks after
   its window closed.

Investigating those surfaced four defects, one of which was introduced by the
UI batch itself. This document specifies the fixes as reviewable batches and
sequences them against the already-planned ER-2/ER-3 work in
[`er-arc-plan.md`](./er-arc-plan.md), which this document does **not** restate.

## Findings

### F1 — the 放弃计划 toast reports success unconditionally

Introduced by the UI batch (`5bdad9c`), not pre-existing.

`AssistantCurrentPlanCard` fires the confirmation toast in the click handler,
before the request settles:

```
onClick={() => {
  props.onAbandon();
  showToast("已放弃本周计划");
}}
```

`onAbandon` is wired as `() => void currentPlan.abandon()` in
`AssistantWorkspace`, so it returns `void` and cannot be awaited. On failure the
card therefore shows the success toast *and* the failure text at the same time —
which is what the user saw. The toast is lying, and it is lying in the direction
that hides a real failure.

### F2 — the real abandon error is swallowed, so the cause is unknowable

`use-current-plan.ts` discards the error for all three actions:

- `abandon` → `catch { setActionError("放弃计划失败，请稍后再试。") }`
- `accept` → `catch { setActionError("接受计划失败，请稍后再试。") }`
- `refresh` → `catch { setStatus("error") }`

Every failure mode collapses into one fixed string. A 401, a 404, and a 500 are
indistinguishable to the user and to us. Every other data hook in this codebase
already funnels `HttpClientError` through a `getReadableErrorMessage` helper that
preserves the server's message; this hook is the outlier.

**Consequence for sequencing:** the server-side cause of the reported failure
cannot be determined from the code alone. Static review ruled out the cheap
hypotheses — the id is a real `uuid` with a DB default
(`20260614110000_create_planned_workouts.js`), the request body matches the
`.strict()` schema exactly, the `UPDATE` is not gated on the current status
(`db/planned-workout-repository.ts:197-205`), and Vercel rewrites all of
`/api/(.*)` to the single function so `PATCH` is routed. Guessing a fix would be
speculation. Surfacing the real code is therefore the first batch, and the fix
for the underlying failure is a separate batch scoped after we know it.

### F3 — an expired plan is never taken down

`getActivePlannedWorkoutForUser` filters on status only, with no date bound:

```sql
WHERE user_id = $1 AND status = 'active'
ORDER BY created_at DESC, id DESC
LIMIT 1
```

Nothing transitions a plan out of `active` when its `end_date` passes, so a plan
from weeks ago keeps rendering under the heading 本周计划 with a stale date line
next to it.

This is the same failure shape as the range-label bug recorded in
`ai-decisions.md` (D-series): the numbers are real, the **frame** around them is
false. The card is not merely stale, it is mislabelled — "本周计划" asserts a
window the plan does not cover. The fix must correct the label, not only add a
badge beside it.

### F4 — active plans accumulate, and older ones become unreachable

`acceptPlan` is a plain insert (`services/planned-workout-service.ts:109-123`).
It never supersedes the user's existing active plan. Two consequences:

- multiple rows can hold `status='active'` for one user; `/current` returns only
  the newest by `created_at`, so the older ones are invisible in the UI and
  cannot be abandoned or completed through it;
- those orphans are still visible to
  `getLatestAcceptedPlannedWorkoutForUser`, which feeds the D42 adherence
  context behind the planner. Stale rows can therefore influence generated plans
  while being unreachable to the user.

F4 is a data-lifecycle hole, not a display bug, and is why F3 cannot be fixed by
hiding expired rows on the client alone.

## Batches

Repo conventions apply to every batch: at most 5 code files, independently
reviewable and revertible, tests in the same batch as the behavior, and
`pnpm verify` plus `pnpm --filter @fitmind/client test:e2e` green before review.

### PL-1 — tell the truth about the outcome — at most 3 code files

Scope: `use-current-plan.ts`, `AssistantCurrentPlanCard.tsx`,
`AssistantWorkspace.tsx`.

- `abandon` returns `Promise<boolean>` like `accept` already does; the card
  awaits it and toasts 已放弃本周计划 or the failure only after it settles.
- Replace the three bare `catch` blocks with the codebase's existing
  `HttpClientError`-aware readable-message helper so the server's own message
  and status reach `actionError`. Keep a Chinese fallback for non-HTTP failures.
- Disable both header buttons while `isMutating` (放弃 already is; 展开 must not
  race a refresh).

Tests: a rejected `abandon` must surface the failure and must **not** emit the
success toast; a resolved one emits it exactly once. This is the regression pin
for F1.

Explicitly out of scope: fixing whatever the server is returning. PL-1 makes the
cause visible; it does not assume one.

**Delivery gate:** after PL-1 ships, the user taps 放弃计划 once on production and
reports the message shown. That message determines PL-2's content. Do not start
PL-2 before then.

### PL-2 — fix the underlying abandon failure — scope set by PL-1's output

Cannot be specified further without the real error code. Pre-registered
branches so review knows what to expect:

- **401/expired session** → the hook must not attempt a mutation with a null
  in-memory token; route through the cookie-authenticated path the workout hooks
  already use, and pin it with the existing "cookie-restored session, no
  in-memory token" e2e case.
- **404** → the client is holding a plan id the server no longer owns; refresh
  before mutating and surface a distinct "计划已不存在" state.
- **500** → capture the server stack from the Vercel logs first; if it is a
  `planDraftSchema` parse failure on legacy plan JSON, the fix is a tolerant read
  path for historical rows, and that decision needs its own review.

No batch may "fix" this by catching the error and pretending success.

### PL-3 — expired plans read as expired — at most 4 code files

Client-side classification, deliberately: the device already knows today in the
user's real timezone, and the plan carries `endDate`. Doing this on the server
would need a timezone in the request contract, which is exactly what ER-2B
introduces — so a server-side lifecycle field should wait for that plumbing
rather than inventing a second, UTC-only notion of "today" that would be off by
a day for this user.

Behavior when `plan.endDate` is before the device's today:

- the heading stops claiming 本周计划 and reads as a closed plan (wording is
  PL-3's deliverable, reviewed against F3: it must not name a window the plan
  does not cover);
- an 已过期 chip plus a factual line stating the plan's own end date;
- adherence still renders — the closed plan's final numbers are the useful part;
- the primary action becomes 归档 (`PATCH status=completed`), so the card can be
  cleared with closure instead of being framed as abandonment. 放弃计划 stays
  available.

**Open decision for the user (see below).** If the answer is "just hide it", PL-3
shrinks to a filter and the 归档 action is dropped.

Tests: a plan ending yesterday classifies as expired, one ending today does not
(inclusive boundary), and the expired card renders neither 本周 nor any date the
plan does not cover.

Sequencing note: PL-3's 归档 uses the same `PATCH` endpoint as 放弃. If PL-2
found that endpoint broken, PL-3 must land after PL-2 or it ships a second
button that fails the same way.

### PL-4 — one active plan per user — at most 3 code files, no migration

Accepting a plan supersedes any existing active plan for that user in the same
database transaction (`status='completed'`, preserving the superseded row for
history rather than deleting it).

Required guard: `getLatestAcceptedPlannedWorkoutForUser` feeds the D42 planner
adherence context. Its behavior must be pinned by test **before** the transition
changes, and the batch must show the pin still passes after — a plan whose
status flips from `active` to `completed` must remain eligible for that context,
since D42 already accepts `active`/`completed` and excludes only `abandoned`.

Also in scope: a decision (not code) on whether existing duplicate active rows
in production need a one-off cleanup, and if so it becomes its own reviewed
batch with a dry-run count first. No blind `UPDATE` across the table.

### ER batches — unchanged, see `er-arc-plan.md`

ER-1C, ER-1D, ER-2A, ER-2B, ER-2C, ER-3, ER-EVAL keep their existing
specifications, ordering, and rollback pairing (ER-2B and ER-2C revert
together). This document adds no changes to them.

Two cross-links worth honoring during execution:

- ER-2's own boundary already says an unsupported term such as 最近三个月 falls
  back to the default range and the answer must label the real `result.range`.
  That is the same discipline F3 demands of the plan card. Reviewers should
  apply one standard to both.
- A server-side plan lifecycle field, if wanted later, should reuse ER-2B's
  timezone rather than introducing its own.

## Recommended execution order

```
PL-1  →  [user taps 放弃 on prod, reports message]  →  PL-2  →  PL-3  →  PL-4
      →  ER-1C  →  ER-1D  →  ER-2A  →  ER-2B  →  ER-2C  →  ER-3  →  ER-EVAL
```

Rationale: PL-1 is small, corrects a lie this UI batch shipped, and is the only
way to learn what PL-2 must fix. PL-3 removes the mislabelled card the user is
looking at daily. PL-4 closes the data hole that recreates it. The ER arc is the
larger usability push and is not blocked by any of the above.

PL-1 and PL-3 are client-only and carry no production data risk. PL-4 changes
write behavior and needs the D42 pin.

## Open decision for the user

**What should an expired plan's primary action be?**

- **归档 (recommended)** — `PATCH status=completed`, card clears, the plan keeps
  its final adherence in history and stays eligible for the D42 planner context.
- **自动消失** — `/current` skips expired plans; simplest, but the user never
  sees how the closed week went and the row silently stays `active` in the
  database, which keeps F4 alive.
- **顺延** — roll the plan's window forward to the current week. Rejected in this
  draft: it would attribute the old plan's targets to a week the user never
  agreed to, and adherence would then be computed over a window the plan was not
  written for.

## Review checkpoints

Applied when each batch comes back for review:

- no batch may report success for an operation that failed, or replace a real
  error with a generic string;
- no copy may name a date range the underlying data does not cover;
- tests must assert the failure path, not only the happy path;
- `pnpm verify` and the client e2e suite green, independently re-run by the
  reviewer;
- PL-4 must show the D42 adherence-context pin passing both before and after.
