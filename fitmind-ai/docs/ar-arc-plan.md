# AR arc pre-implementation plan

- **Date**: 2026-07-05
- **Status**: AR-0 through AR-1b implemented; AR-1c implemented on its review
  branch; AR-1d remains proposed
- **Scope**: AR-0 completion record and AR-1 implementation plan. AR-0's
  accepted contract is recorded in D48; this plan does not consume a formal
  decision number.

The AR arc goal is to make the public demo feel like a real AI product while
preserving FitMind's core promise: deterministic tools, evidence-bound answers,
faithfulness checks, and zero-surprise cost controls. AR-2 may switch the public
default to DeepSeek through the existing OpenAI-compatible provider only after
AR-0 fallback hardening and AR-1 cost/abuse guardrails have shipped and passed
review.

Codex does not change Vercel production environment variables in this arc. AR-2
requires a user deployment action to set `ASSISTANT_PROVIDER=openai_compatible`
and the DeepSeek `OPENAI_COMPAT_*` values after local live validation.

## Shared constraints

- No implementation batch may touch more than five code files. Docs synced in
  the same batch do not count against that limit.
- Tests remain deterministic: no real LLM calls, no real network, fake clocks,
  injected fetch/limiter/provider seams.
- Real-provider failures must never bypass deterministic tool execution,
  faithfulness validation, safety routing, or rate/budget checks.
- Public answer DTOs stay focused on the user answer. Operational fallback and
  budget markers are server-side telemetry/log fields unless a later reviewed
  product decision exposes them.
- Rollback at any point is `ASSISTANT_PROVIDER=mock` or the AR-1 kill-switch.
  For a code rollback, revert the last reviewed AR batch; each batch must leave
  `main` deployable.

## AR-0: provider fallback hardening

**Status: Complete (AR-0a through AR-0d).** The accepted shipped contract is
recorded in [D48](./ai-decisions.md#d48-ar-0-provider-error-deterministic-fallback).

### Implemented behavior

`assistant-provider-fallback.ts` retains the success-shape fallback for provider
plain-text messages and now also converts normalized provider errors into a
deterministic fallback decision. It preserves provider `tool_call` responses
and never invents required arguments such as an `exercise_id`.

The OpenAI-compatible client/provider already normalizes several DeepSeek-style
failure classes into provider errors:

- missing or unusable key/config through the configured-provider wrapper;
- HTTP errors with status and sanitized message;
- timeout/abort as `status:0` after the shared 20s timeout;
- malformed or unexpected response shape as a provider error.

The orchestrator now resolves `rawProviderResponse.kind === "error"` before
answer assembly. If all default-tool arguments exist, it executes that real
tool and retains faithfulness validation. If required arguments are absent, it
returns deterministic guidance requesting the missing input. Both branches
persist structured output and complete SSE with `done`, not `error`.

### Implemented contract

Key missing, HTTP error, timeout, and malformed provider response all degrade to
the same user-visible shape: a successful deterministic answer produced through
the default tool path and faithfulness check. The user does not see a 502 and the
SSE stream does not terminate as an application error.

The fallback must be observable. Silent fallback would hide a broken AR-2
deployment where DeepSeek is configured incorrectly but every visitor receives
mock answers. Telemetry/logs need independent, monitorable markers, for example:

- `provider_error_fallback: true`
- `provider_error_code`
- `provider_error_message_sanitized` when already safe to log
- `fallback_provider: "mock"`
- `fallback_reason: "provider_error"`

These markers must be distinguishable from normal mock-mode traffic so logs or a
dashboard can alert on "production is relying on mock fallback".

SSE semantics are part of the contract: provider-error fallback emits normal
answer events and finally emits `done`, not `error`. The result is a real
deterministic answer assembled from FitMind tools plus faithfulness validation,
not an error wrapper with friendly copy.

### Design options

1. Keep provider errors as 502. This preserves current behavior but blocks AR-2:
   public DeepSeek misconfiguration or transient provider errors would surface as
   user-visible failures.
2. Catch provider errors in the SSE controller. This avoids 502 but is too late
   in the stack; it would duplicate answer assembly and risk skipping tool
   execution, persistence, or faithfulness.
3. Convert provider errors inside the orchestrator/provider fallback boundary.
   This is the preferred design because it reuses the existing mock/default-tool
   path, keeps persistence and telemetry in one place, and allows a single test
   seam to cover mock-turn and stream-turn.

### Completed implementation slices

- **AR-0a characterization tests** pinned the former provider error behavior for key
  missing/config failure, HTTP error, timeout, and malformed response. Also pin
  that the pre-AR-0 SSE path emitted `error`/threw `AI_PROVIDER_ERROR`.
- **AR-0b fallback seam** extended the provider fallback boundary so a provider
  error is represented as either "use deterministic fallback tool" or
  "request missing input", while preserving `provider_error_code` and safe
  failure metadata in a pure decision seam.
- **AR-0c orchestrator wiring** routes provider errors through deterministic
  default tool execution, answer assembly, persistence, and faithfulness. Both
  mock-turn and stream-turn share the same behavior. SSE fallback ends in
  `done`, not `error`.
- **AR-0d documentation** records D48 with the exact telemetry markers, SSE
  semantics, phrasing bypass, unchanged public DTO, and remaining boundaries.

Each implementation slice stayed under five code files; tests and wiring were
kept in separately reviewable batches where needed.

### Verification coverage

- Tests use injected provider/fetch/clock seams and do not call DeepSeek.
- Coverage includes the four failure classes: missing key/config, HTTP error, timeout, and
  malformed response.
- User-visible success assertions confirm HTTP/SSE completes, structured output exists,
  faithfulness is present, and no `AI_PROVIDER_ERROR` reaches the public
  response.
- Observability assertions confirm telemetry contains `provider_error_fallback:true`,
  original `provider_error_code`, and `fallback_provider:"mock"` or equivalent
  monitorable fields.
- SSE contract assertions confirm fallback streams normal answer events and `done`, never
  the `error` event for provider-error fallback.
- Existing safety/refusal behavior remains preserved. Safety-gate failures are not
  provider failures and must not be turned into mock answers.

### Known boundaries

- This is a fallback, not proof that DeepSeek is healthy. AR-2 still needs a live
  local DeepSeek conversation and live validation before production env changes.
- Numeric `provider_error_status` is not independently carried in structured
  telemetry. Add it only in a separately reviewed pass-through change if
  operations need status-based aggregation (AR-0b review backlog).
- Provider outages may increase latency up to the provider timeout before
  fallback. Timeout tuning remains a separate deployment/runtime decision.
- Fallback answers are deterministic and safe, but may be less conversational
  than a real provider response.

## AR-1: cost and abuse guardrails

### Current behavior

The current AI limiter is per user and uses the existing in-memory
`createAiRateLimiter` seam with string keys. It protects authenticated usage, but
registration is cheap. A script can create many accounts and turn a public
DeepSeek default into many paid real-provider calls. Token/cost telemetry exists
for known model pricing; BYO or unknown models may report
`estimated_cost_usd: null`.

### Target behavior

AR-1 adds three layers that must all run before any real provider request:

- per-instance daily call budget;
- per-instance daily cost budget when model pricing is known;
- anonymous/per-IP hard cap for AI calls, in addition to the existing per-user
  limiter.

If any layer blocks a request, the assistant deterministically falls back to mock
and records server-side telemetry. It must not call the real provider first and
decide after the fact.

### Fail-safe direction

Budget protection is wallet protection. Missing or malformed budget config must
keep limits enabled with conservative defaults; it must never be interpreted as
unlimited spend.

The kill-switch has a different fail-safe direction because it is an emergency
stop, not the wallet's always-on limit. For
`ASSISTANT_REAL_PROVIDER_KILL_SWITCH`, unset means live-provider calls remain
eligible; recognized true values and malformed values force deterministic mock
fallback, while recognized false values keep calls eligible. This lets AR-2 turn
on the reviewed provider with `ASSISTANT_PROVIDER=openai_compatible` without a
second enable flag. Budget config remains fail-safe limited independently.

Call-count budget is the always-available floor because it does not depend on
model pricing. Cost budget is an enhancement when a model has a known price. If a
BYO/unknown model reports `estimated_cost_usd: null`, the cost counter does not
advance, but the call-count budget and per-IP cap still apply. Unknown pricing
must not disable the whole guardrail.

### Proposed defaults

These defaults are intentionally conservative for a public demo and can be tuned
by reviewed config-only deployment changes later:

- per-instance real-provider calls: `500/day`;
- per-instance priced spend: `$1.00/day`;
- per-IP AI real-provider attempts: `10/min` and `30/day`;
- existing per-user AI limits remain in place.

DeepSeek is inexpensive at demo scale, so the goal is not micro-optimization.
The goal is preventing an automated abuse path from turning a small demo bill
into a meaningful bill.

### Design options

1. Distributed DB/Redis counters. This gives stronger global accounting but adds
   storage shape, failure modes, and migration/retry semantics. Defer until the
   per-instance MVP proves the policy and abuse patterns justify it.
2. Cloudflare/Vercel edge-only rate limiting. Useful later, but it cannot see
   model, cost, user, or assistant-route semantics as precisely as the server
   guard. It also does not cover local/test behavior.
3. Per-instance MVP plus per-IP limiter. This is the preferred AR-1 design:
   deterministic, injectable, small, compatible with serverless partial
   protection, and enough to make AR-2 safe for a public demo.

No Redis or DB counter is introduced in AR-1. Distributed budgets, cross-instance
exact cost aggregation, Cloudflare edge limits, CAPTCHA, and account reputation
stay backlog.

### Relationship to existing limiter seam

Reuse or extend `createAiRateLimiter` rather than inventing a second counting
style. The seam already supports string keys and injected clocks. AR-1 should add
keys for IP plus route/provider intent, for example:

- `ai:ip:<ip>:assistant`
- `ai:instance:real-provider:calls`
- `ai:instance:real-provider:cost:<date>`

Exact key names are implementation details, but the properties are not: the keys
must be deterministic, test-isolated, and injectable so app-level
characterization tests cannot flake from module-level counter state.

### Guardrails must not be bypassed

- Check kill-switch, per-instance call budget, per-IP cap, and per-user limiter
  before real provider execution.
- For flows with multiple possible LLM calls, such as routing, tool selection,
  and phrasing, each real-provider attempt must pass the guard. A later phrasing
  call cannot bypass a budget that the first call consumed.
- Exceeded budget falls back to mock with telemetry such as
  `budget_fallback:true`, `budget_reason`, `budget_scope`, and current
  counter/limit values. It does not return a public billing error.
- Safety-gate semantics stay separate. Safety protection remains fail-safe on;
  budget protection remains fail-safe limited. Neither one disables the other.

### Proposed implementation slices

- **AR-1a budget policy module**: implemented on its review branch. The pure
  parser and in-memory budget counter use an injected clock and the existing
  string-key limiter seam. Coverage pins missing/malformed env, UTC day reset,
  priced vs unknown-cost model, kill-switch unset/true/malformed, and exceeded
  budgets. D49 records the policy contract; provider wiring remains AR-1b.
- **AR-1b provider guard seam**: implemented on its review branch. The
  transport-agnostic seam returns allow/fallback decisions plus telemetry and
  holds one process-level counter through a default singleton guard. It remains
  injectable for tests and is not wired to provider/orchestration paths yet.
- **AR-1c per-IP AI limiter**: implemented as an unmounted HTTP middleware seam
  with a process-level `10/min` plus `30/UTC day` limiter keyed by client IP.
  It uses the configured-provider getter, leaves mock traffic uncounted, writes
  allow/fallback telemetry to response locals, and never emits a public 429.
  Route mounting and deterministic fallback consumption remain AR-1d.
- **AR-1d orchestration telemetry and docs**: wire fallback markers into turn
  telemetry/logging, record D49, and update API/ops docs if the public error
  contract changes. Prefer no public error change: budget fallback should look
  like a successful deterministic answer.

Each implementation batch must stay deployable. A mid-AR-1 `main` should still
default to mock unless all required guardrails are in place and reviewed.

### Test strategy

- Zero real network; fake provider/fetch records whether a live request would
  have been made.
- Fake clock covers per-minute and per-day windows plus UTC/local-day reset
  decision made in the implementation batch.
- Missing and malformed env cases must assert limits remain enabled.
- Unknown model pricing must assert `estimated_cost_usd: null` does not disable
  call-count or IP limits.
- Exceeded per-IP, per-user, call-budget, cost-budget, and kill-switch cases must
  assert no provider fetch and deterministic mock fallback.
- Existing eval remains offline and must still pass `13/13`, `12/12`, `3/3`,
  and `20/20`.

### Known boundaries

- Per-instance budgets are partial protection in serverless deployments. Multiple
  warm instances each have their own budget. This is acceptable for AR-1 MVP and
  must be called out again before AR-2.
- Cost budget accuracy depends on known model pricing and provider usage
  reporting. Call-count budget is the hard floor when cost is unknown.
- IP limits can group users behind NAT, corporate networks, or Cloudflare Worker
  egress. The limits should be conservative enough for a public demo and
  revisited after real traffic.
- A determined attacker can distribute IPs. Distributed counters, edge rate
  limiting, CAPTCHA, and abuse reputation remain future hardening.

## AR-2 handoff checklist

AR-2 does not start until AR-0 and AR-1 are merged and reviewed. Before the user
changes production Vercel env, Codex should run local live validation with
DeepSeek:

- set `ASSISTANT_PROVIDER=openai_compatible`,
  `OPENAI_COMPAT_BASE_URL=https://api.deepseek.com`,
  `OPENAI_COMPAT_MODEL`, and `OPENAI_COMPAT_API_KEY` locally;
- complete one real conversation that exercises routing, tool execution,
  structured answer assembly, faithfulness, and telemetry;
- run eval in the approved real-provider smoke mode first, then keep the
  committed gate deterministic/offline unless a later review explicitly changes
  that policy;
- confirm fallback telemetry is visible when the key is intentionally broken;
- provide the user a production env checklist. The user performs the Vercel env
  change and deployment action.
