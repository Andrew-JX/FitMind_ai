# ER arc plan: assistant entity resolution

- **Date:** 2026-07-17
- **Base:** `origin/main@e4bd2fb`
- **Status:** ER-1B server wiring implemented; branch awaiting review before ER-1C
- **Goal:** Let the assistant resolve exercises and date ranges from ordinary
  language so selecting an exercise on another page is no longer a prerequisite.

## Why this arc exists

The assistant guardrails are working: safety remains conservative, deterministic
answers do not invent numbers, provider output is faithfulness-checked, and
provider/budget failures have bounded fallbacks. The usability failure is entity
resolution.

`AssistantChatPanel` currently sends `exercise_id` only for selected explicit
modes. Free typing uses `mode:"auto"`, so a user can type “杠铃卧推” repeatedly
without ever supplying the required identifier. The server then returns guidance
that asks the user to specify an exercise even though repeating the exercise name
cannot change the request. The only working path is to select an exercise on the
analysis page and return to an assistant shortcut.

This is unnecessary duplication. The training intake flow already uses
`exercise-matching-service.ts` and `exercise-aliases.ts` to resolve canonical
exercise dictionary IDs conservatively. ER reuses and extends that matching seam
instead of creating a second matcher.

The date path has the same semantic gap. The web client always sends a local
30-day range, so “本周” and “上周” currently affect intent wording but not the
tool query. The earlier range-label fix made the answer honest about the range it
actually received; ER-2 makes the request range match supported time language.

## Arc order and shared constraints

The order remains **ER-1 exercise resolution → ER-2 date resolution → ER-3
refusal/clarification copy**.

- ER-1 removes the hard dead loop and gives the highest immediate usability
  return.
- ER-2 fixes the remaining mismatch between natural-language time and tool input.
- ER-3 is last because its final wording depends on the entity states introduced
  by ER-1 and ER-2.

Shared constraints:

- Each implementation batch touches at most five code files. Documentation synced
  in the same batch does not count toward that code-file limit.
- ER-1, ER-2, and ER-3 remain independently reviewable and revertible.
- No migration and no new dependency are introduced.
- Entity resolution is deterministic, zero-LLM, and unit-testable.
- `matchExercise` and `exercise-aliases` remain the single matching source of
  truth. ER may extend them but must not create a parallel assistant matcher.
- Safety, faithfulness, provider guards, budgets, per-IP behavior, tool validation,
  and SSE completion semantics must not be weakened.

## Architecture decision

### Options considered

1. **Client-side NLU. Rejected.** It would duplicate dictionary aliases, date
   semantics, ambiguity rules, and timezone handling in the UI. The client should
   only transmit device context and explicit user choices.
2. **LLM entity extraction. Rejected for this arc.** It would add cost,
   nondeterminism, and another provider-validation surface to data-tool routing.
3. **Deterministic server resolver beside intent routing. Selected.** It can reuse
   the canonical dictionary matcher, is testable without a provider, and resolves
   tool inputs before tool selection.

ER adds no entity-resolution LLM fallback. A future LLM fallback would require a
separately reviewed slice: every call must pass the existing provider guard and
budget policy, and every returned entity must be accepted only after deterministic
dictionary/range validation.

### Semantic execution order

1. Validate the top-level request shape and resolve the user-owned session.
2. Run safety as the first semantic decision. A safety match short-circuits before
   entity parsing, intent rescue, tool selection, or phrasing.
3. Deterministically resolve exercise mentions, date language, and the immediately
   preceding pending clarification context.
4. Run deterministic intent routing. When that router does not match, retain the
   existing guarded and budgeted intent-rescue behavior.
5. Using the final intent, decide whether the resolved entities are sufficient,
   ambiguous, conflicting, or unresolved. Clarification short-circuits here.
6. Only a complete request proceeds to the existing tool-selection, tool execution,
   phrasing, faithfulness, persistence, and SSE path.

The billing boundary must be stated precisely:

- Entity parsing itself makes no LLM call and completes before any provider call.
- A clarification response does not trigger **tool-selection or phrasing** provider
  calls.
- If deterministic intent routing did not match, an intent-rescue call may already
  have occurred. That call remains subject to the existing provider guard, per-IP
  policy, and budget accounting.
- Tests must distinguish intent rescue, tool selection, and phrasing. They must not
  assert that every clarification has zero provider calls.

## Request and precedence contracts

### Request shape

The web client sends the device IANA `timezone`, explicit exercise selection when
one exists, and the user's message. It stops presenting its automatically
generated 30-day dates as an explicit range.

`start_date` and `end_date` become an optional pair:

- both present: an explicit caller-supplied range; existing callers stay
  compatible and timezone is not required to interpret the range;
- neither present: a valid IANA timezone is required, and the server resolves a
  supported message time term or computes the default inclusive 30-day range;
- only one present: top-level validation error.

### Exercise precedence

The fixed order is:

1. exercise ID from an option clicked in the current clarification;
2. current client-selected exercise ID;
3. exercise ID deterministically parsed from the message;
4. clarification.

A higher-priority value is never overwritten by a lower-priority mention. Within
the client, a clarification option clicked for the current turn overrides an older
selected exercise. Free-text `mode:"auto"` can therefore use a current explicit
selection when present, while requiring no cross-page selection when absent.

### Date precedence

The fixed order is:

1. explicit `start_date` plus `end_date`;
2. one supported time term parsed from the message;
3. the server-computed inclusive default of today minus 29 days through today.

When a higher-priority source is present, lower-priority time language does not
override it.

## ER-1: exercise resolution

ER-1 extends the existing matcher with whole-message extraction. The extension
must still feed extracted phrases into `matchExercise`; it must not replicate
alias-to-code or confidence decisions in assistant code.

Rules:

- Prefer the longest non-overlapping known phrase. “上斜杠铃卧推” must not also
  become a separate “杠铃卧推” match.
- One uniquely resolved exercise produces `exercise_id` for the existing tool
  path.
- More than one distinct exercise mention is ambiguous even when each mention is
  individually exact. A single-exercise tool never silently chooses the first.
- A broad phrase such as “卧推” remains ambiguous. Its candidates include flat
  barbell/dumbbell and available incline variants, up to the matcher's existing
  five-candidate cap.
- An unknown dictionary phrase is unresolved. No ID is guessed and no entity LLM
  fallback runs.
- If the final intent requires an exercise and the entity is absent, ambiguous, or
  unresolved, return actionable clarification before tool selection.

ER-1 is accepted when a user with no selected exercise can type
“杠铃卧推最近有没有进步” in `mode:"auto"` and receive the normal evidence-bound
progress result. The former cross-page selection flow remains available only as
an optional shortcut.

## ER-2: date resolution

The v1 vocabulary and inclusive range semantics are:

- `本周` / `这周` / `这个星期`: Sunday through today in the device timezone;
- `上周` / `上一周` / `上个星期`: the previous complete Sunday-through-Saturday
  week;
- `本月` / `这个月`: the first day of the current month through today;
- `下周`: not a historical evidence range; `next_week_plan` retains its existing
  recent-evidence window.

Date computation uses IANA-timezone local calendar parts and pure calendar-day
arithmetic rather than subtracting milliseconds across DST boundaries. The pure
resolver accepts an injected reference instant for deterministic tests.

Two different supported periods in one message, such as “本周和上周”, are a
conflict and enter date clarification. The server never selects the first match.

Unsupported time language is a documented v1 boundary. For example,
“最近三个月” is not parsed and falls back to the default 30-day range. The answer
must label the actual `result.range`; it must not repeat or imply a three-month
range. This is honest fallback behavior, not a claim that v1 understood the term.

## Clarification contract and continuation

Structured output adds this optional discriminated union:

```ts
type AssistantClarification =
  | {
      kind: "exercise";
      reason: "ambiguous" | "unresolved";
      options: Array<{ exercise_id: string; exercise_name: string }>;
    }
  | {
      kind: "date_range";
      reason: "ambiguous";
      options: Array<{
        label: string;
        start_date: string;
        end_date: string;
      }>;
    };
```

The assistant message renders compact option buttons. The same response also
tells the user that they can directly reply with a full exercise name or one
listed time term and do not need to visit the analysis page.

- An exercise option click submits its explicit ID and display name as a normal
  next turn.
- A date option click submits its explicit range and label as a normal next turn.
- A typed full exercise name or time term follows the same server continuation
  path.

The original message, requested mode, resolved intent, resolved non-ambiguous
entities, and allowed choices are stored in the assistant message's existing JSON
metadata. No table or migration is added.

Continuation rules prevent sticky context:

- Only the latest assistant message in the same user-owned session can supply a
  pending clarification.
- A valid option or uniquely resolved typed answer consumes it.
- Any unrelated new question is handled as a new turn and makes the older
  clarification ineligible.
- Client save eligibility excludes messages carrying `clarification`, so a partial
  answer cannot become a saved insight.

## ER-3: refusal and clarification copy

Copy separates these deterministic outcomes:

- **Out of scope:** for example “生酮饮食”; explain that the request is outside
  training-record interpretation and supported training analysis.
- **Unrecognized:** a possibly relevant request whose supported intent is still
  unclear; say that it was not understood and provide executable examples.
- **Missing exercise:** state that the requested analysis is understood but the
  exercise is absent; tell the user to type the full exercise name directly.
- **Ambiguous exercise/date:** present options and the direct-reply alternative.
- **Unresolved exercise:** state that the exercise was not found in the current
  dictionary and that FitMind will not guess.

Safety responses remain separate and continue to run first.

## Implementation batches

### 1. ER-1A: whole-message exercise extraction — 5 code files — implemented and merged

Extend the matcher, aliases, and matching tests; add a pure assistant entity
resolver and its tests. Cover exact, absent, broad, multiple, longest-overlap, and
unknown exercise cases.

### 2. ER-1B: server wiring and pending clarification — 5 code files — implemented, awaiting review

Wire the resolver through the orchestrator, answer composer, chat repository, a
validated clarification-context module, and orchestrator regression coverage.
Clarification must stop before tool selection/phrasing while preserving possible
guarded intent rescue.

### 3. ER-1C: client clarification contract — 5 code files

Extend client structured-output types and normalization; exclude clarification
from saved-insight eligibility; add corresponding unit coverage.

### 4. ER-1D: candidate UI and request construction — 5 code files

Wire message bubble/list/panel candidate actions and introduce a pure, tested
request-payload builder. A current clarification choice outranks older selected
exercise state.

### 5. ER-2A: pure date resolver — 2 code files

Add the timezone-aware resolver and tests for Sunday boundaries, month starts,
cross-month/year behavior, DST, invalid zones, and conflicting supported terms.

### 6. ER-2B: date request and server wiring — at most 5 code files

Accept optional explicit dates plus timezone, compute the default range on the
server, and add date clarification while retaining old explicit-range requests.

### 7. ER-2C: client cutover and closed-loop regression — at most 3 code files

Stop sending client-generated default dates and cover explicit precedence,
supported terms, unknown-term default fallback, and clarification continuation.
ER-2B and ER-2C must be reverted together if the client cutover is rolled back.

### 8. ER-3: refusal and clarification copy — at most 5 code files

Separate out-of-scope, unrecognized, missing, ambiguous, and unresolved outcomes;
pin “生酮饮食” as out of scope and keep safety behavior unchanged.

### 9. ER-EVAL: offline entity goldens — 2 code files

Extend the assistant eval and its tests with exact entity/range expectations. The
suite remains offline, mock-first, DB-free, network-free, and zero-cost.

Each implementation batch performs the normal documentation impact audit.
Accepted runtime decisions go into `ai-decisions.md` when the corresponding code
batch is reviewed; this docs-only kickoff does not pre-record unimplemented
behavior as accepted runtime state.

## Test and acceptance strategy

Deterministic entity eval cases include:

- exact exercise name;
- no exercise mention;
- broad/ambiguous exercise;
- multiple exercise mentions;
- unknown exercise phrase;
- this week, last week, and this month at a fixed instant/timezone;
- explicit dates overriding a message time term;
- conflicting supported time terms;
- unsupported “最近三个月” falling back to the exact default 30-day range.

Date goldens assert exact `start_date`, `end_date`, resolution source, and final
tool arguments. A golden must never pass merely because answer prose says “本周”.
Orchestrator coverage also asserts that the final answer uses the tool's
`result.range` rather than an unverified message label.

Provider-call assertions are separated by phase:

- deterministic-router miss may invoke guarded and billed intent rescue;
- clarification invokes no tool-selection provider call;
- clarification invokes no phrasing provider call;
- safety invokes no entity parser, intent rescue, tool selection, or phrasing.

Normal tool paths retain faithfulness verification. Existing per-IP entry
accounting, provider guards, budgets, tool validation, persistence, and SSE
completion behavior remain unchanged.

Browser acceptance scenarios:

1. With no selected exercise, type “杠铃卧推最近有没有进步” and receive a normal
   progress answer with Evidence.
2. Type “卧推最近有没有进步”, click a candidate, and receive the original
   question's result.
3. Repeat scenario 2 but type “杠铃卧推” instead of clicking.
4. Type “上周杠铃卧推有没有进步” and verify the tool receives the previous
   Sunday-through-Saturday range in the device timezone.

Run targeted tests for every batch. Run `pnpm verify` and `pnpm eval` at the ER-1,
ER-2, and ER-3 checkpoints. No test may call a real provider.

## Rollback and known boundaries

- There is no schema migration or new package to unwind.
- Revert ER-3 independently for copy regressions.
- Revert ER-2B and ER-2C together after the web client stops sending default
  dates.
- Revert ER-1 client/UI batches before or with the ER-1 server batches; the
  optional response field remains safe for older clients that ignore it.
- Natural-language absolute dates, arbitrary durations, comparisons across two
  ranges, and English time vocabulary are outside ER-2 v1 unless separately
  reviewed.
- Unknown time expressions use the honest default range; unknown exercises never
  use a guessed ID.
- The existing exercise dictionary query remains the canonical data source. Any
  future caching policy requires a separate invalidation decision.

## Docs-only delivery gate

This kickoff batch changes only this document, `roadmap.md`, and `progress.md`.
It does not change `ai-decisions.md`, application code, schemas, dependencies,
environment variables, or deployments.

Before push:

1. Run `pnpm verify`.
2. Run `pnpm eval`.
3. Confirm the diff contains only the three approved documentation files.
4. Commit as `docs(ai): plan assistant entity resolution arc`.
5. Push `codex/er-arc-plan`, report its SHA, and stop for review before ER-1A.
