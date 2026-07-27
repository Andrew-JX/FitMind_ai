# Assistant usability plan: plan-card lifecycle + ER-2/ER-3 sequencing

Status: **in execution**. Authored 2026-07-27 after the user's first real-device
pass over the finished UI (main at `2ac9411`). The one open decision it carried
was resolved the same day and is folded into PL-3. PL-1 is implemented and
reviewed; PL-2 went dormant when the failure stopped reproducing; PL-3 is next.

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

### PL-1 — tell the truth about the outcome — implemented, awaiting review/deploy

Implementation note (2026-07-27): completed on
`codex/pl-1-plan-outcome-truth`. The three planned production files changed;
one existing Playwright spec carries the required failure/success regression.
The production verification tap below remains the hard gate before PL-2.

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

**Delivery gate — answered, see PL-2.** The gate asked the user to tap 放弃计划
once on production. They did, and it succeeded.

Review findings (2026-07-27), both accepted as non-blocking and folded into
PL-3 rather than sent back:

- **R1** — `abandon()` early-returns `false` on `!token || !plan` without
  setting `actionError`, while the failure toast tells the user to read the
  card's error message, which in that path does not exist. Unreachable today:
  the button only renders when `plan` is present, and `bootstrap()` stores a
  sentinel token so `!token` is false for any authenticated session. Latent
  inconsistency, not a live bug.
- **R2** — `abandon()` wraps both the `PATCH` and the follow-up `refresh()` in
  one `try`. `refresh()` never rethrows, so the outer `catch` only ever sees the
  `PATCH` — but a `PATCH` that succeeds followed by a `refresh` that fails
  returns `true` while `refresh` writes its own `actionError`, producing a
  success toast beside an error line. Same contradictory-pair shape as F1, far
  smaller blast radius.

### PL-2 — dormant: the failure did not reproduce

The failure was **transient**. After PL-1 was reviewed, the user tapped 放弃计划
again on production and the plan was abandoned cleanly.

The inference that this was a real `PATCH` failure the first time, rather than a
display artifact, is solid: in the shipped code the success path is
`PATCH → refresh() → plan becomes null → empty state`, and the failure path
never calls `refresh()`, so the card stays put. The plan disappearing means the
`PATCH` succeeded. And the first report cannot have been a disguised `refresh`
failure, because `refresh()` swallows its own errors and never reaches
`abandon`'s catch. So: the `PATCH` genuinely failed once and genuinely succeeds
now.

**Most probable cause, recorded as a hypothesis rather than a diagnosis:** the
plan repository opens a fresh pool per call and ends it afterwards — five
`createRepositoryPool()` / `activePool.end()` pairs in
`db/planned-workout-repository.ts` — so every request is a new TCP+TLS handshake
to Neon with no pooling. This is the T4 debt already on the roadmap. A suspended
Neon endpoint plus a cold connection is a well-understood source of one-off
timeouts, and it fits a failure that neither reproduces nor leaves a client-side
trail. It is **not** confirmed: nothing captured the status code at the time.

There is therefore nothing to fix here yet, and inventing a fix for an
unobserved cause would be exactly the speculation this batch was written to
avoid. PL-2 is **dormant, not cancelled**.

**Reactivation trigger.** PL-1 is the instrument: once deployed, any recurrence
shows `请求失败（HTTP <status>）：<server message>` on the card. If it recurs,
capture:

1. the full status and message from the card;
2. whether a retry immediately after succeeds (transient) or fails again
   (deterministic);
3. the matching Vercel function log line for that request.

Then reopen PL-2 against the pre-registered branches from the original draft
(401 session, 404 stale id, 500 server fault). If the recurrence pattern is
cold-start shaped, PL-2 closes in favour of T4 rather than growing a local
workaround.

No batch may "fix" this by catching the error and pretending success.

### PL-3 — expired plans read as expired and can be archived — at most 5 code files

Decision taken by the user on 2026-07-27: **归档**.

Client-side classification, deliberately: the device already knows today in the
user's real timezone, and the plan carries `endDate`. Doing this on the server
would need a timezone in the request contract, which is exactly what ER-2B
introduces — so a server-side lifecycle field should wait for that plumbing
rather than inventing a second, UTC-only notion of "today" that would be off by
a day for this user.

Expected files: a pure lifecycle module beside `assistant-date-range.ts`, its
test, `AssistantCurrentPlanCard.tsx`, `use-current-plan.ts`,
`AssistantWorkspace.tsx`.

#### Classifier

`classifyPlanLifecycle({ endDate, today })` returns `"active" | "expired"`, with
`today` injected so tests are deterministic.

Both values are date-only `YYYY-MM-DD` strings, so the comparison is a plain
lexicographic string compare — `endDate < today` means expired. No `Date`
arithmetic, therefore no DST or timezone drift, and no repeat of the
millisecond-subtraction class of bug the ER plan already warns about. `today`
comes from the device clock through the same local-date formatter
`assistant-date-range.ts` already uses.

The boundary is inclusive: a plan whose `endDate` is today is still active.

#### Card behavior when expired

- The heading stops asserting 本周计划. Its replacement is PL-3's deliverable and
  is reviewed against F3: it must not name a window the plan does not cover. The
  existing meta line already prints the plan's real `startDate ~ endDate` and
  stays.
- An 已过期 chip, using the same tone helper as the per-exercise status chips so
  it reads as part of the card rather than a bolted-on banner.
- Adherence still renders. The closed plan's final numbers are the useful part
  of it, and 展开/收起 behaves as before.
- The primary action becomes 归档 → `PATCH {"status":"completed"}` through a new
  `archive()` on the hook, shaped exactly like `abandon()` after PL-1: returns
  `Promise<boolean>`, same readable-error handling, toast only after it settles.
- 放弃计划 stays available.

No server change is required: `planStatusBodySchema` already accepts
`completed`, and once the row leaves `active` the existing `/current` query stops
returning it, so the card falls through to its established empty state.

#### Why archive rather than abandon

The two statuses are not cosmetic variants. `getLatestAcceptedPlannedWorkoutForUser`
feeds the D42 planner adherence context, which accepts `active` and `completed`
and excludes `abandoned`. So 归档 means "this week closed, keep it as evidence
for future plans", while 放弃 means "discard it". Making 归档 the primary action
on an expired plan is what preserves the learning loop's input; offering only
放弃 would quietly throw that history away.

#### Carried over from the PL-1 review

Both findings are small, sit in the files PL-3 already touches, and are cheaper
to fix here than in their own batch:

- **R1** — give the `!token || !plan` early return its own `actionError`, or
  give the toast a message that does not promise a card error that was never
  written. Applies to `archive()` too, which is shaped the same way.
- **R2** — a `PATCH` that succeeds followed by a failing `refresh()` must not
  produce a success toast beside an error line. Either keep the refresh outside
  the success signal, or report the refresh failure as its own distinct state.
  Applies to `abandon`, `accept`, and the new `archive`.

#### Tests

- Classifier: `endDate` yesterday is expired; today is active; tomorrow is
  active; cross-month and cross-year boundaries behave; the comparison is
  unaffected by the host timezone.
- Card: an expired card renders neither 本周 nor any date the plan does not
  cover, renders 已过期, and its primary action calls `archive`.
- Failure path: a rejected `archive` surfaces the failure and leaves the card in
  place — it must not optimistically clear.
- R2 pin: a succeeding `PATCH` followed by a failing `refresh` must not emit the
  success toast.

#### Verification note

The user abandoned their stale plan on 2026-07-27, so that account currently has
no active plan and PL-3 cannot be eyeballed against real production data until a
new one is accepted. The batch must stand on its unit and Playwright coverage;
the mocked plan fixture already added in `ui-finishers.spec.ts` is the place to
build the expired case.

#### Out of scope for PL-3

No change to `/current`, no server-side lifecycle field (that waits for ER-2B's
timezone), and no modification of existing rows.

Sequencing note: 归档 uses the same `PATCH` endpoint as 放弃, which is currently
believed healthy (PL-2 dormant). If PL-2 ever reactivates and finds that endpoint
genuinely broken, PL-3's 归档 button is affected the same way.

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
PL-1 (done, awaiting merge)  →  PL-3  →  PL-4
      →  ER-1C  →  ER-1D  →  ER-2A  →  ER-2B  →  ER-2C  →  ER-3  →  ER-EVAL

PL-2: dormant, reactivated only by a recurrence (see PL-2 for what to capture)
```

Rationale: PL-1 corrects a lie this UI batch shipped and is the instrument that
makes any recurrence diagnosable, so it should merge even though the failure it
was written to expose has stopped reproducing. PL-3 fixes the mislabelled card,
which is structural and did **not** go away — the user cleared one stale plan by
hand, and the next accepted plan will expire into exactly the same state. PL-4
closes the data hole behind it. The ER arc is the larger usability push and is
not blocked by any of the above.

PL-1 and PL-3 are client-only and carry no production data risk. PL-4 changes
write behavior and needs the D42 pin.

## Resolved decisions

**Expired plan's primary action: 归档** (user, 2026-07-27). Specified in PL-3.

The alternatives and why they were not taken, recorded so the choice is not
relitigated mid-execution:

- **自动消失** — `/current` skips expired plans. Simplest, but the user never
  sees how the closed week went, and the row silently stays `active` in the
  database, which keeps F4 alive.
- **顺延** — roll the plan's window forward to the current week. It would
  attribute the old plan's targets to a week the user never agreed to, and
  adherence would then be computed over a window the plan was not written for.

## Review checkpoints

Applied when each batch comes back for review:

- no batch may report success for an operation that failed, or replace a real
  error with a generic string;
- no copy may name a date range the underlying data does not cover;
- tests must assert the failure path, not only the happy path;
- 归档 must write `completed`, never `abandoned` — the two carry different
  meaning for the D42 planner context, and collapsing them silently drops
  training history from the learning loop;
- `pnpm verify` and the client e2e suite green, independently re-run by the
  reviewer;
- PL-4 must show the D42 adherence-context pin passing both before and after.
